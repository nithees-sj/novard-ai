const Report = require('../../models/report');
const ModelCall = require('../../models/modelCall');
const GatewayEvent = require('../../models/gatewayEvent');
const AreaFeature = require('../../models/areaFeature');
const settings = require('../settingsService');
const { areas: allAreas } = require('../reportAreas');
const { buildFeatures, percentile, dayKey, addDays } = require('./scoring');
const EW = require('../../config/earlyWarning');

/**
 * Per-area daily series -> 7-day windows against a 21-day baseline (EWDI
 * app/features/compute.py). Deltas and slopes carry the early warning, not
 * absolute levels: a busy area is normal, a busy area getting busier is not.
 *
 * Daily metrics come from three places: students' reports, the model-call log
 * (every AI feature) and the gateway log (YouTube, PDF reading).
 */

const DAY_MS = 24 * 3600 * 1000;
const HOUR_MS = 3600 * 1000;
const startOfDay = (d) => new Date(Date.parse(`${dayKey(d)}T00:00:00Z`));

/** id -> the area it counts as (merged areas count as their target). */
async function areaMap() {
  const list = await allAreas();
  const byId = new Map(list.map((a) => [a.id, a]));
  const resolve = (id) => {
    let a = byId.get(id);
    for (let i = 0; a?.mergedInto && i < 5; i += 1) a = byId.get(a.mergedInto);
    return a && !a.mergedInto ? a.id : null;
  };
  return { ids: list.filter((a) => !a.mergedInto).map((a) => a.id), resolve };
}

const blank = () => ({
  n_reports: 0,
  n_reporters: 0,
  n_reports_settled: 0,
  n_responded: 0,
  n_enriched: 0,
  n_calls: 0,
  n_gateway: 0,
});

/**
 * Raw daily metrics for [from, to): { area: { 'YYYY-MM-DD': record } }.
 * `now` decides which days are old enough for the unresolved-reports metric.
 */
async function dailyMetrics({ from, to, now = new Date() }) {
  const { resolve } = await areaMap();
  const out = {};
  const rec = (area, day) => {
    out[area] = out[area] || {};
    out[area][day] = out[area][day] || blank();
    return out[area][day];
  };

  // Reports
  const reports = await Report.find({ createdAt: { $gte: from, $lt: to } })
    .select('area userId createdAt firstResponseAt enrichment source.excerpt').lean();
  const perDay = new Map();
  reports.forEach((r) => {
    const area = resolve(r.area);
    if (!area) return;
    const key = `${area}|${dayKey(r.createdAt)}`;
    perDay.set(key, [...(perDay.get(key) || []), r]);
  });
  perDay.forEach((list, key) => {
    const [area, day] = key.split('|');
    const d = rec(area, day);
    const dayEnd = Date.parse(`${day}T00:00:00Z`) + DAY_MS;
    const graceEnd = dayEnd + EW.RESPONSE_GRACE_HOURS * HOUR_MS;
    d.n_reports = list.length;
    d.n_reporters = new Set(list.map((r) => r.userId)).size;
    d.n_ai_reports = list.filter((r) => r.source?.excerpt).length;

    if (now.getTime() >= graceEnd) {
      d.n_reports_settled = list.length;
      const unanswered = list.filter((r) => !r.firstResponseAt || new Date(r.firstResponseAt).getTime() > graceEnd).length;
      d.pct_unresolved = unanswered / list.length;
    }
    // Response latency (log-scaled: heavy-tailed, as in EWDI).
    const hours = list.filter((r) => r.firstResponseAt).map((r) => (new Date(r.firstResponseAt) - new Date(r.createdAt)) / HOUR_MS);
    d.n_responded = hours.length;
    if (hours.length) {
      d.p50_first_response_h = Math.log1p(Math.max(0, percentile(hours, 50)));
      d.p90_first_response_h = Math.log1p(Math.max(0, percentile(hours, 90)));
    }
    const enriched = list.filter((r) => r.enrichment?.status === 'done' && typeof r.enrichment.sentiment === 'number');
    d.n_enriched = enriched.length;
    if (enriched.length) {
      d.mean_sent = enriched.reduce((s, r) => s + r.enrichment.sentiment, 0) / enriched.length;
      d.pct_negative = enriched.filter((r) => r.enrichment.sentiment < -0.3).length / enriched.length;
      d.pct_urgent = enriched.filter((r) => r.enrichment.urgency === 'high').length / enriched.length;
      d.repeat_rate = enriched.filter((r) => r.enrichment.isRepeat).length / enriched.length;
    }
  });

  // Model calls (the AI features of each area); calls an admin switched off do not count.
  const calls = await ModelCall.aggregate([
    { $match: { createdAt: { $gte: from, $lt: to }, area: { $ne: null }, outcome: { $ne: 'blocked' } } },
    {
      $group: {
        _id: { area: '$area', day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } } },
        n: { $sum: 1 },
        errors: { $sum: { $cond: [{ $eq: ['$outcome', 'ok'] }, 0, 1] } },
        limited: { $sum: { $cond: [{ $in: ['$outcome', ['429', '429_daily']] }, 1, 0] } },
        okLatencies: { $push: { $cond: [{ $eq: ['$outcome', 'ok'] }, '$latencyMs', '$$REMOVE'] } },
      },
    },
  ]);
  calls.forEach((c) => {
    const area = resolve(c._id.area);
    if (!area) return;
    const d = rec(area, c._id.day);
    d.n_calls += c.n;
    d.ai_error_rate = ((d.ai_error_rate || 0) * (d.n_calls - c.n) + c.errors) / d.n_calls;
    d.ai_429_rate = ((d.ai_429_rate || 0) * (d.n_calls - c.n) + c.limited) / d.n_calls;
    if (c.okLatencies.length) d.ai_p95_latency = Math.log1p(percentile(c.okLatencies, 95) / 1000);
  });

  // Gateways (YouTube, PDF): real attempts only (not "disabled" or "no captions").
  const gateway = await GatewayEvent.aggregate([
    { $match: { createdAt: { $gte: from, $lt: to }, area: { $ne: null }, outcome: { $in: ['ok', 'fail'] } } },
    {
      $group: {
        _id: { area: '$area', day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } } },
        n: { $sum: 1 },
        fails: { $sum: { $cond: [{ $eq: ['$outcome', 'fail'] }, 1, 0] } },
      },
    },
  ]);
  gateway.forEach((g) => {
    const area = resolve(g._id.area);
    if (!area) return;
    const d = rec(area, g._id.day);
    d.n_gateway += g.n;
    d.gateway_failure_rate = ((d.gateway_failure_rate || 0) * (d.n_gateway - g.n) + g.fails) / d.n_gateway;
  });

  // AI answers reported per 1,000 AI calls.
  Object.values(out).forEach((days) => Object.values(days).forEach((d) => {
    if (d.n_calls) d.ai_report_rate = ((d.n_ai_reports || 0) / d.n_calls) * 1000;
    d.active = d.n_reports + d.n_calls + d.n_gateway > 0;
  }));
  return out;
}

