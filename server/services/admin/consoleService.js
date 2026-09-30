const mongoose = require('mongoose');
const User = require('../../models/user');
const AppUsage = require('../../models/appUsage');
const Report = require('../../models/report');
const AreaFeature = require('../../models/areaFeature');
const RiskScore = require('../../models/riskScore');
const RiskAlert = require('../../models/riskAlert');
const RiskObject = require('../../models/riskObject');
const RiskAssessment = require('../../models/riskAssessment');
const RiskPrecedent = require('../../models/riskPrecedent');
const settings = require('../settingsService');
const audit = require('../auditService');
const { activeAreas, areaLabels, resolveArea } = require('../reportAreas');
const { isStale, rescanAll, lastRescanAt } = require('../earlyWarning/rescan');
const { openAlerts } = require('../earlyWarning/escalation');
const { present: presentRun } = require('../earlyWarning/runs');
const { percentileThresholds } = require('../earlyWarning/scores');
const { complaintDrivers, verdict } = require('../earlyWarning/complaints');
const { todaysSpend } = require('../../ai/usageGuard');
const { gatewayLights } = require('./gatewayService');
const { FEATURE_LABELS, GRAPH } = require('../../config/earlyWarning');
const { badRequest, notFound } = require('../../utils/httpError');
const { isObjectId } = require('../../utils/validate');
const logger = require('../../utils/logger');

/**
 * What the admin console's overview, risk board, area pages and alert banner
 * show. Read-only, except acknowledging alerts and the lazy rescan.
 */

const DAY_MS = 24 * 3600 * 1000;
const todayKey = () => new Date().toISOString().slice(0, 10);
const midnight = (key) => new Date(`${key}T00:00:00Z`);
const plainDrivers = (attribution = [], n = 3) => attribution.filter((a) => a.text || a.z > 0).slice(0, n)
  .map((a) => (a.text ? a : { feature: a.feature, label: FEATURE_LABELS[a.feature] || a.feature, z: a.z, share: a.share }));
/** A score's drivers: the complaint count first (when it matters), then the baseline signals. */
const scoreDrivers = (score, n = 3) => plainDrivers([...complaintDrivers(score?.complaints), ...(score?.attribution || [])], n);

/** Rescan when the scores are over an hour old (Cloud Run may have been idle). Never fails the page. */
async function freshen() {
  try {
    if (await isStale()) await rescanAll({ trigger: 'lazy' });
  } catch (error) {
    logger.warn('Lazy risk rescan failed; showing the last scores', { error: error.message });
  }
}

async function board({ rescan = true } = {}) {
  if (rescan) await freshen();
  const areas = await activeAreas();
  const since = midnight(new Date(Date.now() - 27 * DAY_MS).toISOString().slice(0, 10));
  const [scores, openReports, objects, alerts, last] = await Promise.all([
    RiskScore.find({ windowEnd: { $gte: since } }).sort({ windowEnd: 1 }).lean(),
    Report.aggregate([{ $match: { open: true } }, { $group: { _id: '$area', open: { $sum: 1 }, urgent: { $sum: { $cond: [{ $eq: ['$enrichment.urgency', 'high'] }, 1, 0] } } } }]),
    RiskObject.find({ state: { $ne: 'resolved' } }).lean(),
    RiskAlert.find({ acknowledgedAt: null }).lean(),
    lastRescanAt(),
  ]);
  const byArea = new Map();
  scores.forEach((s) => byArea.set(s.area, [...(byArea.get(s.area) || []), s]));
  const reportsBy = new Map(openReports.map((r) => [r._id, r]));

  const rows = areas.map(({ id, label }) => {
    const history = byArea.get(id) || [];
    const latest = history[history.length - 1];
    const object = objects.filter((o) => o.area === id).sort((a, b) => b.currentScore - a.currentScore)[0];
    return {
      area: id,
      label,
      level: latest?.level || 'LOW',
      score: latest?.score ?? 0,
      status: latest?.status || 'insufficient_baseline',
      windowEnd: latest?.windowEnd || null,
      drivers: scoreDrivers(latest),
      complaints: latest?.complaints || null,
      sparkline: history.map((h) => ({ d: h.windowEnd.toISOString().slice(0, 10), score: h.score, level: h.level })),
      openReports: reportsBy.get(id)?.open || 0,
      urgentReports: reportsBy.get(id)?.urgent || 0,
      riskObject: object ? { id: object._id, topic: object.topic, state: object.state, flagged: object.flagged } : null,
      openAlerts: alerts.filter((a) => a.area === id).length,
    };
  });
  const rank = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
  rows.sort((a, b) => (rank[b.level] - rank[a.level]) || (b.score - a.score));
  return { areas: rows, lastRescanAt: last };
}

