const Report = require('../models/report');
const settings = require('./settingsService');
const { activeAreas } = require('./reportAreas');
const { callJson } = require('../ai/modelGateway');
const { runWithAi } = require('../ai/aiContext');
const { ENRICH, REPORTS } = require('../config/earlyWarning');
const logger = require('../utils/logger');

/**
 * Report triage (EWDI ingest/intake.py enrich_one + enrich.py): area, urgency,
 * sentiment, intent, a short topic and whether the student says it happened
 * before. Runs right after a report is saved; if the model is unavailable the
 * report stays `pending` and `npm run reports:enrich` picks it up later.
 */

const DAY_MS = 24 * 3600 * 1000;

function systemPrompt(areaIds) {
  return `You triage problem reports that students send about Novard-AI, a learning platform (notes and PDF chat, video summaries and a video library, quizzes, doubt clearance, a skill unlocker, career roadmaps, a skill-gap coach, an AI forum and the Novard Agent).

For each report return:
- area: the part of the app the problem is in, one of: ${areaIds.join(', ')}. Use "other" only if none fits.
- urgency: "high" only if the student cannot use a feature at all, lost work, or cannot sign in; "medium" if a feature works badly; "low" for cosmetic problems and suggestions.
- sentiment: a number from -1 (furious) to 1 (happy). Most complaints are between -0.8 and -0.2.
- intent: "bug" (something is broken), "wrong_ai_answer" (an AI answer, summary or quiz question was wrong), "content_quality" (unhelpful or poor, but not wrong), "feature_request", "account" (sign-in, profile, data), or "other".
- topic: a 2-4 word lowercase noun phrase naming the concrete problem, e.g. "missing video captions", "wrong quiz answer".
- isRepeat: true only if the text says they reported or hit this problem before.

Reply with JSON only.`;
}

const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

/** What the model reads for one report. */
function reportText(report, limit) {
  const parts = [`Filed under: ${report.area}`, `Report: ${clip(report.text, limit)}`];
  if (report.transcript) parts.push(`Voice note: ${clip(report.transcript, limit)}`);
  if (report.source?.excerpt) parts.push(`The AI output they are reporting: ${clip(report.source.excerpt, Math.min(limit, 800))}`);
  if (report.pdfText) parts.push(`Attached PDF (start): ${clip(report.pdfText, 300)}`);
  return parts.join('\n');
}

/** Turn whatever the model returned into clean values (Groq JSON mode has no strict schema). */
function clean(raw, areaIds) {
  const pick = (value, allowed, fallback) => {
    const v = String(value || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
    return allowed.find((a) => a.replace(/-/g, '_') === v) || fallback;
  };
  const sentiment = Number(raw?.sentiment);
  return {
    suggestedArea: pick(raw?.area, areaIds, null),
    urgency: pick(raw?.urgency, ENRICH.urgencies, 'medium'),
    sentiment: Number.isFinite(sentiment) ? Math.max(-1, Math.min(1, sentiment)) : 0,
    intent: pick(raw?.intent, ENRICH.intents, 'other'),
    topic: clip(raw?.topic, 80).toLowerCase() || null,
    isRepeat: raw?.isRepeat === true || raw?.isRepeat === 'true',
  };
}

/** Did the student already report in this area recently? (a signal that does not need a model) */
async function reportedBefore(report) {
  return Boolean(await Report.exists({
    userId: report.userId,
    area: report.area,
    _id: { $ne: report._id },
    createdAt: { $gte: new Date(new Date(report.createdAt).getTime() - ENRICH.repeatWindowDays * DAY_MS), $lt: report.createdAt },
  }));
}

/**
 * Move an open report filed under "other" to the area the model found,
 * taking a free quota slot there. Keeps "other" when the student has no slot
 * left in that area.
 */
async function moveArea(report, area) {
  if (!report.open) {
    await Report.updateOne({ _id: report._id }, { $set: { area, routedBy: 'model' } });
    return true;
  }
  const { maxOpenPerArea } = await settings.get('reports');
  for (let slot = 0; slot < maxOpenPerArea; slot += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const { modifiedCount } = await Report.updateOne({ _id: report._id, open: true }, { $set: { area, quotaSlot: slot, routedBy: 'model' } });
      return modifiedCount > 0;
    } catch (error) {
      if (error?.code !== 11000) throw error; // slot taken: try the next
    }
  }
  return false;
}

