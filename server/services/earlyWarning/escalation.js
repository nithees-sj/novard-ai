const RiskScore = require('../../models/riskScore');
const RiskAlert = require('../../models/riskAlert');
const { areaLabels } = require('../reportAreas');
const { detectEscalations, alertMessage, dayKey, addDays } = require('./scoring');
const { complaintDrivers } = require('./complaints');
const { FEATURE_LABELS, HISTORY_DAYS } = require('../../config/earlyWarning');

/**
 * Admin alerts when an area's risk RISES to HIGH or CRITICAL (EWDI
 * app/risk/escalation.py). One alert per escalation episode (the moment it
 * started), plus one for each worsening within it; unique on
 * (area, windowEnd, level), so re-running the scorer never re-alerts.
 */

const plain = (drivers) => drivers.map((d) => (d.text ? d : { ...d, feature: FEATURE_LABELS[d.feature] || d.feature }));

async function detectAll({ now = new Date(), areas, demo } = {}) {
  const since = new Date(`${addDays(dayKey(now), -HISTORY_DAYS)}T00:00:00Z`);
  const filter = { windowEnd: { $gte: since } };
  if (areas) filter.area = { $in: areas };
  const [rows, labels] = await Promise.all([RiskScore.find(filter).sort({ windowEnd: 1 }).lean(), areaLabels()]);

  const byArea = new Map();
  rows.forEach((r) => byArea.set(r.area, [...(byArea.get(r.area) || []), r]));

  const made = [];
  for (const [area, history] of byArea) {
    for (const { row, prevLevel, prevScore } of detectEscalations(history)) {
      const drivers = [...complaintDrivers(row.complaints), ...(row.attribution || []).filter((a) => a.z > 0).slice(0, 6)];
      const doc = {
        area,
        windowEnd: row.windowEnd,
        level: row.level,
        prevLevel,
        score: row.score,
        prevScore,
        drivers,
        message: alertMessage(labels[area] || area, row.level, prevLevel, row.score, plain(drivers)),
        ...(demo !== undefined ? { demo } : {}),
      };
      try {
        // eslint-disable-next-line no-await-in-loop
        const { upsertedCount } = await RiskAlert.updateOne(
          { area, windowEnd: row.windowEnd, level: row.level },
          { $setOnInsert: doc },
          { upsert: true }
        );
        if (upsertedCount) made.push(doc);
      } catch (error) {
        if (error?.code !== 11000) throw error; // raced another rescan: already alerted
      }
    }
  }
  return made;
}

/** Open (unacknowledged) alerts, CRITICAL first, newest first (EWDI open_alerts). */
async function openAlerts(limit = 20) {
  const alerts = await RiskAlert.find({ acknowledgedAt: null }).sort({ createdAt: -1 }).limit(200).lean();
  const rank = { CRITICAL: 0, HIGH: 1 };
  return alerts.sort((a, b) => (rank[a.level] - rank[b.level]) || (b.createdAt - a.createdAt)).slice(0, limit);
}

module.exports = { detectAll, openAlerts, plain };
