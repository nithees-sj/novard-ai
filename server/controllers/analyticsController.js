const Notes = require('../models/notes');
const YouTubeVideo = require('../models/youtubeVideo');
const EducationalVideo = require('../models/educationalVideo');
const DoubtClearance = require('../models/doubtClearance');
const SkillPlan = require('../models/skillPlan');
const Course = require('../models/course');
const ForumIssue = require('../models/forumIssue');
const ForumComment = require('../models/forumComment');
const Roadmap = require('../models/roadmap');
const SkillGapSession = require('../models/skillGapSession');
const ChatbotConversation = require('../models/chatbotConversation');
const { usageByDay } = require('./usageController');

/**
 * Learning analytics for the student dashboard.
 *
 * Everything here is derived from what the student has actually done - quiz
 * answers, skill-plan days completed, questions asked, material studied - and
 * is deterministic: the same data always produces the same numbers. (The
 * previous version read fields that do not exist on the models, so quiz scores
 * and plan progress were always zero, and filled the skill radar with
 * Math.random() values that changed on every refresh.)
 *
 * Study time is the time actually spent in the app, recorded by the client's
 * tracker (models/appUsage.js) while the student is active. Days from before
 * tracking existed fall back to an estimate built from a fixed effort per
 * action (EFFORT_MINUTES), and are marked as estimated.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Estimated minutes of study behind each kind of recorded action. */
const EFFORT_MINUTES = {
  materialAdded: 5,      // uploading notes, adding a video, opening a doubt
  question: 3,           // one question asked in any AI chat (plus reading the answer)
  quizQuestion: 1.5,     // per quiz question answered
  planDay: 25,           // one skill-plan day completed (tutorial + objective)
  forumPost: 5,
  forumComment: 3,
};

/** Quiz results count for less as they age: a result from 30 days ago weighs half as much. */
const RECENCY_HALF_LIFE_DAYS = 30;

/**
 * Below this many answered questions a topic gets no level and is not listed as
 * a strength or weakness - one lucky guess is not mastery. A single threshold,
 * so a listed topic can never carry a "Not enough data" badge.
 */
const MIN_QUESTIONS_FOR_LEVEL = 5;
const MIN_QUESTIONS_FOR_TOPIC = MIN_QUESTIONS_FOR_LEVEL;

/**
 * Subject domains for the proficiency chart, matched on whole words so that
 * e.g. "ai" does not match "maintain" or "explain" (the old substring check
 * put nearly every student into AI & ML).
 */
const DOMAINS = [
  { name: 'AI & ML', terms: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'neural', 'neural network', 'llm', 'llms', 'nlp', 'generative', 'genai', 'gpt', 'transformer', 'transformers', 'tensorflow', 'pytorch', 'computer vision', 'prompt engineering'] },
  { name: 'Web Dev', terms: ['web', 'frontend', 'front end', 'front-end', 'html', 'css', 'javascript', 'js', 'typescript', 'react', 'reactjs', 'hooks', 'vue', 'angular', 'next.js', 'nextjs', 'tailwind', 'dom', 'ui', 'ux'] },
  { name: 'Backend', terms: ['backend', 'back end', 'back-end', 'node', 'nodejs', 'node.js', 'express', 'api', 'apis', 'rest', 'graphql', 'django', 'flask', 'fastapi', 'spring', 'microservice', 'microservices', 'server'] },
  { name: 'DevOps & Cloud', terms: ['devops', 'docker', 'container', 'containers', 'kubernetes', 'k8s', 'pod', 'pods', 'ci', 'cd', 'ci/cd', 'jenkins', 'github actions', 'terraform', 'ansible', 'aws', 'azure', 'gcp', 'cloud', 'linux', 'deployment', 'nginx'] },
  { name: 'Data Science', terms: ['data science', 'data analysis', 'data analyst', 'analytics', 'pandas', 'numpy', 'statistics', 'visualization', 'matplotlib', 'tableau', 'power bi', 'excel', 'regression'] },
  { name: 'Databases', terms: ['database', 'databases', 'sql', 'mysql', 'postgres', 'postgresql', 'mongodb', 'mongo', 'nosql', 'redis', 'dbms', 'query', 'queries', 'indexing'] },
  { name: 'Networking', terms: ['network', 'networks', 'networking', 'osi', 'tcp', 'udp', 'ip', 'ipv4', 'ipv6', 'dns', 'subnet', 'subnetting', 'routing', 'router', 'http', 'https', 'protocol', 'protocols', 'lan', 'wan'] },
  { name: 'Security', terms: ['security', 'cybersecurity', 'cyber', 'encryption', 'cryptography', 'vulnerability', 'vulnerabilities', 'owasp', 'penetration', 'firewall', 'malware', 'authentication', 'xss'] },
  { name: 'Mobile', terms: ['mobile', 'android', 'ios', 'swift', 'kotlin', 'flutter', 'react native', 'dart'] },
  { name: 'Programming', terms: ['programming', 'coding', 'python', 'java', 'c++', 'c#', 'golang', 'rust', 'algorithm', 'algorithms', 'data structure', 'data structures', 'dsa', 'oop', 'recursion'] },
];
const FALLBACK_DOMAIN = 'General';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const DOMAIN_MATCHERS = DOMAINS.map((d) => ({
  name: d.name,
  patterns: d.terms.map((t) => new RegExp(`(^|[^a-z0-9+#])${escapeRegex(t)}($|[^a-z0-9+#])`, 'i')),
}));

