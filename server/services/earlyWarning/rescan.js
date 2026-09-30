const UsageCounter = require('../../models/usageCounter');
const settings = require('../settingsService');
const { computeFeatures } = require('./features');
const { scoreAll } = require('./scores');
const { detectAll } = require('./escalation');
const { advanceAll } = require('./lifecycle');
const { withLock } = require('../locks');
const { HISTORY_DAYS } = require('../../config/earlyWarning');
const logger = require('../../utils/logger');

/**
 * One scoring pass for every area (zero tokens): features -> scores ->
 * escalation alerts -> risk-object lifecycle. Idempotent, and safe to run from
 * several places at once (one runs, the others skip): npm run risk:score,
 * Cloud Scheduler (POST /api/internal/risk/rescan), the console's "Rescan now",
 * and the lazy rescan when the risk board is opened with stale scores.
 */

const LOCK_MS = 10 * 60 * 1000;
const STALE_MS = 60 * 60 * 1000;
const LAST_KEY = 'risk:lastRescan';

async function lastRescanAt() {
  const row = await UsageCounter.findOne({ key: LAST_KEY }).lean();
  return row ? new Date(row.value) : null;
}

/** Are the scores older than an hour (or missing)? */
async function isStale(now = new Date()) {
  const last = await lastRescanAt();
  return !last || now - last > STALE_MS;
}

/**
 * @param {object} [options]
 * @param {boolean} [options.full]  recompute the whole history (after a seed or a settings change)
 * @param {string}  [options.trigger] schedule | admin | cli | lazy
 */
async function rescanAll({ now = new Date(), full = false, trigger = 'admin', demo } = {}) {
  const result = await withLock('risk-rescan', LOCK_MS, async () => {
    const started = Date.now();
    const features = await computeFeatures({ now, recomputeDays: full ? HISTORY_DAYS : 35, demo });
    const scores = await scoreAll({ now, demo });
    const alerts = await detectAll({ now, demo });
    const lifecycle = await advanceAll({ now, demo });
    await UsageCounter.updateOne(
      { key: LAST_KEY },
      { $set: { value: now.getTime(), expiresAt: new Date(now.getTime() + 400 * 24 * 3600 * 1000) } },
      { upsert: true }
    );

    // Optional: investigate newly raised alerts right away (off by default: it spends tokens).
    let investigations = [];
    const auto = await settings.get('risk.autoInvestigate');
    if (trigger === 'schedule' && auto.enabled && alerts.length) {
      const { runAssessment } = require('./graph/runner');
      const areas = [...new Set(alerts.map((a) => a.area))].slice(0, auto.maxPerRescan);
      investigations = await Promise.all(areas.map((area) => runAssessment({ area, trigger: 'schedule', actor: 'system' })
        .then((r) => ({ area, runId: r.runId, outcome: r.outcome }))
        .catch((error) => ({ area, error: error.message }))));
    }
    return {
      features: features.windows,
      scored: scores.scored,
      levelsFrom: scores.levelsFrom,
      alerts: alerts.map((a) => ({ area: a.area, level: a.level, message: a.message })),
      lifecycle,
      investigations,
      ms: Date.now() - started,
    };
  });
  if (result.skipped) logger.info('Risk rescan skipped: another rescan is running');
  return result;
}

module.exports = { rescanAll, isStale, lastRescanAt };
