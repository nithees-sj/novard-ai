const AreaFeature = require('../../../models/areaFeature');
const RiskScore = require('../../../models/riskScore');
const RiskObject = require('../../../models/riskObject');
const settings = require('../../settingsService');
const { computeFeatures } = require('../features');
const { scoreFeatures } = require('../scores');
const { dominantTopic } = require('../lifecycle');
const { classify } = require('../scoring');
const { complaintDrivers } = require('../complaints');
const { FEATURE_LABELS, HORIZON_DAYS } = require('../../../config/earlyWarning');

/**
 * The deterministic nodes (EWDI app/graph/nodes.py and the predictor/action
 * in build.py). No model calls here: a decision a rule can make must never
 * cost a token.
 */

const ALERT = ['HIGH', 'CRITICAL'];
// The complaint count (when it called for MEDIUM or worse) first, then the baseline signals.
const driversText = (risk) => [
  ...complaintDrivers(risk?.complaints).map((d) => `${d.label} from ${d.reporters} students`),
  ...(risk?.attribution || []).slice(0, 5).map((a) => `${FEATURE_LABELS[a.feature] || a.feature} ${a.z >= 0 ? '+' : ''}${Number(a.z).toFixed(1)}σ`),
].join(', ');

async function buildFeatures(state) {
  let row = await AreaFeature.findOne({ area: state.area, windowEnd: state.windowEnd }).lean();
  if (!row) {
    await computeFeatures({ now: new Date(state.windowEnd.getTime() + 12 * 3600 * 1000), recomputeDays: 1 });
    row = await AreaFeature.findOne({ area: state.area, windowEnd: state.windowEnd }).lean();
  }
  if (!row?.f) return { features: {}, runErrors: ['no features for this window'], _trace: 'no features' };
  return { features: row.f, _trace: `${Object.keys(row.f).filter((k) => !k.includes('__')).length} features for ${state.windowEnd.toISOString().slice(0, 10)}` };
}

async function scoreRisk(state) {
  const row = await RiskScore.findOne({ area: state.area, windowEnd: state.windowEnd }).lean();
  let risk;
  if (row) {
    risk = { score: row.score, level: row.level, anomalyZ: row.anomalyZ, attribution: row.attribution, status: row.status, complaints: row.complaints || null };
  } else {
    const s = scoreFeatures(state.features);
    const { fixed } = await settings.get('risk.thresholds');
    risk = { score: s.score, level: classify(s.score, fixed), anomalyZ: s.anomalyZ, attribution: s.attribution, status: 'scored' };
  }
  return { risk, _trace: `${risk.level} ${risk.score.toFixed(3)}: ${driversText(risk)}` };
}

/**
 * The risk's identity (EWDI resolve_risk_object). The scoring pass advances
 * the lifecycle once per day; here the object is only looked up, or created
 * when a HIGH/CRITICAL risk has none yet (the next scoring cycle applies to it).
 */
async function resolveRiskObject(state) {
  const { topic, topicId } = await dominantTopic(state.area, state.windowEnd);
  const dedupeKey = `${state.area}:${topic}`;
  let object = await RiskObject.findOne({ dedupeKey }).lean();
  if (!object && ALERT.includes(state.risk?.level)) {
    try {
      object = (await RiskObject.create({
        area: state.area, topic, topicId, dedupeKey, state: 'new', peakScore: state.risk.score, currentScore: state.risk.score,
      })).toObject();
    } catch (error) {
      if (error?.code !== 11000) throw error;
      object = await RiskObject.findOne({ dedupeKey }).lean();
    }
  }
  if (!object) return { riskObjectId: null, riskState: null, _trace: `${state.risk?.level}: no risk object` };
  return { riskObjectId: object._id, riskState: object.state, _trace: `${dedupeKey} -> ${object.state}` };
}

/** Conditional edge, not an agent. */
const routeByLevel = (state) => (ALERT.includes(state.risk?.level) ? 'supervisor' : 'updateMonitor');

async function updateMonitor(state) {
  return { next: 'end', _trace: `monitoring ${state.area} at ${state.risk?.level || 'unknown'}: no investigation needed` };
}

// ── predictor: outcomes by re-scoring perturbed features (never imagined by a model) ──

/** Change features and re-score. `change(f)` edits a copy. */
function rescore(f, change) {
  const g = { ...f };
  change(g);
  return scoreFeatures(g);
}

const toBaseline = (g, m) => { if (g[`${m}__base_median`] !== null && g[`${m}__base_median`] !== undefined) g[m] = g[`${m}__base_median`]; };

const SCENARIOS = {
  'resolve the open backlog': (g) => {
    if (g.pct_unresolved !== null && g.pct_unresolved !== undefined) g.pct_unresolved = 0;
    toBaseline(g, 'p50_first_response_h');
    toBaseline(g, 'p90_first_response_h');
    if (g.unresolved_slope !== null && g.unresolved_slope !== undefined) g.unresolved_slope = 0;
  },
  'AI error rate back to baseline': (g) => {
    toBaseline(g, 'ai_error_rate');
    toBaseline(g, 'ai_429_rate');
    if (g.ai_error_slope !== null && g.ai_error_slope !== undefined) g.ai_error_slope = 0;
  },
  'report volume +30%': (g) => {
    if (g.n_reports !== null && g.n_reports !== undefined) g.n_reports *= 1.3;
    if (g.n_reporters !== null && g.n_reporters !== undefined) g.n_reporters *= 1.3;
  },
};

function predict(features = {}, risk = {}) {
  const base = Number(risk.score || 0);
  const whatif = Object.fromEntries(Object.entries(SCENARIOS).map(([label, change]) => [label, Math.round(rescore(features, change).score * 10000) / 10000]));
  // EWDI: the base score nudged by the volume trend. No trained model.
  const trend = Number(features.volume_slope || 0);
  const pIncident = Math.max(0, Math.min(1, base + (trend > 0 ? 0.05 : -0.05)));
  return {
    horizonDays: HORIZON_DAYS,
    pIncident: Math.round(pIncident * 10000) / 10000,
    baseScore: Math.round(base * 10000) / 10000,
    whatif,
    method: 'anomaly re-score (no trained model)',
  };
}

async function predictor(state) {
  const prediction = predict(state.features || {}, state.risk || {});
  return { prediction, _trace: `p_incident ${prediction.pIncident}; ${Object.entries(prediction.whatif).map(([k, v]) => `${k}: ${v}`).join('; ')}` };
}

async function action(state) {
  const recs = state.recommendations || [];
  const auto = recs.filter((r) => r.execution === 'auto').length;
  const manual = recs.filter((r) => r.status === 'awaiting_approval').length;
  return { next: 'end', _trace: `${auto} auto (internal), ${manual} awaiting approval, ${recs.length - auto - manual} advice` };
}

module.exports = { buildFeatures, scoreRisk, resolveRiskObject, routeByLevel, updateMonitor, predictor, action, predict, driversText, SCENARIOS, rescore };