function classifyDomain(text) {
  const haystack = String(text || '').toLowerCase();
  if (!haystack.trim()) return FALLBACK_DOMAIN;
  let best = FALLBACK_DOMAIN;
  let bestHits = 0;
  for (const domain of DOMAIN_MATCHERS) {
    const hits = domain.patterns.reduce((n, re) => n + (re.test(haystack) ? 1 : 0), 0);
    if (hits > bestHits) {
      best = domain.name;
      bestHits = hits;
    }
  }
  return best;
}

// ── small helpers ──────────────────────────────────────────────────────────

const toDate = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round1 = (n) => Math.round(n * 10) / 10;
const formatNumber = (num) => Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Calendar-day key in the *student's* timezone. The client sends its
 * getTimezoneOffset(); without it "today" would follow the server's clock and
 * a late-evening session could be booked to the wrong day, breaking streaks.
 */
function makeDayKey(tzOffsetMinutes) {
  return (date) => new Date(date.getTime() - tzOffsetMinutes * 60 * 1000).toISOString().slice(0, 10);
}

function levelFor(accuracy, questions) {
  if (accuracy === null || questions < MIN_QUESTIONS_FOR_LEVEL) return 'Not enough data';
  if (accuracy >= 85) return 'Expert';
  if (accuracy >= 70) return 'Advanced';
  if (accuracy >= 50) return 'Intermediate';
  return 'Beginner';
}

/** Question-weighted, recency-weighted mean accuracy. null when there are no results. */
function weightedAccuracy(attempts, asOf) {
  let weightSum = 0;
  let total = 0;
  for (const a of attempts) {
    const ageDays = Math.max(0, (asOf - a.at) / DAY_MS);
    const w = a.questions * Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
    weightSum += w;
    total += w * a.percentage;
  }
  return weightSum > 0 ? total / weightSum : null;
}

// ── collection: turn stored documents into events and quiz attempts ────────

/**
 * A quiz counts only once the student has actually submitted it. New results
 * carry attemptedAt; for records saved before that field existed, the Video
 * and Doubt quizzes are created with score 0 / null at generation time, so a
 * missing attemptedAt plus a zero/null score means "generated, never taken".
 */
