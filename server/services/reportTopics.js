const Report = require('../models/report');
const ReportEmbedding = require('../models/reportEmbedding');
const ReportTopic = require('../models/reportTopic');
const { greedyCluster, cosine } = require('./earlyWarning/clustering');
const { TOPICS } = require('../config/earlyWarning');

/**
 * Topics: similar reports within an area, grouped by EWDI's greedy cosine
 * clustering. Unlike EWDI's nightly full rebuild, a re-cluster keeps the id
 * and label of a topic whose centroid barely moved, so risk objects (keyed by
 * area + topic) do not reset every time new reports arrive.
 */

const DAY_MS = 24 * 3600 * 1000;

function mostCommon(values) {
  const counts = new Map();
  values.filter(Boolean).forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0]?.[0] || null;
}

/** Re-cluster one area's recent reports. Returns { area, topics, assigned }. */
async function reclusterArea(area, { now = new Date(), settings = TOPICS } = {}) {
  const since = new Date(now.getTime() - settings.windowDays * DAY_MS);
  const rows = await ReportEmbedding.find({ area, createdAt: { $gte: since, $lte: now } }).sort({ createdAt: 1, _id: 1 }).lean();
  if (rows.length < settings.minCluster) return { area, topics: 0, assigned: 0 };

  const { centroids, assign, keep } = greedyCluster(rows.map((r) => r.vec), settings);
  const reports = await Report.find({ _id: { $in: rows.map((r) => r.reportId) } }).select('enrichment.topic enrichment.intent').lean();
  const labelsById = new Map(reports.map((r) => [String(r._id), r.enrichment?.topic || r.enrichment?.intent?.replace(/_/g, ' ') || null]));

  // Match new clusters to existing topics (one-to-one, closest first).
  const existing = await ReportTopic.find({ area }).lean();
  const pairs = [];
  keep.forEach((k) => existing.forEach((t) => {
    if (t.centroid?.length === centroids[k].length) pairs.push({ k, topic: t, sim: cosine(centroids[k], t.centroid) });
  }));
  pairs.sort((a, b) => b.sim - a.sim);
  const matched = new Map();
  const used = new Set();
  pairs.forEach(({ k, topic, sim }) => {
    if (sim >= settings.keepIdAbove && !matched.has(k) && !used.has(String(topic._id))) {
      matched.set(k, topic);
      used.add(String(topic._id));
    }
  });

  const topicIdFor = new Map();
  for (const k of keep) {
    const members = rows.filter((_, i) => assign[i] === k);
    const label = matched.get(k)?.label || mostCommon(members.map((m) => labelsById.get(String(m.reportId)))) || `cluster ${k + 1}`;
    const fields = { area, label: label.slice(0, 80), centroid: centroids[k], recordCount: members.length };
    const topic = matched.has(k)
      // eslint-disable-next-line no-await-in-loop
      ? await ReportTopic.findByIdAndUpdate(matched.get(k)._id, { $set: fields }, { new: true }).lean()
      // eslint-disable-next-line no-await-in-loop
      : await ReportTopic.create({ ...fields, firstSeenAt: members[0]?.createdAt || now });
    topicIdFor.set(k, topic._id);
  }

  // Point every embedding and report at its topic (none for dropped clusters).
  const byTopic = new Map();
  rows.forEach((row, i) => {
    const id = topicIdFor.get(assign[i]) || null;
    const key = String(id);
    byTopic.set(key, { id, reportIds: [...(byTopic.get(key)?.reportIds || []), row.reportId] });
  });
  await Promise.all([...byTopic.values()].flatMap(({ id, reportIds }) => [
    ReportEmbedding.updateMany({ reportId: { $in: reportIds } }, id ? { $set: { topicId: id } } : { $unset: { topicId: 1 } }),
    Report.updateMany({ _id: { $in: reportIds } }, id ? { $set: { topicId: id } } : { $unset: { topicId: 1 } }),
  ]));
  await ReportTopic.deleteMany({ area, _id: { $nin: [...topicIdFor.values()] } });

  return { area, topics: keep.length, assigned: rows.filter((_, i) => topicIdFor.has(assign[i])).length };
}

/** Re-cluster every area that has embeddings. */
async function reclusterAll(options = {}) {
  const areas = await ReportEmbedding.distinct('area');
  const results = [];
  for (const area of areas) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await reclusterArea(area, options));
  }
  return results;
}

module.exports = { reclusterArea, reclusterAll, mostCommon };
