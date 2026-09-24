const User = require('../models/user');
const Roadmap = require('../models/roadmap');
const SkillGapSession = require('../models/skillGapSession');
const ChatbotConversation = require('../models/chatbotConversation');
const {
  loadActivity,
  dailyStudy,
  activeDaySet,
  makeDayKey,
  DAY_MS,
  computeSkillScore,
  computeStreak,
  computeProficiency,
  computeStrengthsAndFocus,
  weightedAccuracy,
} = require('./analyticsController');

/**
 * Everything the profile page shows about one student: who they are, what
 * they are aiming for, how their tests have gone, where they are on each
 * learning path, and how they have been studying over time.
 *
 * Built on the same activity model as the dashboard analytics
 * (analyticsController.loadActivity), so the numbers on both pages agree.
 */

const SOURCES = {
  notes: 'Notes',
  youtube: 'YouTube',
  doubt: 'Doubts',
  plan: 'Skill plans',
  other: 'Other',
};

const KIND_LABELS = {
  quiz: 'Quizzes',
  question: 'AI questions',
  planDay: 'Plan days',
  materialAdded: 'Adding material',
  forumPost: 'Forum posts',
  forumComment: 'Forum replies',
};

const HEATMAP_WEEKS = 52;
const SCORE_TREND_WEEKS = 12;
const HISTORY_LIMIT = 200;

const round = (n) => Math.round(n);
const pct = (a, b) => (b > 0 ? round((a / b) * 100) : 0);

/** Accuracy per group of attempts (source, difficulty, ...), largest group first. */
function groupAccuracy(attempts, keyOf, labelOf, now) {
  const groups = new Map();
  attempts.forEach((a) => {
    const key = keyOf(a);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  });
  return [...groups.entries()]
    .map(([key, list]) => ({
      key,
      label: labelOf(key),
      attempts: list.length,
      questions: list.reduce((n, a) => n + a.questions, 0),
      accuracy: round(weightedAccuracy(list, now)),
      best: round(Math.max(...list.map((a) => a.percentage))),
    }))
    .sort((a, b) => b.attempts - a.attempts);
}

/**
 * Day-by-day activity for the heatmap, starting on a Sunday so columns are
 * whole weeks. `daily` is analyticsController.dailyStudy(); a day with tracked
 * time but no saved actions (reading, watching) still shows as active.
 */
function computeHeatmap(daily, now, dayKey) {
  const todayKey = dayKey(now);
  const todayWeekday = new Date(`${todayKey}T00:00:00Z`).getUTCDay();
  const totalDays = (HEATMAP_WEEKS - 1) * 7 + todayWeekday + 1;

  const days = [];
  for (let i = totalDays - 1; i >= 0; i -= 1) {
    const key = dayKey(new Date(now.getTime() - i * DAY_MS));
    const d = daily.get(key) || { activities: 0, minutes: 0, tracked: false };
    const minutes = round(d.minutes);
    // Intensity follows saved actions, or one step per 15 tracked minutes (5+ minutes counts as active).
    const fromTime = d.tracked && minutes >= 5 ? Math.max(1, Math.floor(minutes / 15)) : 0;
    days.push({ date: key, count: Math.max(d.activities, fromTime), activities: d.activities, minutes, tracked: d.tracked });
  }
  return {
    weeks: HEATMAP_WEEKS,
    days,
    activeDays: days.filter((d) => d.count > 0).length,
    busiest: days.reduce((m, d) => (d.count > (m?.count || 0) ? d : m), null),
  };
}

/** Skill score at the end of each of the last N weeks, oldest first. */
function computeScoreTrend(data, now, dayKey) {
  const points = [];
  for (let w = SCORE_TREND_WEEKS - 1; w >= 0; w -= 1) {
    const asOf = new Date(now.getTime() - w * 7 * DAY_MS);
    points.push({ date: dayKey(asOf), value: computeSkillScore(data, asOf, dayKey).total });
  }
  return points;
}

