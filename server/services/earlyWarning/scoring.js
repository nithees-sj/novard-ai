/**
 * Early-warning scoring: a faithful, pure and dependency-free port of EWDI
 *   app/features/compute.py   build_features, slope, the daily series rules
 *   app/risk/anomaly.py       robust_z, score_window, levels_from_percentiles, classify
 *   app/risk/escalation.py    detect (one alert per escalation episode)
 *   app/graph/nodes.py        resolve_risk_object's lifecycle state machine
 *
 * Every constant is a parameter (defaults = EWDI's), so the golden tests can
 * run it with EWDI's exact settings while Novard passes its own tuned values
 * from config/earlyWarning.js. Checked against outputs of the Python
 * functions in tests/unit/earlyWarningGolden.test.js.
 */

const DAY_MS = 24 * 3600 * 1000;

// ── small statistics (numpy semantics) ─────────────────────────────────────

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

/** np.median: the middle value, or the mean of the two middle values. */
function median(a) {
  const s = [...a].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median absolute deviation (unscaled), as EWDI computes it. */
function mad(a) {
  const m = median(a);
  return median(a.map((x) => Math.abs(x - m)));
}

/** np.percentile with the default linear interpolation. */
function percentile(a, p) {
  const s = [...a].sort((x, y) => x - y);
  if (!s.length) return NaN;
  const rank = (p / 100) * (s.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return s[lo] + (s[hi] - s[lo]) * (rank - lo);
}

/** OLS slope of the values over their index (np.polyfit(x, y, 1)[0]); 0 for fewer than 3 points. */
function slope(values) {
  if (values.length < 3) return 0;
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = mean(values);
  let num = 0;
  let den = 0;
  values.forEach((y, x) => {
    num += (x - xMean) * (y - yMean);
    den += (x - xMean) ** 2;
  });
  return num / den;
}

// ── features (compute.py) ───────────────────────────────────────────────────

/** 'YYYY-MM-DD' for a Date (UTC). */
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
const addDays = (key, n) => dayKey(new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS));

/**
 * The metric's values for each day in [lo, hi] (compute.py _series).
 * Count metrics: a missing day is 0. Rate metrics: a day is used only when it
 * has at least `min` events of its gate metric (a median over 3 messages is
 * noise, not an outage); missing days are simply absent.
 *
 * @param {Object<string, object>} days   { 'YYYY-MM-DD': { metric: value } }
 * @param {{ name, kind: 'count'|'rate', gate?: string, min?: number }} metric
 */
function series(days, lo, hi, metric, dataStart) {
  const values = [];
  // Days before anything was measured are unknown, not zero (see buildFeatures).
  const first = dataStart && dataStart > lo ? dataStart : lo;
  for (let d = first; d <= hi; d = addDays(d, 1)) {
    const rec = days[d];
    const isCount = metric.kind === 'count';
    if (!rec) {
      if (isCount) values.push(0);
      continue;
    }
    const v = rec[metric.name];
    if (v === null || v === undefined) {
      if (isCount) values.push(0);
    } else if (isCount || (rec[metric.gate] || 0) >= (metric.min || 0)) {
      values.push(Number(v));
    }
  }
  return values;
}

/**
 * Feature vector for one window (compute.py build_features): the window's
 * mean of each metric, the baseline's median and MAD, and slopes.
 * The window is the last `windowDays` days; the baseline is the rest of the
 * `baselineDays` span before it (EWDI: 7-day window, 21-day baseline).
 *
 * @param {object} cfg { metrics: [...], slopes: [{ name, metric, nullIfEmpty }], windowDays, baselineDays,
 *   enriched: names of the metrics that need enrichment (for has_enrichment),
 *   dataStart: 'YYYY-MM-DD' of the first day anything was measured. EWDI only
 *     scores windows 28 days after its corpus starts; Novard starts from zero on
 *     launch day, so days before this count as missing rather than as quiet
 *     days (otherwise the first real reports look like a spike). }
 * @returns {object|null} null when the span is too short for a baseline
 */
function buildFeatures(days, windowEnd, cfg) {
  const { metrics, slopes = [], windowDays = 7, baselineDays = 28, enriched = [], dataStart } = cfg;
  const winLo = addDays(windowEnd, -(windowDays - 1));
  const baseHi = addDays(winLo, -1);
  const baseLo = addDays(windowEnd, -baselineDays);
  if (baseLo > baseHi) return null;

  const f = {};
  metrics.forEach((m) => {
    const win = series(days, winLo, windowEnd, m, dataStart);
    const base = series(days, baseLo, baseHi, m, dataStart);
    f[m.name] = win.length ? mean(win) : null;
    f[`${m.name}__base_median`] = base.length ? median(base) : null;
    f[`${m.name}__base_mad`] = base.length >= 3 ? mad(base) : null;
  });

  const byName = Object.fromEntries(metrics.map((m) => [m.name, m]));
  slopes.forEach(({ name, metric, nullIfEmpty }) => {
    const values = series(days, winLo, windowEnd, byName[metric], dataStart);
    f[name] = nullIfEmpty && !values.length ? null : slope(values);
  });
  f.window_days = windowDays;
  f.has_enrichment = enriched.some((m) => f[m] !== null && f[m] !== undefined);
  return f;
}

// ── scoring (anomaly.py) ────────────────────────────────────────────────────

const EWDI = {
  relFloor: 0.25,
  absFloor: 1e-3,
  clip: 6,
  topK: 3,
};

/**
 * Median/MAD z, signed by the caller: scale = max(1.4826*MAD, relFloor*|median|, absFloor),
 * clipped to +/-clip. The floors stop a baseline that barely moves from turning
 * any wobble into +20 sigma.
 */
function robustZ(value, med, madValue, { relFloor = EWDI.relFloor, absFloor = EWDI.absFloor, clip = EWDI.clip } = {}) {
  const scale = Math.max(1.4826 * madValue, relFloor * Math.abs(med), absFloor);
  const z = (value - med) / scale;
  return Math.max(-clip, Math.min(clip, z));
}

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const round = (x, dp) => Math.round(x * 10 ** dp) / 10 ** dp;

/**
 * anomaly_z = mean of the top-K positive signed deviations; score =
 * sigmoid(anomaly_z - 2); attribution = each feature's z and share of the
 * total |z|, largest first.
 *
 * @param {object} f features (buildFeatures output)
 * @param {object} cfg {
 *   directions: { feature: +1|-1 }            +1 = higher is worse
 *   slopes:     { slopeName: [metric, dir] }  compared against the metric's baseline scale
 *   absFloors:  { feature: number }           per-feature absolute floor (Novard); default absFloor
 *   relFloor, absFloor, clip, topK }
 */
function scoreWindow(f, cfg) {
  const { directions, slopes = {}, absFloors = {}, relFloor = EWDI.relFloor, absFloor = EWDI.absFloor, clip = EWDI.clip, topK = EWDI.topK } = cfg;
  const contribs = {};
  const present = (x) => x !== null && x !== undefined;

  Object.entries(directions).forEach(([feat, dir]) => {
    const v = f[feat];
    const med = f[`${feat}__base_median`];
    const m = f[`${feat}__base_mad`];
    if (!present(v) || !present(med) || !present(m)) return;
    contribs[feat] = dir * robustZ(Number(v), Number(med), Number(m), { relFloor, absFloor: absFloors[feat] ?? absFloor, clip });
  });

  Object.entries(slopes).forEach(([feat, [base, dir]]) => {
    const v = f[feat];
    const m = f[`${base}__base_mad`];
    const med = f[`${base}__base_median`];
    if (!present(v) || !present(m)) return;
    const scale = Math.max(1.4826 * Number(m), relFloor * Math.abs(Number(med || 0)), absFloors[base] ?? absFloor);
    contribs[feat] = Math.max(-clip, Math.min(clip, (dir * Number(v)) / scale));
  });

  const positive = Object.values(contribs).filter((c) => c > 0).sort((a, b) => b - a);
  const anomalyZ = positive.length ? mean(positive.slice(0, topK)) : 0;
  const score = sigmoid(anomalyZ - 2);
  const total = Object.values(contribs).reduce((s, c) => s + Math.abs(c), 0) || 1;
  const attribution = Object.entries(contribs)
    .map(([feature, z]) => ({ feature, z: round(z, 3), share: round(z / total, 4) }))
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  return { anomalyZ, score, attribution };
}

/** Thresholds by percentile of the observed scores (EWDI LEVEL_PERCENTILES 85/95/99). */
function levelsFromPercentiles(scores, percentiles = { CRITICAL: 99, HIGH: 95, MEDIUM: 85 }) {
  return Object.fromEntries(Object.entries(percentiles).map(([level, p]) => [level, percentile(scores, p)]));
}

function classify(score, thresholds) {
  if (score >= thresholds.CRITICAL) return 'CRITICAL';
  if (score >= thresholds.HIGH) return 'HIGH';
  if (score >= thresholds.MEDIUM) return 'MEDIUM';
  return 'LOW';
}

// ── escalation (escalation.py) ──────────────────────────────────────────────

const RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
const ALERT_FLOOR = RANK.HIGH;

/**
 * The alerts an area's score history calls for (escalation.py detect):
 * one at the start of the current HIGH-or-worse episode, plus one for each
 * later worsening within it. Only an area still elevated in its latest window
 * alerts. Alerts are unique on (area, windowEnd, level), so re-running never
 * re-alerts.
 *
 * @param {Array<{windowEnd, level, score, attribution}>} rows  oldest first
 * @returns {Array<{ row, prevLevel, prevScore }>}
 */
function detectEscalations(rows) {
  if (!rows.length) return [];
  const rank = (r) => RANK[r.level] || 0;
  const latest = rows[rows.length - 1];
  if (rank(latest) < ALERT_FLOOR) return [];

  let i = rows.length - 1;
  while (i > 0 && rank(rows[i - 1]) >= ALERT_FLOOR) i -= 1;
  const episode = rows.slice(i);
  const prevLevel = i > 0 ? rows[i - 1].level : null;
  const prevScore = i > 0 ? Number(rows[i - 1].score) : null;

  const marks = [{ row: episode[0], prevLevel, prevScore }];
  let worst = rank(episode[0]);
  for (let k = 1; k < episode.length; k += 1) {
    if (rank(episode[k]) > worst) {
      marks.push({ row: episode[k], prevLevel: episode[k - 1].level, prevScore: Number(episode[k - 1].score) });
      worst = rank(episode[k]);
    }
  }
  return marks;
}

/** The alert text (escalation.py _message). */
function alertMessage(name, level, prev, score, drivers = []) {
  const top = drivers.slice(0, 3).map((d) => `${d.feature} ${d.z >= 0 ? '+' : ''}${d.z.toFixed(1)}σ`).join(', ') || 'no single driver';
  const moved = prev ? `${prev} → ${level}` : `now ${level}`;
  return `${name} risk has risen (${moved}, score ${Number(score).toFixed(3)}). Driven by ${top}.`;
}

// ── risk-object lifecycle (nodes.py resolve_risk_object) ────────────────────

/**
 * The next lifecycle state of a risk object after one scoring cycle.
 *   new -> ongoing -> escalated (rose in 2 alerting cycles) -> resolved
 *   (3 cycles below HIGH) -> recurring (alerting again after resolving).
 * `riseStreak` counts rises while alerting (cumulative, as in EWDI); both
 * streaks reset when the other condition holds.
 *
 * @param {object|null} existing { state, currentScore, lowStreak, riseStreak } or null
 * @returns {{ create: boolean, state, lowStreak, riseStreak, writePrecedent: boolean }|null}
 *   null when there is no object and nothing to create.
 */
function nextLifecycle(existing, { score, isAlert }) {
  if (!existing) {
    if (!isAlert) return null;
    return { create: true, state: 'new', lowStreak: 0, riseStreak: 0, writePrecedent: false };
  }
  const rising = (existing.riseStreak || 0) + (score > Number(existing.currentScore) ? 1 : 0);
  const low = (existing.lowStreak || 0) + (isAlert ? 0 : 1);
  const wasResolved = existing.state === 'resolved';

  let state;
  if (wasResolved && isAlert) state = 'recurring';
  else if (low >= 3) state = 'resolved';
  else if (rising >= 2 && isAlert) state = 'escalated';
  else if (isAlert) state = 'ongoing';
  else state = existing.state;

  return {
    create: false,
    state,
    lowStreak: isAlert ? 0 : low,
    riseStreak: isAlert ? rising : 0,
    // EWDI inserts a precedent on every low cycle after resolving; only the transition counts here.
    writePrecedent: state === 'resolved' && !wasResolved,
  };
}

module.exports = {
  mean,
  median,
  mad,
  percentile,
  slope,
  series,
  buildFeatures,
  robustZ,
  scoreWindow,
  levelsFromPercentiles,
  classify,
  detectEscalations,
  alertMessage,
  nextLifecycle,
  dayKey,
  addDays,
  RANK,
  EWDI,
};