function collectActivity({ notes, ytVideos, eduVideos, doubts, plans, courses, forumIssues, forumComments, roadmaps = [], coachSessions = [], chats = [] }, userId) {
  const events = [];      // { at, minutes, kind }
  const attempts = [];    // { at, percentage, questions, correct, topic, domain }
  const items = [];       // { key, title, domain } - distinct things studied

  const addEvent = (at, kind, minutes) => {
    const d = toDate(at);
    if (d) events.push({ at: d, kind, minutes });
  };

  const addAttempt = (at, correct, total, topic, domainText, source = 'other', difficulty = null) => {
    const d = toDate(at);
    const questions = Number(total) || 0;
    if (!d || questions <= 0) return;
    const right = clamp(Number(correct) || 0, 0, questions);
    attempts.push({
      at: d,
      questions,
      correct: right,
      percentage: (right / questions) * 100,
      topic: topic || 'Untitled',
      domain: classifyDomain(domainText || topic),
      source,
      difficulty: difficulty ? String(difficulty).toLowerCase() : null,
    });
    events.push({ at: d, kind: 'quiz', minutes: questions * EFFORT_MINUTES.quizQuestion });
  };

  const addChat = (history) => {
    (history || []).forEach((m) => {
      if (m && m.role === 'user') addEvent(m.timestamp, 'question', EFFORT_MINUTES.question);
    });
  };

  // Notes: score is { correct, total, percentage }.
  notes.forEach((n) => {
    const text = `${n.title || ''} ${n.fileName || ''}`;
    items.push({ key: `note:${n._id}`, title: n.title, domain: classifyDomain(text), at: toDate(n.uploadedAt) });
    addEvent(n.uploadedAt, 'materialAdded', EFFORT_MINUTES.materialAdded);
    addChat(n.chatHistory);
    (n.quizzes || []).forEach((q) => {
      const s = q.score || {};
      const total = Number(s.total) || 0;
      if (total <= 0) return; // generated but not submitted
      const correct = s.correct !== undefined ? s.correct : Math.round(((Number(s.percentage) || 0) / 100) * total);
      addAttempt(q.attemptedAt || q.createdAt, correct, total, n.title, text, 'notes', q.settings?.difficulty);
    });
  });

  // YouTube + educational videos: score is the number of correct answers.
  const collectVideo = (v, kind) => {
    const text = `${v.title || ''} ${v.description || ''}`.slice(0, 600);
    items.push({ key: `${kind}:${v._id}`, title: v.title, domain: classifyDomain(text), at: toDate(v.createdAt) });
    addEvent(v.createdAt, 'materialAdded', EFFORT_MINUTES.materialAdded);
    addChat(v.chatHistory);
    (v.quizzes || []).forEach((q) => {
      const legacyTaken = !q.attemptedAt && Number(q.score) > 0;
      if (!q.attemptedAt && !legacyTaken) return;
      const total = Number(q.totalQuestions) || (q.questions || []).length;
      addAttempt(q.attemptedAt || q.completedAt, q.score, total, v.title, text, kind, q.settings?.difficulty);
    });
  };
  ytVideos.forEach((v) => collectVideo(v, 'youtube'));
  eduVideos.forEach((v) => collectVideo(v, 'educational'));

  // Doubts: score is the number correct; it is null until submitted.
  doubts.forEach((d) => {
    const text = `${d.title || ''} ${d.description || ''}`;
    items.push({ key: `doubt:${d._id}`, title: d.title, domain: classifyDomain(text), at: toDate(d.createdAt) });
    addEvent(d.createdAt, 'materialAdded', EFFORT_MINUTES.materialAdded);
    addChat(d.chatHistory);
    (d.quizzes || []).forEach((q) => {
      if (!q.attemptedAt && (q.score === null || q.score === undefined)) return;
      const total = Number(q.totalQuestions) || (q.questions || []).length;
      addAttempt(q.attemptedAt || q.completedAt, q.score, total, d.title, text, 'doubt', q.settings?.difficulty);
    });
  });

  // Skill plans: day completion and plan quizzes (score is a percentage).
  let totalDays = 0;
  let completedDays = 0;
  let activePlans = 0;
  let finishedPlans = 0;
  plans.forEach((p) => {
    const text = `${p.skillName || ''} ${p.description || ''} ${(p.preferences?.focusAreas || []).join(' ')}`;
    items.push({ key: `plan:${p._id}`, title: p.skillName, domain: classifyDomain(text), at: toDate(p.createdAt) });
    addEvent(p.createdAt, 'materialAdded', EFFORT_MINUTES.materialAdded);

    const days = p.dailyPlan || [];
    const done = days.filter((d) => d.completed);
    totalDays += days.length;
    completedDays += done.length;
    if (days.length > 0 && done.length === days.length) finishedPlans += 1;
    else if (days.length > 0) activePlans += 1;
    done.forEach((d) => addEvent(d.completedAt, 'planDay', EFFORT_MINUTES.planDay));

    (p.quizResults || []).forEach((r) => {
      const total = Number(r.totalQuestions) || Number(r.questionCount) || 0;
      const correct = r.correctAnswers !== undefined ? r.correctAnswers : Math.round(((Number(r.score) || 0) / 100) * total);
      addAttempt(r.completedAt, correct, total, p.skillName, text, 'plan', r.difficulty);
    });
  });

  // Teacher courses: only this student's results.
  courses.forEach((c) => {
    (c.videos || []).forEach((v) => {
      (v.quizResults || []).forEach((r) => {
        if (r.userEmail !== userId) return;
        const text = `${c.title || ''} ${v.title || ''} ${v.description || ''}`;
        items.push({ key: `course:${c._id}:${v._id}`, title: v.title, domain: classifyDomain(text), at: toDate(r.completedAt) });
        addAttempt(r.completedAt, r.correctAnswers, r.totalQuestions, v.title, text, 'course');
      });
    });
  });

  // Career tools and the assistant: generating a roadmap, and every question to the
  // skill-gap coach or the Novard Agent (these were not counted at all before).
  roadmaps.forEach((r) => addEvent(r.createdAt, 'materialAdded', EFFORT_MINUTES.materialAdded));
  coachSessions.forEach((c) => {
    addEvent(c.createdAt, 'materialAdded', EFFORT_MINUTES.materialAdded);
    (c.messages || []).forEach((m) => { if (m.role === 'user') addEvent(m.createdAt, 'question', EFFORT_MINUTES.question); });
  });
  chats.forEach((c) => (c.messages || []).forEach((m) => {
    if (m.role === 'user') addEvent(m.createdAt, 'question', EFFORT_MINUTES.question);
  }));

  forumIssues.forEach((i) => addEvent(i.createdAt, 'forumPost', EFFORT_MINUTES.forumPost));
  forumComments.forEach((c) => addEvent(c.createdAt, 'forumComment', EFFORT_MINUTES.forumComment));

  return { events, attempts, items, plan: { totalDays, completedDays, activePlans, finishedPlans, total: plans.length } };
}

