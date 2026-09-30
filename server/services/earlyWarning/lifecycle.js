const Report = require('../../models/report');
const ReportTopic = require('../../models/reportTopic');
const RiskObject = require('../../models/riskObject');
const RiskScore = require('../../models/riskScore');
const RiskPrecedent = require('../../models/riskPrecedent');
const { nextLifecycle, dayKey, addDays } = require('./scoring');
const { FEATURE_LABELS } = require('../../config/earlyWarning');

/**
 * Risk objects: the same problem is one object across scoring cycles, keyed
 * by area + topic (EWDI resolve_risk_object), with the lifecycle
 * new -> ongoing -> escalated -> resolved -> recurring.
 *
 * Differences from EWDI, on purpose:
 *   - a cycle is one complete day, applied once (re-running is a no-op);
 *   - objects of an area whose topic is no longer the dominant one get a
 *     quiet cycle, so they resolve instead of staying open forever;
 *   - a precedent is written once, when an object resolves.
 */

const DAY_MS = 24 * 3600 * 1000;
const ALERT_LEVELS = ['HIGH', 'CRITICAL'];

/** The topic most of the area's reports in the 7-day window are about. */
async function dominantTopic(area, windowEnd) {
  const to = new Date(windowEnd.getTime() + DAY_MS);
  const from = new Date(windowEnd.getTime() - 6 * DAY_MS);
  const [byTopic] = await Report.aggregate([
    { $match: { area, createdAt: { $gte: from, $lt: to }, topicId: { $ne: null } } },
    { $group: { _id: '$topicId', n: { $sum: 1 } } },
    { $sort: { n: -1, _id: 1 } },
    { $limit: 1 },
  ]);
  if (byTopic) {
    const topic = await ReportTopic.findById(byTopic._id).select('label').lean();
    if (topic) return { topic: topic.label, topicId: topic._id };
  }
  // Without embeddings: the enrichment's intent.
  const [byIntent] = await Report.aggregate([
    { $match: { area, createdAt: { $gte: from, $lt: to }, 'enrichment.intent': { $ne: null } } },
    { $group: { _id: '$enrichment.intent', n: { $sum: 1 } } },
    { $sort: { n: -1, _id: 1 } },
    { $limit: 1 },
  ]);
  return { topic: byIntent ? byIntent._id.replace(/_/g, ' ') : 'general', topicId: null };
}

/** The precedent written when an object resolves: its best-supported cause and what was done. */
async function writePrecedent(object, score) {
  // Required lazily: assessments are added by the investigation graph.
  const RiskAssessment = require('../../models/riskAssessment');
  const latest = await RiskAssessment.findOne({ riskObjectId: object._id, status: 'done' }).sort({ startedAt: -1 }).lean().catch(() => null);
  const best = (latest?.hypotheses || []).slice().sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
  const done = (latest?.recommendations || []).filter((r) => ['approved', 'auto_executed'].includes(r.status)).map((r) => r.action);
  const drivers = (score?.attribution || []).slice(0, 3).map((a) => FEATURE_LABELS[a.feature] || a.feature).join(', ');
  await RiskPrecedent.create({
    riskObjectId: object._id,
    area: object.area,
    cause: best?.cause || `Statistical anomaly in ${object.topic}${drivers ? ` (${drivers})` : ''}.`,
    resolution: done.length ? `${done.join('; ')}. Score then stayed below HIGH for 3 cycles.` : 'Resolved on its own: the score stayed below HIGH for 3 cycles.',
    effective: true,
    ...(object.demo ? { demo: true } : {}),
  });
}

/** Apply one cycle to one object (or create it). Returns the object's new state, or null. */
async function applyCycle({ area, topic, topicId, score, isAlert, windowEnd, riskScore, existing, demo }) {
  if (existing?.lastWindowEnd && existing.lastWindowEnd >= windowEnd) return existing.state; // already applied
  const next = nextLifecycle(existing, { score, isAlert });
  if (!next) return null;
  const now = new Date();
  if (next.create) {
    try {
      await RiskObject.create({
        area, topic, topicId, dedupeKey: `${area}:${topic}`, state: 'new', peakScore: score, currentScore: score,
        lastWindowEnd: windowEnd, firstDetectedAt: now, lastSeenAt: now, ...(demo ? { demo: true } : {}),
      });
    } catch (error) {
      if (error?.code !== 11000) throw error; // created by a concurrent rescan
    }
    return 'new';
  }
  const updated = await RiskObject.findOneAndUpdate(
    { _id: existing._id, $or: [{ lastWindowEnd: null }, { lastWindowEnd: { $lt: windowEnd } }] },
    {
      $set: { state: next.state, currentScore: score, lowStreak: next.lowStreak, riseStreak: next.riseStreak, lastWindowEnd: windowEnd, ...(isAlert ? { lastSeenAt: now } : {}) },
      $max: { peakScore: score },
    },
    { new: true }
  ).lean();
  if (updated && next.writePrecedent) await writePrecedent(updated, riskScore);
  return updated ? next.state : existing.state;
}

/**
 * Advance every area's risk objects by the latest COMPLETE day's score
 * (today is still filling up). Returns [{ area, dedupeKey, state }].
 */
async function advanceAll({ now = new Date(), demo } = {}) {
  const windowEnd = new Date(`${addDays(dayKey(now), -1)}T00:00:00Z`);
  const scores = await RiskScore.find({ windowEnd }).lean();
  const results = [];
  for (const s of scores) {
    const isAlert = ALERT_LEVELS.includes(s.level);
    // eslint-disable-next-line no-await-in-loop
    const { topic, topicId } = await dominantTopic(s.area, windowEnd);
    const key = `${s.area}:${topic}`;
    // eslint-disable-next-line no-await-in-loop
    const objects = await RiskObject.find({ area: s.area }).lean();
    const current = objects.find((o) => o.dedupeKey === key) || null;
    // eslint-disable-next-line no-await-in-loop
    const state = await applyCycle({ area: s.area, topic, topicId, score: s.score, isAlert, windowEnd, riskScore: s, existing: current, demo });
    if (state) results.push({ area: s.area, dedupeKey: key, state });
    // Other open objects of this area: not the problem right now, so a quiet cycle.
    for (const other of objects.filter((o) => o.dedupeKey !== key && o.state !== 'resolved')) {
      // eslint-disable-next-line no-await-in-loop
      const otherState = await applyCycle({ area: s.area, topic: other.topic, score: s.score, isAlert: false, windowEnd, riskScore: s, existing: other, demo });
      results.push({ area: s.area, dedupeKey: other.dedupeKey, state: otherState });
    }
  }
  return results;
}

module.exports = { advanceAll, applyCycle, dominantTopic };