/** Where the study time went, by kind of activity. */
function computeMix(events) {
  const totals = new Map();
  events.forEach((e) => totals.set(e.kind, (totals.get(e.kind) || 0) + e.minutes));
  const all = [...totals.values()].reduce((n, m) => n + m, 0);
  return [...totals.entries()]
    .map(([kind, minutes]) => ({ kind, label: KIND_LABELS[kind] || kind, minutes: round(minutes), share: pct(minutes, all) }))
    .sort((a, b) => b.minutes - a.minutes);
}

function scoreBands(attempts) {
  const bands = [
    { label: '0-39%', min: 0, max: 40 },
    { label: '40-59%', min: 40, max: 60 },
    { label: '60-79%', min: 60, max: 80 },
    { label: '80-100%', min: 80, max: 101 },
  ];
  return bands.map((b) => ({
    label: b.label,
    count: attempts.filter((a) => a.percentage >= b.min && a.percentage < b.max).length,
  }));
}

function planPath(plan) {
  const days = plan.dailyPlan || [];
  const done = days.filter((d) => d.completed);
  const lastDone = done.reduce((m, d) => (d.completedAt && (!m || d.completedAt > m) ? d.completedAt : m), null);
  const next = days.find((d) => !d.completed);
  const results = plan.quizResults || [];
  return {
    id: plan._id,
    name: plan.skillName,
    level: plan.preferences?.level || 'beginner',
    completedDays: done.length,
    totalDays: days.length,
    percentage: pct(done.length, days.length),
    status: days.length && done.length === days.length ? 'completed' : done.length ? 'in-progress' : 'not-started',
    nextTopic: next ? `Day ${next.day}: ${next.topic}` : null,
    lastActivityAt: lastDone || plan.updatedAt || plan.createdAt,
    quizzes: results.length,
    bestQuiz: results.length ? round(Math.max(...results.map((r) => Number(r.score) || 0))) : null,
  };
}

function roadmapPath(r) {
  const topics = (r.stages || []).flatMap((s) => s.topics || []);
  return {
    id: r._id,
    role: r.role,
    level: r.inputs?.level || null,
    goal: r.inputs?.goal || '',
    stages: (r.stages || []).length,
    stageTitles: (r.stages || []).map((s) => s.title).slice(0, 6),
    topics: topics.length,
    knownTopics: topics.filter((t) => t.known).length,
    totalWeeks: r.totalWeeks || null,
    createdAt: r.createdAt,
  };
}

function skillGapPath(s) {
  return {
    id: s._id,
    targetRole: s.profile?.targetRole,
    readiness: s.analysis?.readiness ?? 0,
    strengths: (s.analysis?.strengths || []).length,
    gaps: (s.analysis?.gaps || []).length,
    topGaps: (s.analysis?.gaps || []).slice(0, 3).map((g) => ({ skill: g.skill, priority: g.priority })),
    messages: (s.messages || []).length,
    updatedAt: s.updatedAt,
  };
}

/** The student's current goal: the newest skill-gap analysis, else the newest roadmap. */
function currentGoal(sessions, roadmaps) {
  const s = sessions[0];
  const r = roadmaps[0];
  if (s && (!r || s.updatedAt >= r.createdAt)) {
    return {
      role: s.profile?.targetRole,
      goal: s.profile?.goal || '',
      readiness: s.analysis?.readiness ?? null,
      hoursPerWeek: s.profile?.hoursPerWeek || null,
      skills: s.profile?.currentSkills || [],
      source: 'skill-gap',
      updatedAt: s.updatedAt,
    };
  }
  if (r) {
    return {
      role: r.role,
      goal: r.inputs?.goal || '',
      readiness: null,
      hoursPerWeek: r.inputs?.hoursPerWeek || null,
      skills: r.inputs?.knownSkills || [],
      source: 'roadmap',
      updatedAt: r.createdAt,
    };
  }
  return null;
}