// ── metrics ────────────────────────────────────────────────────────────────

/**
 * Skill score, 0-1000, built from four parts that each reflect something the
 * student controls:
 *   mastery      400  quiz accuracy, scaled by how much has been assessed
 *   progress     250  skill-plan days completed (30 days = full marks)
 *   consistency  200  active days in the trailing 30 (20 days = full marks)
 *   breadth      150  distinct materials studied (10 = full marks)
 * It is evaluated "as of" a date so the trend can compare against a week ago.
 */
function computeSkillScore(data, asOf, dayKey) {
  const attempts = data.attempts.filter((a) => a.at <= asOf);
  const events = data.events.filter((e) => e.at <= asOf);

  const answered = attempts.reduce((n, a) => n + a.questions, 0);
  const accuracy = weightedAccuracy(attempts, asOf);
  const mastery = accuracy === null ? 0 : (accuracy / 100) * 400 * Math.min(1, answered / 20);

  const planDaysDone = events.filter((e) => e.kind === 'planDay').length;
  const progress = Math.min(1, planDaysDone / 30) * 250;

  const windowStart = new Date(asOf.getTime() - 30 * DAY_MS);
  const activeDays = new Set(events.filter((e) => e.at > windowStart).map((e) => dayKey(e.at))).size;
  const consistency = Math.min(1, activeDays / 20) * 200;

  const itemsSoFar = data.items.filter((i) => !i.at || i.at <= asOf).length;
  const breadth = Math.min(1, itemsSoFar / 10) * 150;

  return {
    total: Math.round(mastery + progress + consistency + breadth),
    breakdown: {
      mastery: Math.round(mastery),
      progress: Math.round(progress),
      consistency: Math.round(consistency),
      breadth: Math.round(breadth),
    },
  };
}

