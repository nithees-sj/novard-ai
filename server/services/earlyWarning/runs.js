const RiskAssessment = require('../../models/riskAssessment');
const RiskStep = require('../../models/riskStep');
const ModelCall = require('../../models/modelCall');
const AreaFeature = require('../../models/areaFeature');
const RiskFeedback = require('../../models/riskFeedback');
const audit = require('../auditService');
const { findAssessment } = require('./recommendations');
const { scoreFeatures } = require('./scores');
const { DIRECTIONS, SLOPES, GRAPH } = require('../../config/earlyWarning');
const { badRequest } = require('../../utils/httpError');
const { integer, oneOf, text } = require('../../utils/validate');

/**
 * Investigation runs as the console sees them: detail, history, the live
 * stream's data, feedback and ad-hoc what-ifs (EWDI /api/alerts/{id}/whatif).
 */

const STALE_MS = GRAPH.staleRunMinutes * 60 * 1000;

/** A run left "running" by a restart is shown as interrupted (Cloud Run can stop an idle instance). */
const present = (a) => (a && a.status === 'running' && Date.now() - new Date(a.startedAt).getTime() > STALE_MS
  ? { ...a, status: 'interrupted' }
  : a);

async function getAssessment(id) {
  const assessment = present(await findAssessment(id));
  const feedback = await RiskFeedback.find({ assessmentId: assessment._id }).lean();
  return { assessment, feedback };
}

async function listRuns(query = {}) {
  const filter = {};
  if (query.area) filter.area = text(query.area, 'Area', { max: 40 });
  const limit = integer(query.limit, 'Limit', { min: 1, max: 100, required: false, fallback: 25 });
  const runs = await RiskAssessment.find(filter).sort({ startedAt: -1 }).limit(limit)
    .select('runId area windowEnd trigger triggeredBy status outcome risk.level risk.score budget degraded startedAt endedAt lanesDone').lean();
  return { runs: runs.map(present) };
}

/** Steps and model calls of a run, optionally only those after a point (for the live view). */
async function runTrace(runId, { afterSeq = 0, afterCallId } = {}) {
  const [assessment, steps, calls] = await Promise.all([
    RiskAssessment.findOne({ runId }).lean(),
    RiskStep.find({ runId, seq: { $gt: afterSeq } }).sort({ seq: 1 }).lean(),
    ModelCall.find({ runId, ...(afterCallId ? { _id: { $gt: afterCallId } } : {}) }).sort({ _id: 1 })
      .select('model provider task tokensIn tokensOut usd latencyMs outcome stepSeq attempt createdAt').lean(),
  ]);
  return { assessment: present(assessment), steps, calls };
}

async function feedback(actor, id, { label, note } = {}, { ip } = {}) {
  const assessment = await findAssessment(id);
  const clean = { label: oneOf(label, 'Label', ['accurate', 'not_accurate']), note: text(note, 'Note', { required: false, max: 1000 }) };
  await RiskFeedback.updateOne({ assessmentId: assessment._id, adminId: actor.email }, { $set: clean }, { upsert: true });
  await audit.record({ actor, action: 'risk.feedback', target: { type: 'assessment', id: assessment.runId }, after: clean, ip });
  return { saved: true };
}

const WHATIF_FEATURES = new Set([...Object.keys(DIRECTIONS), ...Object.keys(SLOPES)]);

/** Re-score the assessment's window with some features multiplied (0-5). */
async function whatIf(id, deltas) {
  const assessment = await findAssessment(id);
  if (!deltas || typeof deltas !== 'object' || Array.isArray(deltas) || !Object.keys(deltas).length) throw badRequest('deltas must be { feature: multiplier }.');
  const row = await AreaFeature.findOne({ area: assessment.area, windowEnd: assessment.windowEnd }).lean();
  if (!row?.f) throw badRequest('This window has no features to re-score.');
  const g = { ...row.f };
  Object.entries(deltas).forEach(([feature, m]) => {
    if (!WHATIF_FEATURES.has(feature)) throw badRequest(`Unknown feature: ${feature}`);
    if (typeof m !== 'number' || !Number.isFinite(m) || m < 0 || m > 5) throw badRequest('Multipliers must be numbers from 0 to 5.');
    if (g[feature] !== null && g[feature] !== undefined) g[feature] *= m;
  });
  const before = scoreFeatures(row.f);
  const after = scoreFeatures(g);
  return { baseScore: before.score, newScore: after.score, baseZ: before.anomalyZ, newZ: after.anomalyZ, attribution: after.attribution.slice(0, 8) };
}

module.exports = { getAssessment, listRuns, runTrace, feedback, whatIf, present };
