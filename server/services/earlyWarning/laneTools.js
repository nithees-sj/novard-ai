const Report = require('../../models/report');
const ReportTopic = require('../../models/reportTopic');
const ModelCall = require('../../models/modelCall');
const GatewayEvent = require('../../models/gatewayEvent');
const AreaFeature = require('../../models/areaFeature');
const RiskScore = require('../../models/riskScore');
const RiskPrecedent = require('../../models/riskPrecedent');
const RiskAssessment = require('../../models/riskAssessment');
const { searchReports } = require('../reportEmbeddings');
const { areaLabels } = require('../reportAreas');
const { percentile } = require('./scoring');
const { AI_FEATURES } = require('../../config/admin');
const { FEATURE_LABELS } = require('../../config/earlyWarning');

/**
 * The investigation lanes' tools (EWDI app/graph/tools.py). Every query is
 * fixed and parameterised: a lane decides nothing about WHAT runs, and no
 * model ever writes a query. Every result carries ids (report refs NV-...,
 * model calls MC-..., gateway events GW-...) so claims built on it can be
 * checked.
 *
 * Each tool returns a list of { kind, summary, citeIds, data }.
 */

const DAY_MS = 24 * 3600 * 1000;
const pct = (x) => `${Math.round((x || 0) * 100)}%`;
const r2 = (x) => Math.round((x || 0) * 100) / 100;
const windowOf = (windowEnd, days) => ({ from: new Date(windowEnd.getTime() - (days - 1) * DAY_MS), to: new Date(windowEnd.getTime() + DAY_MS) });

// ── temporal: is this rising, or always like this? ─────────────────────────

async function temporal(area, windowEnd) {
  const since = new Date(windowEnd.getTime() - 27 * DAY_MS);
  const rows = await AreaFeature.find({ area, windowEnd: { $gte: since, $lte: windowEnd } }).sort({ windowEnd: 1 }).select('windowEnd daily').lean();
  if (!rows.length) return [{ kind: 'metric', summary: 'No daily data for this area in the last 28 days.', citeIds: [], data: {} }];
  const days = rows.map((r) => ({ d: r.windowEnd.toISOString().slice(0, 10), ...r.daily }));
  const recent = days.slice(-7);
  const prior = days.slice(0, -7).length ? days.slice(0, -7) : days;
  const avg = (list, key) => list.reduce((s, d) => s + (d[key] || 0), 0) / Math.max(list.length, 1);
  const rv = avg(recent, 'n_reports');
  const pv = avg(prior, 'n_reports');
  // EWDI's rule: more than 15% above the prior average is rising.
  const trend = rv > pv * 1.15 ? 'rising' : rv < pv * 0.85 ? 'falling' : 'flat';
  const aiNow = avg(recent.filter((d) => d.n_calls), 'ai_error_rate');
  const aiBefore = avg(prior.filter((d) => d.n_calls), 'ai_error_rate');
  return [{
    kind: 'metric',
    summary: `Reports: last 7 days ${r2(rv)}/day vs ${r2(pv)}/day before (${trend}). AI error rate ${pct(aiNow)} vs ${pct(aiBefore)} before. `
      + `Latest day: ${recent[recent.length - 1].n_reports || 0} reports${recent[recent.length - 1].pct_urgent !== undefined ? `, ${pct(recent[recent.length - 1].pct_urgent)} urgent` : ''}.`,
    citeIds: [],
    data: {
      trend,
      series: days.map((d) => ({ d: d.d, reports: d.n_reports || 0, sentiment: d.mean_sent ?? null, aiErrorRate: d.ai_error_rate ?? null, gatewayFailureRate: d.gateway_failure_rate ?? null })),
    },
  }];
}

// ── peers: this area, or everything? ───────────────────────────────────────

const AI_AREAS = new Set(Object.values(AI_FEATURES).map((f) => f.area).filter(Boolean));

async function peers(area, windowEnd) {
  const [rows, labels] = await Promise.all([RiskScore.find({ windowEnd }).sort({ score: -1 }).lean(), areaLabels()]);
  if (!rows.length) return [{ kind: 'peer', summary: 'No peer scores for this window.', citeIds: [], data: {} }];
  const me = rows.find((r) => r.area === area);
  const others = rows.filter((r) => r.area !== area);
  const elevated = others.filter((r) => ['HIGH', 'CRITICAL'].includes(r.level));
  // EWDI: system-wide when at least max(2, a third of the peers) are elevated.
  const verdict = elevated.length >= Math.max(2, Math.floor(others.length / 3))
    ? 'system-wide: other areas are elevated too'
    : 'area-specific: the other areas are normal';
  // New for Novard: if AI errors drive several AI areas at once, suspect the AI gateway.
  const aiDriven = rows.filter((r) => AI_AREAS.has(r.area) && (r.attribution || []).some((a) => ['ai_error_rate', 'ai_429_rate', 'ai_error_slope'].includes(a.feature) && a.z >= 2));
  const gateway = aiDriven.length >= 3
    ? ` AI errors are up in ${aiDriven.length} AI areas at once (${aiDriven.map((r) => labels[r.area] || r.area).join(', ')}): this points at the AI provider, not one feature.`
    : '';
  return [{
    kind: 'peer',
    summary: `${labels[area] || area} ranks ${me ? rows.indexOf(me) + 1 : '?'} of ${rows.length} (score ${me ? r2(me.score) : 'n/a'}). ${elevated.length} of ${others.length} other areas are HIGH or worse: ${verdict}.${gateway}`,
    citeIds: [],
    data: { verdict, aiGatewaySuspected: aiDriven.length >= 3, peers: rows.map((r) => ({ area: r.area, level: r.level, score: r2(r.score) })) },
  }];
}

