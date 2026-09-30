const UsageCounter = require('../models/usageCounter');
const settings = require('../services/settingsService');
const { AI_FEATURES } = require('../config/admin');
const { currentAi } = require('./aiContext');
const { dayKey } = require('./modelCallLog');
const { HttpError } = require('../utils/httpError');

/**
 * The admin's switches and limits on AI use, enforced before every model call
 * and on every AI route:
 *   - a provider (Groq / Gemini) or a tool switched off -> friendly 503
 *   - the global daily USD cap reached -> non-essential features pause (503)
 *   - a student's daily AI request quota used up -> friendly 429
 * All are off by default, so nothing changes until an admin sets them.
 */

const DAY_MS = 24 * 3600 * 1000;

const UNAVAILABLE = 'This tool is temporarily unavailable. Please try again later.';
const BUDGET_MESSAGE = 'This AI feature is paused for the rest of the day. Everything else keeps working.';

const unavailable = (message, code = 'FEATURE_UNAVAILABLE') => new HttpError(503, message || UNAVAILABLE, { code });

/** Is this tool switched on? Throws the admin's message when it is off. */
async function assertToolEnabled(tool) {
  if (!tool) return;
  const flag = await settings.get(`features.${tool}`);
  if (!flag.enabled) throw unavailable(flag.message);
}

async function todaysSpend() {
  const row = await UsageCounter.findOne({ key: `spend:${dayKey()}` }).lean();
  return row?.value || 0;
}

/** Has today's spend reached the global cap (0 = no cap)? */
async function overSpendCap() {
  const { globalDailyUsdCap } = await settings.get('ai.limits');
  if (!globalDailyUsdCap) return false;
  return (await todaysSpend()) >= globalDailyUsdCap;
}

/**
 * Checked right before a model call: provider on, the feature's tool on, and
 * (for non-essential features) the daily spend cap not reached.
 */
async function beforeCall({ provider }, context = currentAi()) {
  const providers = await settings.get('ai.providers');
  if (providers[provider] === false) throw unavailable(UNAVAILABLE, 'AI_PROVIDER_OFF');
  const feature = AI_FEATURES[context.feature];
  if (!feature) return;
  await assertToolEnabled(feature.tool);
  if (!feature.essential && !feature.admin && await overSpendCap()) throw unavailable(BUDGET_MESSAGE, 'AI_BUDGET_REACHED');
}

/** Count one AI request against the student's daily quota; 429 once it is used up. */
async function consumeStudentQuota(email) {
  const { perStudentDaily } = await settings.get('ai.limits');
  if (!perStudentDaily || !email) return;
  const row = await UsageCounter.findOneAndUpdate(
    { key: `ai:${String(email).toLowerCase()}:${dayKey()}` },
    { $inc: { value: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 3 * DAY_MS) } },
    { upsert: true, new: true }
  ).lean();
  if (row.value > perStudentDaily) {
    throw new HttpError(429, `You have used today's ${perStudentDaily} AI requests. Your allowance resets at midnight (UTC).`, { code: 'AI_QUOTA_REACHED' });
  }
}

/** A student's AI requests today. */
async function studentUsageToday(email) {
  const row = await UsageCounter.findOne({ key: `ai:${String(email).toLowerCase()}:${dayKey()}` }).lean();
  return row?.value || 0;
}

/** Give a student today's full allowance back. */
async function resetStudentQuota(email) {
  const { deletedCount } = await UsageCounter.deleteOne({ key: `ai:${String(email).toLowerCase()}:${dayKey()}` });
  return deletedCount > 0;
}

module.exports = {
  beforeCall,
  assertToolEnabled,
  consumeStudentQuota,
  studentUsageToday,
  resetStudentQuota,
  todaysSpend,
  overSpendCap,
  unavailable,
  UNAVAILABLE,
  BUDGET_MESSAGE,
};
