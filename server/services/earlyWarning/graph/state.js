const { Annotation } = require('@langchain/langgraph');

/**
 * The investigation's state (EWDI app/graph/state.py).
 *
 * Only `evidence`, `lanesDone`, `runErrors` and `usage` are written by more
 * than one node, and all four have reducers (append / sum). That is what makes
 * the parallel lane fan-out safe without any locking.
 */

const last = (a, b) => (b === undefined ? a : b);
const replace = (initial) => Annotation({ reducer: last, default: () => initial });
const append = () => Annotation({ reducer: (a, b) => a.concat(b || []), default: () => [] });

/** Sums model spend from nodes running in parallel (EWDI merge_usage). */
const sumUsage = (a = {}, b = {}) => ({
  usd: (a.usd || 0) + (b.usd || 0),
  tokens: (a.tokens || 0) + (b.tokens || 0),
  calls: (a.calls || 0) + (b.calls || 0),
});

const RiskState = Annotation.Root({
  runId: replace(''),
  area: replace(''),
  areaLabel: replace(''),
  windowEnd: replace(null), // Date (UTC midnight)
  features: replace(null),
  risk: replace(null), // { score, level, anomalyZ, attribution, status }
  riskObjectId: replace(null),
  riskState: replace(null),

  evidence: append(), // [{ id, lane, kind, summary, citeIds, data }], the fan-in point
  lanesDone: append(),
  runErrors: append(),
  usage: Annotation({ reducer: sumUsage, default: () => ({ usd: 0, tokens: 0, calls: 0 }) }),

  chosenLanes: replace([]),
  supervisorReason: replace(''),
  hypotheses: replace([]),
  recommendations: replace([]),
  rootCauseModel: replace(null),
  verification: replace(null),
  revisionCount: replace(0),
  prediction: replace(null),
  loopCount: replace(0),
  budget: replace({ usdMax: 0, tokensMax: 0, laneConcurrency: 2 }), // caps off unless an admin sets them
  degraded: replace(false),
  next: replace(null),
});

module.exports = { RiskState, sumUsage };