function computeStreak(activeDayKeys, now, dayKey) {
  const has = (d) => activeDayKeys.has(dayKey(d));
  const todayActive = has(now);
  const yesterday = new Date(now.getTime() - DAY_MS);

  let current = 0;
  let cursor = todayActive ? new Date(now) : has(yesterday) ? yesterday : null;
  while (cursor && has(cursor)) {
    current += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  // Longest run over the whole history.
  const sorted = [...activeDayKeys].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  sorted.forEach((key) => {
    const t = Date.parse(`${key}T00:00:00Z`);
    run = prev !== null && t - prev === DAY_MS ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = t;
  });

  let status = 'inactive';
  let message = 'Study today to start a streak';
  if (current > 0 && todayActive) {
    status = 'active';
    message = current >= 7 ? 'Outstanding consistency' : current >= 3 ? 'Keep it going' : 'Good start - come back tomorrow';
  } else if (current > 0) {
    status = 'at-risk';
    message = 'Study today to keep your streak';
  } else if (longest > 0) {
    message = `Best so far: ${longest} day${longest === 1 ? '' : 's'}`;
  }

  return { days: current, longest: Math.max(longest, current), status, message, activeToday: todayActive };
}

/**
 * Study minutes per local day. Tracked time in the app and the activity-based
 * estimate are both lower bounds on the real time (the tracker ignores idle
 * reading; the estimate ignores everything but saved actions), so a day gets
 * whichever is larger. That also keeps the day tracking was switched on from
 * dropping to a minute. Returns Map(day -> { minutes, tracked, activities, quizzes }).
 */
function dailyStudy(events, usage, dayKey) {
  const days = new Map();
  const get = (key) => {
    if (!days.has(key)) days.set(key, { estimate: 0, trackedMinutes: 0, activities: 0, quizzes: 0 });
    return days.get(key);
  };
  events.forEach((e) => {
    const d = get(dayKey(e.at));
    d.estimate += e.minutes;
    d.activities += 1;
    if (e.kind === 'quiz') d.quizzes += 1;
  });
  (usage || new Map()).forEach((minutes, key) => { get(key).trackedMinutes = minutes; });

  const out = new Map();
  days.forEach((d, key) => {
    const tracked = d.trackedMinutes >= 1;
    out.set(key, {
      minutes: Math.max(d.trackedMinutes, d.estimate),
      tracked,
      activities: d.activities,
      quizzes: d.quizzes,
    });
  });
  return out;
}

/** Days that count towards streaks: any recorded activity, or at least this much tracked time. */
const MIN_TRACKED_MINUTES_FOR_ACTIVE_DAY = 5;
function activeDaySet(events, usage, dayKey) {
  const keys = new Set(events.map((e) => dayKey(e.at)));
  (usage || new Map()).forEach((minutes, key) => { if (minutes >= MIN_TRACKED_MINUTES_FOR_ACTIVE_DAY) keys.add(key); });
  return keys;
}

function computeWeekly(daily, now, dayKey) {
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const key = dayKey(new Date(now.getTime() - i * DAY_MS));
    const d = daily.get(key) || { minutes: 0, tracked: false, activities: 0, quizzes: 0 };
    days.push({
      date: key,
      day: WEEKDAYS[new Date(`${key}T00:00:00Z`).getUTCDay()],
      minutes: Math.round(d.minutes),
      hours: round1(d.minutes / 60),
      activities: d.activities,
      quizzes: d.quizzes,
      tracked: d.tracked,
    });
  }

  let previousTotal = 0;
  for (let i = 13; i >= 7; i -= 1) {
    previousTotal += (daily.get(dayKey(new Date(now.getTime() - i * DAY_MS))) || { minutes: 0 }).minutes;
  }

  return {
    days,
    totalMinutes: days.reduce((n, d) => n + d.minutes, 0),
    previousTotalMinutes: Math.round(previousTotal),
    activeDays: days.filter((d) => d.minutes > 0 || d.activities > 0).length,
    estimated: days.some((d) => d.minutes > 0 && !d.tracked),
    tracked: days.some((d) => d.tracked),
  };
}

