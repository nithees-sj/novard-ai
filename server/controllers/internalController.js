const crypto = require('crypto');
const { env } = require('../config/env');
const { rescanAll } = require('../services/earlyWarning/rescan');
const { notFound, unauthorized } = require('../utils/httpError');

const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();

/**
 * POST /api/internal/risk/rescan  (header X-Risk-Cron-Secret)
 * For Cloud Scheduler: Cloud Run scales to zero, so nothing runs on a timer
 * inside the app. Disabled (404) unless RISK_CRON_SECRET is set.
 */
exports.rescan = async (req, res) => {
  if (!env.riskCronSecret) throw notFound(`Not found: ${req.method} ${req.originalUrl}`);
  const given = req.get('x-risk-cron-secret') || '';
  if (!crypto.timingSafeEqual(digest(given), digest(env.riskCronSecret))) throw unauthorized('Invalid scheduler secret.');
  res.json(await rescanAll({ trigger: 'schedule', full: req.query.full === 'true' }));
};