// ── history: has this happened before, and what fixed it? ──────────────────

async function history(area, windowEnd) {
  const [precedents, past] = await Promise.all([
    RiskPrecedent.find({ area, closedAt: { $lte: new Date(windowEnd.getTime() + DAY_MS) } }).sort({ closedAt: -1 }).limit(5).lean(),
    RiskAssessment.find({ area, status: 'done', outcome: 'investigated' }).sort({ startedAt: -1 }).limit(3).select('runId startedAt hypotheses recommendations').lean(),
  ]);
  if (!precedents.length && !past.length) return [{ kind: 'precedent', summary: `No earlier incidents or fixes on record for this area.`, citeIds: [], data: {} }];
  const parts = [];
  if (precedents.length) {
    parts.push(`${precedents.length} past resolution(s), ${precedents.filter((p) => p.effective).length} effective; latest: "${precedents[0].cause}" -> ${precedents[0].resolution}`);
  }
  if (past.length) {
    const top = (a) => (a.hypotheses || []).slice().sort((x, y) => (y.confidence || 0) - (x.confidence || 0))[0]?.cause;
    parts.push(`Earlier investigations: ${past.map((a) => `${a.startedAt.toISOString().slice(0, 10)}: ${top(a) || 'no clear cause'}`).join(' | ')}`);
  }
  return [{ kind: 'precedent', summary: parts.join(' || '), citeIds: [], data: { precedents, investigations: past.map((a) => a.runId) } }];
}

// ── semantic: what are students actually saying? ───────────────────────────

async function semantic(area, windowEnd, risk = {}) {
  const { from, to } = windowOf(windowEnd, 7);
  const reports = await Report.find({ area, createdAt: { $gte: from, $lt: to } })
    .select('ref text enrichment topicId').lean();
  if (!reports.length) return [{ kind: 'record', summary: 'No reports in this area in the last 7 days.', citeIds: [], data: {} }];

  // Top topics: the cluster label, else the enrichment topic.
  const topicIds = [...new Set(reports.map((r) => r.topicId && String(r.topicId)).filter(Boolean))];
  const topicDocs = topicIds.length ? await ReportTopic.find({ _id: { $in: topicIds } }).lean() : [];
  const labelOf = new Map(topicDocs.map((t) => [String(t._id), t.label]));
  const groups = new Map();
  reports.forEach((r) => {
    const label = (r.topicId && labelOf.get(String(r.topicId))) || r.enrichment?.topic || 'unlabelled';
    groups.set(label, [...(groups.get(label) || []), r]);
  });
  const top = [...groups.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 5);
  const topicIdsCited = top.flatMap(([, list]) => list.slice().sort((a, b) => (a.enrichment?.sentiment ?? 0) - (b.enrichment?.sentiment ?? 0)).slice(0, 5).map((r) => r.ref));
  const topicsEvidence = {
    kind: 'record',
    summary: `Top topics (7 days): ${top.map(([label, list]) => `${label} - ${list.length} reports, mean sentiment ${r2(list.reduce((s, r) => s + (r.enrichment?.sentiment ?? 0), 0) / list.length)}`).join('; ')}`,
    citeIds: topicIdsCited,
    data: { topics: top.map(([label, list]) => ({ label, n: list.length })) },
  };

  // Similar reports: the dominant topic's centroid as the query (no model call), else words from the drivers.
  const dominant = topicDocs.find((t) => t.label === top[0][0]);
  const drivers = (risk.attribution || []).slice(0, 2).map((a) => FEATURE_LABELS[a.feature] || a.feature).join(' ');
  const query = `${top[0][0]} ${drivers} problem broken wrong`;
  const search = await searchReports({ area, from, to, query, vector: dominant?.centroid?.length ? dominant.centroid : undefined });
  const searchEvidence = search.matches.length
    ? {
      kind: 'record',
      summary: `${search.matches.length} reports matching "${top[0][0]}" [${search.mode}]. Example (${search.matches[0].ref}): "${search.matches[0].text.slice(0, 160)}"`,
      citeIds: search.matches.map((m) => m.ref),
      data: { mode: search.mode, matches: search.matches },
    }
    : { kind: 'record', summary: `No matches for "${top[0][0]}" (${search.mode}).`, citeIds: [], data: { mode: search.mode } };
  return [topicsEvidence, searchEvidence];
}

