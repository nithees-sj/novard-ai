const Report = require('../models/report');
const ReportEmbedding = require('../models/reportEmbedding');
const { embedTexts, embeddingsEnabled } = require('../ai/embeddings');
const { runWithAi } = require('../ai/aiContext');
const { MODELS } = require('../config/ai');
const { env } = require('../config/env');
const { REPORTS, SEMANTIC } = require('../config/earlyWarning');
const logger = require('../utils/logger');

/**
 * Report embeddings and the search over them (EWDI graph/tools.py
 * search_similar): Atlas Vector Search when the cluster has it and the area
 * has enough vectors, MongoDB $text search otherwise. Tests always take the
 * $text path (mongodb-memory-server has no vector search).
 */

const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

/** What gets embedded for a report: what they wrote, said, and the AI output they point at. */
const embedText = (r) => [clip(r.text, 1200), clip(r.transcript, 400), clip(r.source?.excerpt, 400)].filter(Boolean).join('\n');

/** Embed these reports and store the vectors. Returns how many were stored. */
async function embedReports(reports) {
  if (!reports.length) return 0;
  const vectors = await runWithAi({ feature: 'reports.embed' }, () => embedTexts(reports.map(embedText)));
  await ReportEmbedding.bulkWrite(reports.map((r, i) => ({
    updateOne: {
      filter: { reportId: r._id },
      update: { $set: { area: r.area, createdAt: r.createdAt, vec: vectors[i], model: MODELS.EMBED } },
      upsert: true,
    },
  })));
  await Report.updateMany({ _id: { $in: reports.map((r) => r._id) } }, { $set: { embedded: true } });
  return reports.length;
}

/** Embed a new report in the background. A failure never affects the report. */
function embedReportSoon(reportId) {
  setImmediate(async () => {
    try {
      if (!(await embeddingsEnabled())) return;
      const report = await Report.findById(reportId).lean();
      if (report) await embedReports([report]);
    } catch (error) {
      logger.warn('Report embedding failed; npm run reports:embed will retry it', { reportId: String(reportId), error: error.message });
    }
  });
}

/** Batch pass (npm run reports:embed): reports without a vector, oldest first. Resumable. */
async function embedPending({ limit = 1000, batchSize = REPORTS.embedBatchSize } = {}) {
  if (!(await embeddingsEnabled())) return { considered: 0, embedded: 0, skipped: 'embeddings are off (no Gemini key, or Gemini switched off)' };
  const todo = await Report.find({ embedded: { $ne: true } }).sort({ createdAt: 1 }).limit(limit).lean();
  let embedded = 0;
  for (let start = 0; start < todo.length; start += batchSize) {
    try {
      // Sequential: one batch call at a time.
      // eslint-disable-next-line no-await-in-loop
      embedded += await embedReports(todo.slice(start, start + batchSize));
    } catch (error) {
      logger.warn('Embedding batch failed', { error: error.message });
      break;
    }
  }
  return { considered: todo.length, embedded };
}

// ── search ─────────────────────────────────────────────────────────────────

// After a $vectorSearch error (a cluster without Atlas Search), skip vectors for a while.
const vectorState = { unavailableUntil: 0 };
const VECTOR_RETRY_MS = 10 * 60 * 1000;

function vectorSearchAllowed() {
  if (env.vectorSearch === 'off') return false;
  return Date.now() >= vectorState.unavailableUntil;
}

/** The $vectorSearch pipeline over report embeddings in one area and time window. */
function vectorPipeline({ area, from, to, vector, k = SEMANTIC.k }) {
  return [
    {
      $vectorSearch: {
        index: SEMANTIC.vectorIndex,
        path: 'vec',
        queryVector: vector,
        numCandidates: Math.max(100, k * 10),
        limit: k,
        filter: { area: { $eq: area }, createdAt: { $gte: from, $lte: to } },
      },
    },
    { $project: { _id: 0, reportId: 1, score: { $meta: 'vectorSearchScore' } } },
  ];
}

async function vectorSearch(params) {
  return ReportEmbedding.aggregate(vectorPipeline(params));
}

/** $text search, terms OR'ed (EWDI's full-text fallback). */
async function textSearch({ area, from, to, query, k = SEMANTIC.k }) {
  const terms = (String(query || '').toLowerCase().match(/[a-z0-9]{3,}/g) || []).join(' ');
  if (!terms) return [];
  return Report.find(
    { area, createdAt: { $gte: from, $lte: to }, $text: { $search: terms } },
    { score: { $meta: 'textScore' } }
  ).sort({ score: { $meta: 'textScore' } }).limit(k).lean();
}

const presentMatch = (r, score) => ({
  ref: r.ref,
  text: clip(r.text, 220),
  createdAt: r.createdAt,
  sentiment: r.enrichment?.sentiment ?? null,
  urgency: r.enrichment?.urgency || null,
  topic: r.enrichment?.topic || null,
  score: Math.round((score || 0) * 1000) / 1000,
});

/**
 * Reports in an area and window most like the query. Uses vectors when
 * allowed and the area has at least SEMANTIC.minVectors of them (a query
 * vector is given, or `query` is embedded); falls back to $text.
 *
 * @returns {Promise<{ mode: 'semantic'|'full-text', matches: object[] }>}
 */
async function searchReports({ area, from, to, query, vector, k = SEMANTIC.k, minVectors = SEMANTIC.minVectors }) {
  if (vectorSearchAllowed()) {
    try {
      const count = await ReportEmbedding.countDocuments({ area, createdAt: { $gte: from, $lte: to } });
      let queryVector = vector;
      if (count >= minVectors && !queryVector && query && await embeddingsEnabled()) [queryVector] = await embedTexts([query]);
      if (count >= minVectors && queryVector) {
        const hits = await vectorSearch({ area, from, to, vector: queryVector, k });
        const reports = await Report.find({ _id: { $in: hits.map((h) => h.reportId) } }).lean();
        const byId = new Map(reports.map((r) => [String(r._id), r]));
        return { mode: 'semantic', matches: hits.map((h) => byId.get(String(h.reportId)) && presentMatch(byId.get(String(h.reportId)), h.score)).filter(Boolean) };
      }
    } catch (error) {
      vectorState.unavailableUntil = Date.now() + VECTOR_RETRY_MS;
      logger.warn('Vector search unavailable; using text search', { error: error.message });
    }
  }
  const rows = await textSearch({ area, from, to, query, k });
  return { mode: 'full-text', matches: rows.map((r) => presentMatch(r, r.score)) };
}

module.exports = {
  embedReports,
  embedReportSoon,
  embedPending,
  searchReports,
  vectorPipeline,
  textSearch,
  embedText,
  _internal: { vectorState, vectorSearch },
};
