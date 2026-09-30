const AreaFeature = require('../../models/areaFeature');
const RiskScore = require('../../models/riskScore');
const settings = require('../settingsService');
const { scoreWindow, levelsFromPercentiles, classify, dayKey, addDays } = require('./scoring');
const EW = require('../../config/earlyWarning');

/**
 * Feature windows -> risk scores and levels (EWDI app/risk/anomaly.py
 * score_all). Zero labels: an area is scored against its own baseline.
 *
 * Levels: percentile cut-offs over the observed scores (P85/P95/P99) once
 * there is enough history; fixed thresholds before that, and always for an
 * area whose baseline is too thin (`insufficient_baseline`).
 */

const sigmoid = (x) => 1 / (1 + Math.exp(-x));

/** The scoring configuration Novard runs EWDI's scorer with. */
const SCORE_CFG = {
  directions: EW.DIRECTIONS,
  slopes: EW.SLOPES,
  absFloors: EW.ABS_FLOORS,
  relFloor: EW.ANOMALY.relFloor,
  clip: EW.ANOMALY.clip,
  topK: EW.ANOMALY.topK,
};

/** Score one feature vector (no thresholds). */
const scoreFeatures = (f) => scoreWindow(f || {}, SCORE_CFG);

/** Percentile thresholds, never below the minimum anomaly for each level. */
function percentileThresholds(scores, percentiles) {
  const raw = levelsFromPercentiles(scores, percentiles);
  return Object.fromEntries(Object.entries(raw).map(([level, v]) => [level, Math.max(v, sigmoid(EW.LEVEL_MIN_Z[level] - 2))]));
}

/**
 * The thresholds in force: { thresholds, from: 'percentile'|'fixed' }.
 * `scores` are the observed scores of areas with a full baseline.
 */
function thresholdsFor(scores, config) {
  if (scores.length >= config.minScoredWindows) return { thresholds: percentileThresholds(scores, config.percentiles), from: 'percentile' };
  return { thresholds: config.fixed, from: 'fixed' };
}

/**
 * Score every stored window of the last HISTORY_DAYS and upsert its level.
 * Idempotent. Returns counts and the thresholds used.
 */
async function scoreAll({ now = new Date(), demo } = {}) {
  const since = new Date(`${addDays(dayKey(now), -EW.HISTORY_DAYS)}T00:00:00Z`);
  const [rows, thresholdConfig, coldStart] = await Promise.all([
    AreaFeature.find({ windowEnd: { $gte: since } }).sort({ windowEnd: 1 }).lean(),
    settings.get('risk.thresholds'),
    settings.get('risk.coldStart'),
  ]);

  const scored = rows.map((row) => {
    const s = scoreFeatures(row.f);
    const status = row.baselineActiveDays >= coldStart.minBaselineActiveDays ? 'scored' : 'insufficient_baseline';
    return { row, ...s, status };
  });
  const { thresholds, from } = thresholdsFor(scored.filter((s) => s.status === 'scored').map((s) => s.score), thresholdConfig);

  const ops = scored.map((s) => {
    const useFixed = s.status === 'insufficient_baseline';
    const level = classify(s.score, useFixed ? thresholdConfig.fixed : thresholds);
    return {
      updateOne: {
        filter: { area: s.row.area, windowEnd: s.row.windowEnd },
        update: {
          $set: {
            anomalyZ: s.anomalyZ,
            score: s.score,
            level,
            attribution: s.attribution,
            status: s.status,
            levelsFrom: useFixed ? 'fixed' : from,
            modelVersion: 'anomaly-v1',
            ...(demo !== undefined ? { demo } : {}),
          },
        },
        upsert: true,
      },
    };
  });
  if (ops.length) await RiskScore.bulkWrite(ops, { ordered: false });
  return { scored: ops.length, thresholds, levelsFrom: from };
}

module.exports = { scoreAll, scoreFeatures, thresholdsFor, percentileThresholds, SCORE_CFG };