// ── telemetry: the AI gateway and YouTube / PDF, or the product? ────────────

const featuresOf = (area) => Object.entries(AI_FEATURES).filter(([, f]) => f.area === area).map(([k]) => k);

async function telemetry(area, windowEnd) {
  const { from, to } = windowOf(windowEnd, 7);
  const baseFrom = new Date(from.getTime() - 21 * DAY_MS);
  const summarize = async (match) => {
    const [row] = await ModelCall.aggregate([
      { $match: match },
      { $group: { _id: null, n: { $sum: 1 }, errors: { $sum: { $cond: [{ $eq: ['$outcome', 'ok'] }, 0, 1] } }, limited: { $sum: { $cond: [{ $in: ['$outcome', ['429', '429_daily']] }, 1, 0] } }, lat: { $push: '$latencyMs' } } },
    ]);
    return row ? { n: row.n, errorRate: row.errors / row.n, rate429: row.limited / row.n, p95: percentile(row.lat, 95) } : { n: 0, errorRate: 0, rate429: 0, p95: 0 };
  };
  const base = { area, outcome: { $ne: 'blocked' } };
  const [now, before, everywhere, failing, byFeature, gw, gwSamples] = await Promise.all([
    summarize({ ...base, createdAt: { $gte: from, $lt: to } }),
    summarize({ ...base, createdAt: { $gte: baseFrom, $lt: from } }),
    summarize({ area: { $ne: null }, outcome: { $ne: 'blocked' }, createdAt: { $gte: from, $lt: to } }),
    ModelCall.find({ ...base, outcome: { $nin: ['ok'] }, createdAt: { $gte: from, $lt: to } }).sort({ createdAt: -1 }).limit(6).select('_id model outcome feature error').lean(),
    ModelCall.aggregate([
      { $match: { ...base, createdAt: { $gte: from, $lt: to } } },
      { $group: { _id: { feature: '$feature', model: '$model' }, n: { $sum: 1 }, errors: { $sum: { $cond: [{ $eq: ['$outcome', 'ok'] }, 0, 1] } } } },
      { $sort: { errors: -1 } }, { $limit: 4 },
    ]),
    GatewayEvent.aggregate([
      { $match: { area, createdAt: { $gte: from, $lt: to }, outcome: { $in: ['ok', 'fail'] } } },
      { $group: { _id: { gateway: '$gateway', operation: '$operation' }, n: { $sum: 1 }, fails: { $sum: { $cond: [{ $eq: ['$outcome', 'fail'] }, 1, 0] } } } },
      { $sort: { fails: -1 } },
    ]),
    GatewayEvent.find({ area, outcome: 'fail', createdAt: { $gte: from, $lt: to } }).sort({ createdAt: -1 }).limit(4).select('_id gateway operation').lean(),
  ]);

  const out = [];
  if (!now.n && !featuresOf(area).length) {
    out.push({ kind: 'telemetry', summary: 'This area makes no AI calls.', citeIds: [], data: {} });
  } else {
    const provider = everywhere.n && everywhere.errorRate > 0.15 && now.errorRate <= everywhere.errorRate * 1.5
      ? ' The error rate is as high across ALL AI features: likely the AI provider, not this feature.'
      : '';
    out.push({
      kind: 'telemetry',
      summary: `AI calls (7 days): ${now.n}, errors ${pct(now.errorRate)} (before: ${pct(before.errorRate)}), rate-limited ${pct(now.rate429)}, p95 latency ${r2(now.p95 / 1000)}s (before ${r2(before.p95 / 1000)}s). `
        + `${byFeature.filter((f) => f.errors).map((f) => `${f._id.feature} on ${f._id.model}: ${f.errors}/${f.n} failed`).join('; ') || 'No failing feature stands out.'}${provider}`,
      citeIds: failing.map((c) => `MC-${c._id}`),
      data: { now, before, everywhere, byFeature },
    });
  }
  if (gw.length) {
    out.push({
      kind: 'telemetry',
      summary: `Gateways (7 days): ${gw.map((g) => `${g._id.gateway} ${g._id.operation}: ${g.fails}/${g.n} failed`).join('; ')}.`,
      citeIds: gwSamples.map((g) => `GW-${g._id}`),
      data: { gateways: gw.map((g) => ({ ...g._id, n: g.n, fails: g.fails })) },
    });
  }
  return out;
}

const LANE_TOOLS = { temporal, peers, history, semantic, telemetry };

module.exports = { LANE_TOOLS, temporal, peers, history, semantic, telemetry };