/** The metric definitions with their minimums from the live cold-start settings. */
function metricConfig(coldStart) {
  return {
    metrics: EW.METRICS.map((m) => ({ ...m, min: m.min ? coldStart[m.min] : 0 })),
    slopes: EW.SLOPE_SERIES,
    windowDays: EW.WINDOW_DAYS,
    baselineDays: EW.BASELINE_DAYS,
    enriched: EW.METRICS.filter((m) => m.enriched).map((m) => m.name),
  };
}

/** The first day anything was measured (a report, model call or gateway event), or null. */
async function firstDataDay() {
  const firsts = await Promise.all([Report, ModelCall, GatewayEvent].map((M) => M.findOne().sort({ createdAt: 1 }).select('createdAt').lean()));
  const dates = firsts.filter(Boolean).map((d) => d.createdAt.getTime());
  return dates.length ? dayKey(new Date(Math.min(...dates))) : null;
}

/** Days in the baseline part of a window with any activity (cold start). */
function baselineActiveDays(days, windowEnd) {
  let n = 0;
  for (let d = addDays(windowEnd, -EW.BASELINE_DAYS); d < addDays(windowEnd, -(EW.WINDOW_DAYS - 1)); d = addDays(d, 1)) {
    if (days[d]?.active) n += 1;
  }
  return n;
}

/**
 * Compute and store the feature windows ending on each of the last `recomputeDays`
 * days (default: enough for late responses and enrichment to settle).
 * Idempotent: upserts on (area, windowEnd).
 */
async function computeFeatures({ now = new Date(), recomputeDays = 35, demo } = {}) {
  const today = dayKey(now);
  const firstWindow = addDays(today, -(recomputeDays - 1));
  const from = new Date(`${addDays(firstWindow, -EW.BASELINE_DAYS)}T00:00:00Z`);
  const to = new Date(startOfDay(now).getTime() + DAY_MS);
  const [daily, coldStart, { ids }, dataStart] = await Promise.all([dailyMetrics({ from, to, now }), settings.get('risk.coldStart'), areaMap(), firstDataDay()]);
  const cfg = { ...metricConfig(coldStart), dataStart };

  const ops = [];
  ids.forEach((area) => {
    const days = daily[area] || {};
    for (let we = firstWindow; we <= today; we = addDays(we, 1)) {
      ops.push({
        updateOne: {
          filter: { area, windowEnd: new Date(`${we}T00:00:00Z`) },
          update: {
            $set: {
              windowDays: EW.WINDOW_DAYS,
              daily: days[we] || blank(),
              f: buildFeatures(days, we, cfg),
              baselineActiveDays: baselineActiveDays(days, we),
              ...(demo !== undefined ? { demo } : {}),
            },
          },
          upsert: true,
        },
      });
    }
  });
  if (ops.length) await AreaFeature.bulkWrite(ops, { ordered: false });
  return { areas: ids.length, windows: ops.length, from: firstWindow, to: today };
}

module.exports = { computeFeatures, dailyMetrics, metricConfig, baselineActiveDays, firstDataDay, areaMap, startOfDay };
