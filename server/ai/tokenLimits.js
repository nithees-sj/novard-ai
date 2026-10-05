const UsageCounter = require('../models/usageCounter');
const settings = require('../services/settingsService');
const { notify } = require('../services/notificationService');
const { TOOLS, TOKEN_LIMITED_TOOLS, AI_FEATURES } = require('../config/admin');
const { HttpError } = require('../utils/httpError');
const logger = require('../utils/logger');

/**
 * Per-student AI token limits per tool, set by an admin (the ai.tokenLimits
 * setting; 0 = unlimited, the default).
 *
 * Every model call adds its tokens to the student's counter for that tool and
 * period. A request to a tool whose allowance is used up is refused before any
 * model is called. The request that crosses the limit is allowed to finish,
 * because output is never cut short; the student is told in the bell as it
 * happens, and the dashboard and the tool show it until the period resets.
 */

const DAY_MS = 24 * 3600 * 1000;
const ADJECTIVE = { day: 'daily', week: 'weekly', month: 'monthly' };

/** The current day, week (from Monday) or month in UTC: its counter id and when it ends. */
function periodWindow(period, now = new Date()) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (period === 'month') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { id: `m${start.toISOString().slice(0, 7)}`, resetsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) };
  }
  if (period === 'week') {
    const start = today - ((new Date(today).getUTCDay() + 6) % 7) * DAY_MS;
    return { id: `w${new Date(start).toISOString().slice(0, 10)}`, resetsAt: new Date(start + 7 * DAY_MS) };
  }
  return { id: `d${new Date(today).toISOString().slice(0, 10)}`, resetsAt: new Date(today + DAY_MS) };
}

const counterKey = (email, tool, window) => `tokens:${String(email).toLowerCase()}:${tool}:${window.id}`;

const formatTokens = (n) => Number(n).toLocaleString('en-US');

function resetsText(period, resetsAt) {
  if (period === 'day') return 'at midnight (UTC)';
  return `on ${resetsAt.toISOString().slice(0, 10)} (UTC)`;
}

/** What the student is told once a tool's allowance is used up. */
function limitMessage(tool, limit, period, resetsAt) {
  return `You have used your ${ADJECTIVE[period]} allowance of ${formatTokens(limit)} AI tokens for ${TOOLS[tool].label}. `
    + `It resets ${resetsText(period, resetsAt)}. Everything else keeps working.`;
}

/** The tool a feature's tokens count against, or null when it is never limited. */
function limitedToolOf(feature) {
  const def = AI_FEATURES[feature];
  if (!def || def.admin || !TOKEN_LIMITED_TOOLS.includes(def.tool)) return null;
  return def.tool;
}

/**
 * Add one model call's tokens to the student's counter (from the model-call
 * log). Sends the bell notification when this call crosses the limit.
 */
async function addTokens({ userId, feature } = {}, tokens = 0) {
  const tool = limitedToolOf(feature);
  if (!userId || !tool || !(tokens > 0)) return;
  const { period, perStudent } = await settings.get('ai.tokenLimits');
  const window = periodWindow(period);
  const row = await UsageCounter.findOneAndUpdate(
    { key: counterKey(userId, tool, window) },
    { $inc: { value: tokens }, $setOnInsert: { expiresAt: new Date(window.resetsAt.getTime() + 2 * DAY_MS) } },
    { upsert: true, new: true }
  ).lean();

  const limit = perStudent[tool] || 0;
  if (limit && row.value >= limit && row.value - tokens < limit) {
    await notify({
      userId: String(userId), // as the session has it: the bell lists by that
      kind: 'ai_limit',
      title: `AI limit reached: ${TOOLS[tool].label}`,
      body: limitMessage(tool, limit, period, window.resetsAt),
    }).catch((error) => logger.warn('Could not send the AI limit notification', { error: error.message }));
  }
}

/** Refuse a request to a tool whose allowance the student has used up (429, AI_TOKEN_LIMIT). */
async function assertWithinTokenLimit(email, tool) {
  if (!email || !TOKEN_LIMITED_TOOLS.includes(tool)) return;
  const { period, perStudent } = await settings.get('ai.tokenLimits');
  const limit = perStudent[tool] || 0;
  if (!limit) return;
  const window = periodWindow(period);
  const row = await UsageCounter.findOne({ key: counterKey(email, tool, window) }).lean();
  if ((row?.value || 0) >= limit) {
    throw new HttpError(429, limitMessage(tool, limit, period, window.resetsAt), { code: 'AI_TOKEN_LIMIT' });
  }
}

/**
 * A student's token use per tool in the current period, against the limits.
 * Lists every tool that has a limit or has been used.
 */
async function tokenUsage(email) {
  const { period, perStudent } = await settings.get('ai.tokenLimits');
  const window = periodWindow(period);
  const rows = await UsageCounter.find({ key: { $in: TOKEN_LIMITED_TOOLS.map((tool) => counterKey(email, tool, window)) } }).lean();
  const used = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const tools = TOKEN_LIMITED_TOOLS.map((tool) => {
    const limit = perStudent[tool] || 0;
    const tokens = used[counterKey(email, tool, window)] || 0;
    return {
      tool,
      label: TOOLS[tool].label,
      used: tokens,
      limit,
      reached: Boolean(limit) && tokens >= limit,
      message: limit && tokens >= limit ? limitMessage(tool, limit, period, window.resetsAt) : undefined,
    };
  }).filter((t) => t.limit || t.used);
  return { period, resetsAt: window.resetsAt.toISOString(), tools };
}

/** Give a student the current period's token allowance back, for every tool. */
async function resetTokenUsage(email) {
  const { period } = await settings.get('ai.tokenLimits');
  const window = periodWindow(period);
  await UsageCounter.deleteMany({ key: { $in: TOKEN_LIMITED_TOOLS.map((tool) => counterKey(email, tool, window)) } });
}

module.exports = { addTokens, assertWithinTokenLimit, tokenUsage, resetTokenUsage, periodWindow, limitMessage };