function computeProficiency(data, now) {
  const byDomain = new Map();
  const bucket = (name) => {
    if (!byDomain.has(name)) byDomain.set(name, { name, attempts: [], items: 0 });
    return byDomain.get(name);
  };
  data.items.forEach((i) => { bucket(i.domain).items += 1; });
  data.attempts.forEach((a) => { bucket(a.domain).attempts.push(a); });

  return [...byDomain.values()]
    .map((d) => {
      const questions = d.attempts.reduce((n, a) => n + a.questions, 0);
      const raw = weightedAccuracy(d.attempts, now);
      // Level from the same rounded value that is displayed: the weighted mean
      // of an exact 50% can come out as 49.999..., which would show "50%"
      // next to a "Beginner" badge.
      const accuracy = raw === null ? null : Math.round(raw);
      return {
        name: d.name,
        score: accuracy,
        questions,
        attempts: d.attempts.length,
        items: d.items,
        level: levelFor(accuracy, questions),
      };
    })
    // Most-studied first; the chart shows the student's own subjects, not a fixed list.
    .sort((a, b) => (b.items + b.attempts) - (a.items + a.attempts) || (b.score ?? -1) - (a.score ?? -1))
    .slice(0, 6);
}

function computeStrengthsAndFocus(data, now) {
  const byTopic = new Map();
  data.attempts.forEach((a) => {
    const key = `${a.domain}::${a.topic}`;
    if (!byTopic.has(key)) byTopic.set(key, { name: a.topic, domain: a.domain, attempts: [] });
    byTopic.get(key).attempts.push(a);
  });

  const topics = [...byTopic.values()].map((t) => {
    const questions = t.attempts.reduce((n, a) => n + a.questions, 0);
    const accuracy = Math.round(weightedAccuracy(t.attempts, now));
    const latest = t.attempts.reduce((m, a) => (a.at > m ? a.at : m), t.attempts[0].at);
    return {
      name: t.name,
      domain: t.domain,
      percentage: accuracy,
      formattedPercentage: `${accuracy}%`,
      questions,
      attempts: t.attempts.length,
      level: levelFor(accuracy, questions),
      lastAttemptAt: latest,
    };
  });

  const assessed = topics.filter((t) => t.questions >= MIN_QUESTIONS_FOR_TOPIC);
  const strengths = assessed
    .filter((t) => t.percentage >= 70)
    .sort((a, b) => b.percentage - a.percentage || b.questions - a.questions)
    .slice(0, 3);
  const focusAreas = assessed
    .filter((t) => t.percentage < 70)
    .sort((a, b) => a.percentage - b.percentage || b.questions - a.questions)
    .slice(0, 3);

  return {
    strengths,
    focusAreas,
    assessedTopics: assessed.length,
    pendingTopics: topics.length - assessed.length,
  };
}

// ── loading ────────────────────────────────────────────────────────────────