async function applyEnrichment(report, values, model) {
  const isRepeat = values.isRepeat || await reportedBefore(report);
  await Report.updateOne({ _id: report._id }, {
    $set: {
      'enrichment.status': 'done',
      'enrichment.intent': values.intent,
      'enrichment.urgency': values.urgency,
      'enrichment.sentiment': values.sentiment,
      'enrichment.topic': values.topic,
      'enrichment.isRepeat': isRepeat,
      'enrichment.suggestedArea': values.suggestedArea,
      'enrichment.model': model,
      'enrichment.promptVersion': ENRICH.promptVersion,
      'enrichment.at': new Date(),
      'enrichment.error': null,
    },
    $inc: { 'enrichment.attempts': 1 },
  });
  if (report.area === 'other' && values.suggestedArea && values.suggestedArea !== 'other') {
    await moveArea(report, values.suggestedArea);
  }
}

async function markFailed(ids, error) {
  await Report.updateMany({ _id: { $in: ids } }, {
    $set: { 'enrichment.status': 'failed', 'enrichment.error': String(error?.message || error).slice(0, 200) },
    $inc: { 'enrichment.attempts': 1 },
  });
}

/** Enrich one report now. Never throws: a failure leaves it for the batch pass. */
async function enrichOne(report) {
  const areaIds = (await activeAreas()).map((a) => a.id);
  try {
    const { data, model } = await runWithAi({ feature: 'reports.enrich', area: report.area, userId: report.userId }, () => callJson({
      task: 'report_enrich',
      system: systemPrompt(areaIds),
      user: `${reportText(report, 4000)}\n\nReturn {"area","urgency","sentiment","intent","topic","isRepeat"}.`,
      maxTokens: 400,
      temperature: 0,
    }));
    await applyEnrichment(report, clean(data, areaIds), model);
    return true;
  } catch (error) {
    logger.warn('Report enrichment failed; it will be retried by the batch pass', { ref: report.ref, error: error.message });
    await markFailed([report._id], error);
    return false;
  }
}

/**
 * Batch pass (npm run reports:enrich): reports still pending or failed, oldest
 * first, `batchSize` per model call. Resumable: each batch is saved as it
 * completes. Returns counts.
 */
async function enrichPending({ limit = 500, batchSize = REPORTS.enrichBatchSize, maxAttempts = 5 } = {}) {
  const areaIds = (await activeAreas()).map((a) => a.id);
  const todo = await Report.find({ 'enrichment.status': { $in: ['pending', 'failed'] }, 'enrichment.attempts': { $lt: maxAttempts } })
    .sort({ createdAt: 1 }).limit(limit).lean();
  let done = 0;
  let failed = 0;
  for (let start = 0; start < todo.length; start += batchSize) {
    const batch = todo.slice(start, start + batchSize);
    const listing = batch.map((r, i) => `${i}. ${reportText(r, 500).replace(/\n/g, ' | ')}`).join('\n\n');
    try {
      // Sequential on purpose: Groq allows ~8k tokens a minute.
      // eslint-disable-next-line no-await-in-loop
      const { data, model } = await runWithAi({ feature: 'reports.enrich' }, () => callJson({
        task: 'report_enrich',
        system: systemPrompt(areaIds),
        user: `Analyse these ${batch.length} reports:\n\n${listing}\n\nReturn {"items": [{"i": <number>, "area", "urgency", "sentiment", "intent", "topic", "isRepeat"}, ...]} with one item per report.`,
        maxTokens: 120 * batch.length + 200,
        temperature: 0,
      }));
      const items = Array.isArray(data.items) ? data.items : [];
      const byIndex = new Map(items.map((item) => [Number(item?.i), item]));
      for (const [i, report] of batch.entries()) {
        const item = byIndex.get(i);
        if (!item) {
          // eslint-disable-next-line no-await-in-loop
          await markFailed([report._id], 'missing from the batch reply');
          failed += 1;
          continue;
        }
        // eslint-disable-next-line no-await-in-loop
        await applyEnrichment(report, clean(item, areaIds), model);
        done += 1;
      }
    } catch (error) {
      logger.warn('Enrichment batch failed', { error: error.message });
      // eslint-disable-next-line no-await-in-loop
      await markFailed(batch.map((r) => r._id), error);
      failed += batch.length;
      if (error?.code === 'AI_UNAVAILABLE' || error?.status === 503) break; // no point hammering a down provider
    }
  }
  return { considered: todo.length, done, failed };
}

module.exports = { enrichOne, enrichPending, clean, moveArea, reportedBefore, _internal: { systemPrompt, reportText } };