const getProfileOverview = async (req, res) => {
  try {
    const userId = String(req.params.userId || '').trim();
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const tz = Number.parseInt(req.query.tzOffset, 10);
    const dayKey = makeDayKey(Number.isFinite(tz) && Math.abs(tz) <= 14 * 60 ? tz : 0);
    const now = new Date();

    const [user, { raw, data, usage }, roadmaps, sessions, chats] = await Promise.all([
      User.findOne({ email: userId }).lean(),
      loadActivity(userId),
      Roadmap.find({ userId }).sort({ createdAt: -1 }).select('role inputs stages totalWeeks createdAt').lean(),
      SkillGapSession.find({ userId }).sort({ updatedAt: -1 }).select('profile analysis messages.role updatedAt').lean(),
      ChatbotConversation.find({ userId }).select('messages.role').lean(),
    ]);

    const attempts = [...data.attempts].sort((a, b) => b.at - a.at);
    const answered = attempts.reduce((n, a) => n + a.questions, 0);
    const correct = attempts.reduce((n, a) => n + a.correct, 0);
    const accuracy = weightedAccuracy(attempts, now);
    const score = computeSkillScore(data, now, dayKey);
    const activeDayKeys = activeDaySet(data.events, usage, dayKey);
    const daily = dailyStudy(data.events, usage, dayKey);
    const totalMinutes = [...daily.values()].reduce((n, d) => n + d.minutes, 0);
    const trackedMinutes = [...daily.values()].reduce((n, d) => n + (d.tracked ? d.minutes : 0), 0);
    const lastActive = data.events.reduce((m, e) => (!m || e.at > m ? e.at : m), null);
    const firstActive = data.events.reduce((m, e) => (!m || e.at < m ? e.at : m), null);

    // Accounts have no createdAt; the ObjectId carries the creation time.
    const memberSince = user?._id?.getTimestamp?.() || firstActive || null;

    // Every AI chat (notes, videos, doubts, coach, Novard Agent) is already an event.
    const questionsAsked = data.events.filter((e) => e.kind === 'question').length;

    res.json({
      generatedAt: now,
      account: {
        name: user?.name || '',
        email: userId,
        picture: user?.picture || '',
        mobile: user?.mobile || '',
        bio: user?.bio || '',
        memberSince,
        lastActiveAt: lastActive,
      },
      goal: currentGoal(sessions, roadmaps),

      overview: {
        skillScore: score.total,
        skillScoreBreakdown: score.breakdown,
        accuracy: accuracy === null ? null : round(accuracy),
        testsTaken: attempts.length,
        questionsAnswered: answered,
        correctAnswers: correct,
        studyMinutes: round(totalMinutes),
        trackedMinutes: round(trackedMinutes),
        activeDays: activeDayKeys.size,
        questionsAsked,
        streak: computeStreak(activeDayKeys, now, dayKey),
      },

      tests: {
        history: attempts.slice(0, HISTORY_LIMIT).map((a) => ({
          at: a.at,
          topic: a.topic,
          domain: a.domain,
          source: a.source,
          sourceLabel: SOURCES[a.source] || SOURCES.other,
          difficulty: a.difficulty,
          correct: a.correct,
          questions: a.questions,
          percentage: round(a.percentage),
        })),
        bySource: groupAccuracy(attempts, (a) => a.source, (k) => SOURCES[k] || SOURCES.other, now),
        byDifficulty: groupAccuracy(attempts, (a) => a.difficulty, (k) => k.charAt(0).toUpperCase() + k.slice(1), now),
        bands: scoreBands(attempts),
        best: attempts.length ? attempts.reduce((m, a) => (a.percentage > m.percentage ? a : m)) : null,
      },

      learningPath: {
        plans: raw.plans.map(planPath).sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt)),
        roadmaps: roadmaps.map(roadmapPath),
        skillGaps: sessions.map(skillGapPath),
      },

      activity: {
        heatmap: computeHeatmap(daily, now, dayKey),
        scoreTrend: computeScoreTrend(data, now, dayKey),
        mix: computeMix(data.events),
        library: {
          notes: raw.notes.length,
          videos: raw.ytVideos.length,
          doubts: raw.doubts.length,
          plans: raw.plans.length,
          roadmaps: roadmaps.length,
          coachChats: sessions.length,
          assistantChats: chats.length,
          forumPosts: raw.forumIssues.length,
          forumReplies: raw.forumComments.length,
        },
      },

      proficiency: computeProficiency(data, now),
      strengthsWeaknesses: computeStrengthsAndFocus(data, now),
    });
  } catch (error) {
    console.error('Error building profile overview:', error);
    res.status(500).json({ error: 'Failed to load your profile' });
  }
};

module.exports = { getProfileOverview };