/** Everything the student has stored, plus the derived events/attempts/items. */
async function loadActivity(userId) {
  const [notes, ytVideos, eduVideos, doubts, plans, courses, forumIssues, forumComments, roadmaps, coachSessions, chats, usage] = await Promise.all([
    Notes.find({ userId }).select('title fileName uploadedAt chatHistory quizzes').lean(),
    YouTubeVideo.find({ userId }).select('title description createdAt chatHistory quizzes').lean(),
    EducationalVideo.find({ userId }).select('title description createdAt chatHistory quizzes').lean(),
    DoubtClearance.find({ userId }).select('title description createdAt chatHistory quizzes').lean(),
    SkillPlan.find({ userId }).lean(),
    Course.find({ 'videos.quizResults.userEmail': userId }).lean(),
    ForumIssue.find({ userEmail: userId }).select('createdAt status').lean(),
    ForumComment.find({ userEmail: userId, isAI: { $ne: true } }).select('createdAt').lean(),
    Roadmap.find({ userId }).select('createdAt').lean(),
    SkillGapSession.find({ userId }).select('createdAt messages.role messages.createdAt').lean(),
    ChatbotConversation.find({ userId }).select('messages.role messages.createdAt').lean(),
    usageByDay(userId),
  ]);
  const raw = { notes, ytVideos, eduVideos, doubts, plans, courses, forumIssues, forumComments, roadmaps, coachSessions, chats };
  return { raw, usage, data: collectActivity(raw, userId) };
}

// ── handler ────────────────────────────────────────────────────────────────

const getUserAnalytics = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const tz = Number.parseInt(req.query.tzOffset, 10);
    const tzOffset = Number.isFinite(tz) && Math.abs(tz) <= 14 * 60 ? tz : 0;
    const dayKey = makeDayKey(tzOffset);
    const now = new Date();

    const { data, usage } = await loadActivity(userId);

    const activeDayKeys = activeDaySet(data.events, usage, dayKey);
    const daily = dailyStudy(data.events, usage, dayKey);

    const current = computeSkillScore(data, now, dayKey);
    const weekAgo = computeSkillScore(data, new Date(now.getTime() - 7 * DAY_MS), dayKey);
    const delta = current.total - weekAgo.total;

    const answered = data.attempts.reduce((n, a) => n + a.questions, 0);
    const correct = data.attempts.reduce((n, a) => n + a.correct, 0);
    const overallAccuracy = weightedAccuracy(data.attempts, now);

    const plan = data.plan;
    const completionPct = plan.totalDays > 0 ? Math.round((plan.completedDays / plan.totalDays) * 100) : 0;
    const planSummary = plan.total === 0
      ? 'No learning plans yet'
      : `${plan.activePlans} active · ${plan.finishedPlans} finished`;

    const lastActive = data.events.reduce((m, e) => (!m || e.at > m ? e.at : m), null);

    res.json({
      generatedAt: now,
      hasActivity: data.events.length > 0,
      lastActiveAt: lastActive,

      skillScore: {
        value: current.total,
        max: 1000,
        formattedValue: formatNumber(current.total),
        breakdown: current.breakdown,
        change: delta,
        trend: delta === 0 ? 'No change' : `${delta > 0 ? '+' : ''}${delta} pts`,
        trendDirection: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
        trendLabel: 'vs last week',
      },

      quizPerformance: {
        accuracy: overallAccuracy === null ? null : Math.round(overallAccuracy),
        quizzesTaken: data.attempts.length,
        questionsAnswered: answered,
        correctAnswers: correct,
      },

      courseCompletion: {
        percentage: completionPct,
        formattedPercentage: `${completionPct}%`,
        completedDays: plan.completedDays,
        totalDays: plan.totalDays,
        active: plan.activePlans,
        finished: plan.finishedPlans,
        total: plan.total,
        summary: planSummary,
      },

      studyStreak: computeStreak(activeDayKeys, now, dayKey),
      weeklyActivity: computeWeekly(daily, now, dayKey),
      skillProficiency: computeProficiency(data, now),
      strengthsWeaknesses: computeStrengthsAndFocus(data, now),
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

module.exports = {
  getUserAnalytics,
  computeSkillScore,
  computeStreak,
  computeProficiency,
  computeStrengthsAndFocus,
  weightedAccuracy,
  // exported for testing
  loadActivity,
  dailyStudy,
  activeDaySet,
  makeDayKey,
  DAY_MS,
  _internal: { classifyDomain, collectActivity, computeSkillScore, computeStreak, computeWeekly, dailyStudy, weightedAccuracy, makeDayKey },
};
