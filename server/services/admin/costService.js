const ModelCall = require('../../models/modelCall');
const User = require('../../models/user');
const settings = require('../settingsService');
const { summarizeCalls, RANGES } = require('./gatewayService');
const { todaysSpend } = require('../../ai/usageGuard');
const { oneOf } = require('../../utils/validate');

/**
 * AI spend: totals, by model, by feature, by day, what investigations and the
 * admin assistant cost, and the students who use the most (by name only).
 */
async function costs(query = {}) {
  const range = oneOf(query.range, 'Range', Object.keys(RANGES), { fallback: '7d' });
  const since = new Date(Date.now() - RANGES[range]);
  const rows = await ModelCall.find({ createdAt: { $gte: since } }).select('model feature provider outcome usd tokensIn tokensOut latencyMs userId runId createdAt').lean();
  const sum = (list) => summarizeCalls(list);
  const group = (key) => {
    const map = new Map();
    rows.forEach((r) => map.set(r[key] || 'unknown', [...(map.get(r[key] || 'unknown') || []), r]));
    return [...map.entries()].map(([k, list]) => ({ [key]: k, ...sum(list) })).sort((a, b) => b.usd - a.usd || b.calls - a.calls);
  };
  const days = new Map();
  rows.forEach((r) => {
    const d = new Date(r.createdAt).toISOString().slice(0, 10);
    days.set(d, (days.get(d) || 0) + (r.usd || 0));
  });
  const perStudent = new Map();
  rows.filter((r) => r.userId).forEach((r) => perStudent.set(r.userId, [...(perStudent.get(r.userId) || []), r]));
  const top = [...perStudent.entries()].map(([userId, list]) => ({ userId, ...sum(list) })).sort((a, b) => b.usd - a.usd || b.calls - a.calls).slice(0, 10);
  const names = new Map((await User.find({ email: { $in: top.map((t) => t.userId) } }).select('email name').lean()).map((u) => [u.email, u.name]));
  const [spendToday, limits] = await Promise.all([todaysSpend(), settings.get('ai.limits')]);
  return {
    range,
    total: sum(rows),
    byModel: group('model'),
    byFeature: group('feature'),
    daily: [...days.entries()].sort().map(([d, usd]) => ({ d, usd })),
    investigations: sum(rows.filter((r) => r.runId)),
    assistant: sum(rows.filter((r) => r.feature === 'admin.assistant')),
    topStudents: top.map(({ userId, ...s }) => ({ name: names.get(userId) || 'Student', ...s })),
    today: { usd: spendToday, cap: limits.globalDailyUsdCap },
  };
}

module.exports = { costs };
