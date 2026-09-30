const User = require('../../models/user');
const AppUsage = require('../../models/appUsage');
const Report = require('../../models/report');
const ModelCall = require('../../models/modelCall');
const Notes = require('../../models/notes');
const DoubtClearance = require('../../models/doubtClearance');
const YouTubeVideo = require('../../models/youtubeVideo');
const SkillPlan = require('../../models/skillPlan');
const Roadmap = require('../../models/roadmap');
const ChatbotConversation = require('../../models/chatbotConversation');
const audit = require('../auditService');
const { view, findUser } = require('../adminUserService');
const { studentUsageToday } = require('../../ai/usageGuard');
const { integer, oneOf, text } = require('../../utils/validate');

/**
 * The console's user pages. Emails are masked ("a***@gmail.com"); revealing
 * one is an audited action.
 */

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  if (!domain) return '***';
  return `${name.slice(0, 1)}***@${domain}`;
}

const masked = (u) => ({ ...view(u), email: maskEmail(u.email), createdAt: u.createdAt || null });

async function listUsers(query = {}) {
  const filter = {};
  const q = text(query.q, 'Search', { required: false, max: 100 });
  if (q) filter.$or = [{ name: new RegExp(escapeRegex(q), 'i') }, { email: new RegExp(escapeRegex(q), 'i') }];
  if (query.status) filter.status = oneOf(query.status, 'Status', ['active', 'suspended']);
  if (query.role) filter.role = query.role === 'admins' ? { $in: ['admin', 'superadmin'] } : oneOf(query.role, 'Role', ['student', 'admin', 'superadmin']);
  const limit = integer(query.limit, 'Limit', { min: 1, max: 100, required: false, fallback: 25 });
  const page = integer(query.page, 'Page', { min: 1, max: 10000, required: false, fallback: 1 });
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const lastActive = await AppUsage.aggregate([
    { $match: { userId: { $in: users.map((u) => u.email) } } },
    { $group: { _id: '$userId', day: { $max: '$day' } } },
  ]);
  const byUser = new Map(lastActive.map((r) => [r._id, r.day]));
  return { users: users.map((u) => ({ ...masked(u), lastActiveDay: byUser.get(u.email) || null })), total, page, limit };
}

/** One user: profile, activity counts, their reports and AI usage. */
async function userDetail(id) {
  const user = await findUser(id);
  const email = user.email;
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const [notes, doubts, videos, plans, roadmaps, chats, usage, reports, ai, aiToday] = await Promise.all([
    Notes.countDocuments({ userId: email }),
    DoubtClearance.countDocuments({ userId: email }),
    YouTubeVideo.countDocuments({ userId: email }),
    SkillPlan.countDocuments({ userId: email }),
    Roadmap.countDocuments({ userId: email }),
    ChatbotConversation.countDocuments({ userId: email }),
    AppUsage.find({ userId: email }).sort({ day: -1 }).limit(30).select('day seconds').lean(),
    Report.find({ userId: email }).sort({ createdAt: -1 }).limit(20).select('ref area status text createdAt enrichment.urgency').lean(),
    ModelCall.aggregate([
      { $match: { userId: email, createdAt: { $gte: since } } },
      { $group: { _id: '$feature', calls: { $sum: 1 }, usd: { $sum: '$usd' }, tokens: { $sum: { $add: ['$tokensIn', '$tokensOut'] } } } },
      { $sort: { calls: -1 } },
    ]),
    studentUsageToday(email),
  ]);
  return {
    user: masked(user),
    activity: {
      notes, doubts, videos, learningPlans: plans, roadmaps, agentChats: chats,
      studyMinutesLast30Days: Math.round(usage.reduce((s, d) => s + (d.seconds || 0), 0) / 60),
      activeDays: usage.map((d) => ({ day: d.day, minutes: Math.round((d.seconds || 0) / 60) })),
    },
    reports,
    ai: { last30Days: ai.map((a) => ({ feature: a._id, calls: a.calls, usd: a.usd, tokens: a.tokens })), requestsToday: aiToday },
  };
}

async function revealEmail(actor, id, { ip } = {}) {
  const user = await findUser(id);
  await audit.record({ actor, action: 'user.reveal_email', target: { type: 'user', id: String(user._id) }, after: { name: user.name || '' }, ip });
  return { email: user.email };
}

module.exports = { listUsers, userDetail, revealEmail, maskEmail };