/** Everything about one area: 28-day series, drivers, reports, risk objects, investigations, precedents. */
async function areaDetail(areaId) {
  const area = await resolveArea(areaId);
  if (!area) throw notFound('Unknown area');
  const since = new Date(Date.now() - 27 * DAY_MS);
  const [labels, features, scores, reports, objects, runs, precedents, thresholds] = await Promise.all([
    areaLabels(),
    AreaFeature.find({ area, windowEnd: { $gte: midnight(since.toISOString().slice(0, 10)) } }).sort({ windowEnd: 1 }).lean(),
    RiskScore.find({ area, windowEnd: { $gte: midnight(since.toISOString().slice(0, 10)) } }).sort({ windowEnd: 1 }).lean(),
    Report.find({ area, open: true }).sort({ createdAt: -1 }).limit(25).select('ref userId text transcript status enrichment createdAt source.excerpt').lean(),
    RiskObject.find({ area }).sort({ lastSeenAt: -1 }).limit(10).lean(),
    RiskAssessment.find({ area }).sort({ startedAt: -1 }).limit(10).select('runId status outcome trigger startedAt endedAt degraded risk.level risk.score hypotheses budget').lean(),
    RiskPrecedent.find({ area }).sort({ closedAt: -1 }).limit(5).lean(),
    settings.get('risk.thresholds'),
  ]);
  const latest = scores[scores.length - 1] || null;
  const observed = await RiskScore.find({ status: 'scored' }).select('score').lean();
  const inForce = observed.length >= thresholds.minScoredWindows && latest?.status === 'scored'
    ? { from: 'percentile', ...percentileThresholds(observed.map((s) => s.score), thresholds.percentiles) }
    : { from: 'fixed', ...thresholds.fixed };
  return {
    area,
    label: labels[area] || area,
    latest: latest && { ...latest, drivers: scoreDrivers(latest, 8), attribution: latest.attribution.map((a) => ({ ...a, label: FEATURE_LABELS[a.feature] || a.feature })) },
    thresholds: inForce,
    series: features.map((f) => ({
      d: f.windowEnd.toISOString().slice(0, 10),
      reports: f.daily?.n_reports || 0,
      urgentShare: f.daily?.pct_urgent ?? null,
      sentiment: f.daily?.mean_sent ?? null,
      aiErrorRate: f.daily?.ai_error_rate ?? null,
      aiCalls: f.daily?.n_calls || 0,
      gatewayFailureRate: f.daily?.gateway_failure_rate ?? null,
    })),
    scores: scores.map((s) => ({ d: s.windowEnd.toISOString().slice(0, 10), score: s.score, level: s.level, status: s.status })),
    // Each report's reading for the complaint rule: severe, complaint or none. Student emails stay out.
    openReports: reports.map((r) => {
      const shown = { ...r, risk: verdict(r) };
      delete shown.userId;
      delete shown.transcript;
      return shown;
    }),
    riskObjects: objects,
    assessments: runs.map((r) => ({ ...presentRun(r), topCause: (r.hypotheses || []).slice().sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0]?.cause || null, hypotheses: undefined })),
    precedents,
  };
}

async function alerts({ includeAcknowledged = false } = {}) {
  const [open, labels] = await Promise.all([openAlerts(20), areaLabels()]);
  const recent = includeAcknowledged
    ? await RiskAlert.find({ acknowledgedAt: { $gte: new Date(Date.now() - 7 * DAY_MS) } }).sort({ acknowledgedAt: -1 }).limit(20).lean()
    : [];
  const withLabel = (a) => ({ ...a, areaLabel: labels[a.area] || a.area, drivers: plainDrivers(a.drivers, 3) });
  return { open: open.map(withLabel), acknowledged: recent.map(withLabel) };
}

async function acknowledge(actor, id, { ip } = {}) {
  if (!isObjectId(String(id))) throw badRequest('A valid alert id is required.');
  const alert = await RiskAlert.findOneAndUpdate({ _id: id, acknowledgedAt: null }, { $set: { acknowledgedAt: new Date(), acknowledgedBy: actor.email } }, { new: true }).lean();
  if (!alert) throw notFound('Alert not found, or already acknowledged');
  await audit.record({ actor, action: 'risk.alert.ack', target: { type: 'alert', id: String(alert._id) }, after: { area: alert.area, level: alert.level }, ip });
  return alert;
}

/** Platform health at a glance. */
async function overview() {
  const today = todayKey();
  const [users, admins, suspended, newToday, activeToday, reportsOpen, reportsUrgent, reportsToday, spend, limits, boardData, alertData, lights, runs] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: { $in: ['admin', 'superadmin'] } }),
    User.countDocuments({ status: 'suspended' }),
    User.countDocuments({ createdAt: { $gte: midnight(today) } }),
    AppUsage.distinct('userId', { day: { $gte: new Date(Date.now() - DAY_MS).toISOString().slice(0, 10) } }).then((l) => l.length),
    Report.countDocuments({ open: true }),
    Report.countDocuments({ open: true, 'enrichment.urgency': 'high' }),
    Report.countDocuments({ createdAt: { $gte: midnight(today) } }),
    todaysSpend(),
    settings.get('ai.limits'),
    board(),
    alerts(),
    gatewayLights(),
    RiskAssessment.find().sort({ startedAt: -1 }).limit(5).select('runId area status outcome startedAt risk.level budget.usdUsed').lean(),
  ]);
  const levels = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  boardData.areas.forEach((a) => { levels[a.level] += 1; });
  return {
    users: { total: users, admins, suspended, newToday, activeToday },
    reports: { open: reportsOpen, urgent: reportsUrgent, today: reportsToday },
    risk: { levels, areas: boardData.areas.map(({ area, label, level, score }) => ({ area, label, level, score })), lastRescanAt: boardData.lastRescanAt },
    ai: { spendToday: spend, dailyCap: limits.globalDailyUsdCap, perStudentDaily: limits.perStudentDaily },
    gateways: lights,
    alerts: alertData.open.slice(0, 5),
    runs: runs.map(presentRun),
    database: mongoose.connection.readyState === 1 ? 'up' : 'down',
    staleRunMinutes: GRAPH.staleRunMinutes,
  };
}

module.exports = { board, areaDetail, alerts, acknowledge, overview, plainDrivers };
