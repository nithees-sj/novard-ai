const SkillPlan = require('../models/skillPlan');
const { MODELS } = require('../config/ai');
const { complete } = require('../ai/groqClient');
const { parseModelJson } = require('../utils/parseModelJson');
const { mapWithConcurrency } = require('../utils/concurrency');
const { readQuizOptions, generateQuiz } = require('./quizService');
const { searchVideos } = require('./youtubeService');
const { badRequest, conflict, notFound, upstreamError } = require('../utils/httpError');
const { objectId, text, integer, number, oneOf } = require('../utils/validate');
const logger = require('../utils/logger');
const { PASS_PERCENT, DAY_QUIZ_QUESTIONS, passed: hasPassed } = require('../config/learning');

/** Skill Unlocker: day-by-day learning plans with a video per day, progress and quizzes. */

const MIN_DAYS = 10;
const MAX_DAYS = 60; // the page offers 10-30; the Novard Agent may ask for up to 60
const LEVELS = ['beginner', 'intermediate'];
const QUIZ_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

/** Clean the student's plan request; throws 400 on anything unusable. */
function readPlanRequest({ skillName, duration, description, preferences, topics }) {
  if (!skillName || !duration || !description) throw badRequest('Missing required fields');
  const days = number(duration, 'Duration', { min: -Infinity });
  if (days < MIN_DAYS) throw badRequest(`Duration must be at least ${MIN_DAYS} days`);
  if (days > MAX_DAYS || !Number.isInteger(days)) throw badRequest(`Duration must be a whole number of days, at most ${MAX_DAYS}`);

  const prefs = preferences && typeof preferences === 'object' ? preferences : {};
  const cleanTopics = (Array.isArray(topics) ? topics : [])
    .filter((t) => typeof t === 'string' || typeof t === 'number')
    .map((t) => String(t).replace(/\s+/g, ' ').trim().slice(0, 200)).filter(Boolean).slice(0, MAX_DAYS);
  return {
    skillName: text(skillName, 'Skill name', { max: 100 }),
    duration: days,
    description: text(description, 'Learning goal', { max: 1000, collapse: false }),
    preferences: {
      level: oneOf(prefs.level, 'Level', LEVELS, { fallback: 'beginner' }),
      focusAreas: (Array.isArray(prefs.focusAreas) ? prefs.focusAreas : [])
        .map((f) => String(f).trim().slice(0, 60)).filter(Boolean).slice(0, 10),
      language: text(prefs.language, 'Language', { required: false, max: 40 }) || 'English',
      teachingStyle: text(prefs.teachingStyle, 'Teaching style', { required: false, max: 60 }) || 'Standard',
    },
    // Tasks the plan must follow, in order (a todo list turned into a plan).
    ...(cleanTopics.length ? { topics: cleanTopics } : {}),
  };
}

function planPrompt({ skillName, duration, description, preferences, topics = [] }) {
  return `Generate a ${duration}-day learning plan for "${skillName}".

Learning Goal: ${description}
Level: ${preferences.level}
${preferences.focusAreas.length > 0 ? `Focus Areas: ${preferences.focusAreas.join(', ')}` : ''}
Language Preference: ${preferences.language}
Teaching Style Preference: ${preferences.teachingStyle}
${topics.length > 0 ? `
The student's own task list - the plan must cover every task, in this order. Give a big task several days, combine small related ones into one day, and use any spare days for practice and revision:
${topics.map((t, i) => `${i + 1}. ${t}`).join('\n')}
` : ''}
Create a structured day-by-day learning plan from absolute basics to practical application.

For each day (Days 1-${duration}), provide:
1. Topic - What specific topic to learn that day
2. Objective - Clear learning objective for that day (1-2 sentences)
3. Video Recommendation - Suggest ONE highly relevant YouTube video title.
   - Must match the preferred language (${preferences.language})
   - Must match the teaching style (${preferences.teachingStyle})

Requirements:
- Start from basics (no assumed prior knowledge)
- Progress logically day by day
- Include hands-on/practical days towards the end
- Make it actionable and realistic

Format your response as a JSON array like this:
[
  {
    "day": 1,
    "topic": "...",
    "objective": "...",
    "videoTitle": "..."
  },
  ...
]

IMPORTANT: Return ONLY the JSON array, no other text.`;
}

/** The model's days, numbered 1..n and with every required field, or null when unusable. */
function normaliseDays(raw, duration) {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.days) ? raw.days : Array.isArray(raw?.plan) ? raw.plan : [];
  const days = list
    .filter((d) => d && typeof d === 'object' && String(d.topic || '').trim())
    .slice(0, duration)
    .map((d, i) => ({
      day: i + 1,
      topic: String(d.topic).trim().slice(0, 200),
      objective: String(d.objective || d.topic).trim().slice(0, 500),
      videoTitle: String(d.videoTitle || d.topic).trim().slice(0, 200),
    }));
  return days.length ? days : null;
}

const toVideo = (v) => ({ videoId: v.videoId, title: v.title, thumbnailUrl: v.thumbnailUrl || '', url: v.url });

/** One YouTube video per day; a YouTube search link when no video can be found. */
async function videoForDay(day, plan) {
  const query = `${day.videoTitle} ${plan.skillName} tutorial in ${plan.preferences.language}`;
  try {
    const [first] = await searchVideos(query, 1);
    if (first) return toVideo(first);
  } catch (error) {
    logger.warn('Video search failed for a plan day', { day: day.day, error: error.message });
  }
  return { videoId: null, title: day.videoTitle, thumbnailUrl: '', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` };
}

/**
 * Generate a day-by-day plan (with a YouTube video per day) and save it.
 * Shared by the Skill Unlocker page and the Novard Agent.
 */
async function createSkillPlan({ userId, ...request }) {
  if (!userId) throw badRequest('Missing required fields');
  const plan = readPlanRequest(request);

  const reply = await complete({
    messages: [
      { role: 'system', content: 'You are an expert learning curriculum designer. Always return valid JSON arrays.' },
      { role: 'user', content: planPrompt(plan) },
    ],
    model: MODELS.REASONING,
    temperature: 0.7,
    topP: 1,
  });

  let days;
  try {
    days = normaliseDays(parseModelJson(reply, { context: 'learning plan' }), plan.duration);
  } catch (error) {
    logger.warn('Could not parse the learning plan', { error: error.message });
  }
  if (!days || days.length < MIN_DAYS) throw upstreamError('Failed to parse learning plan from AI');
  // A plan claiming more days than it has could never reach 100%.
  plan.duration = days.length;

  const videos = await mapWithConcurrency(days, 5, (day) => videoForDay(day, plan));
  const dailyPlan = days.map((day, i) => ({
    day: day.day,
    topic: day.topic,
    objective: day.objective,
    youtubeVideo: videos[i],
    completed: false,
  }));

  const fields = { ...plan };
  delete fields.topics; // they shaped the prompt; the plan's days carry them
  return SkillPlan.create({ userId, ...fields, dailyPlan });
}

async function findOwnPlan(userId, planId) {
  const plan = await SkillPlan.findOne({ _id: objectId(planId, 'plan id'), userId });
  if (!plan) throw notFound('Plan not found');
  return plan;
}

/**
 * A day as the client sees it: never the answers of a quiz in progress. The
 * day is completed only by passing its quiz.
 */
function presentDay(d) {
  const attempts = d.quizAttempts || [];
  return {
    day: d.day,
    topic: d.topic,
    objective: d.objective,
    youtubeVideo: d.youtubeVideo,
    completed: Boolean(d.completed),
    completedAt: d.completedAt || null,
    quizInProgress: Boolean(d.quiz?.questions?.length),
    attempts: attempts.length,
    bestScore: attempts.length ? Math.max(...attempts.map((a) => a.percentage)) : null,
    lastScore: attempts.length ? attempts[attempts.length - 1].percentage : null,
  };
}

async function listPlans(userId) {
  const plans = await SkillPlan.find({ userId })
    .sort({ createdAt: -1 })
    .select('skillName duration createdAt quizCompleted quizScore dailyPlan')
    .lean();

  return plans.map((plan) => {
    const completedDays = plan.dailyPlan.filter((day) => day.completed).length;
    return {
      planId: plan._id,
      skillName: plan.skillName,
      duration: plan.duration,
      createdAt: plan.createdAt,
      progress: Math.round((completedDays / plan.duration) * 100),
      completed: completedDays === plan.duration,
      quizCompleted: plan.quizCompleted,
      quizScore: plan.quizScore,
      passPercent: PASS_PERCENT,
      dailyPlan: plan.dailyPlan.map(presentDay),
    };
  });
}

/** A quiz on the days the student has completed (only what they have covered). */
async function generatePlanQuiz({ userId, planId, body }) {
  const plan = await findOwnPlan(userId, planId);
  const completedDays = plan.dailyPlan.filter((day) => day.completed);
  if (completedDays.length === 0) {
    throw badRequest('Please complete at least one day of learning before taking the quiz');
  }

  const options = readQuizOptions(body);
  const covered = completedDays.map((d) => `Day ${d.day}: ${d.topic} - ${d.objective}`).join('\n');
  const questions = await generateQuiz({
    subject: plan.skillName,
    content:
      `Skill: ${plan.skillName}\nGoal: ${plan.description}\n` +
      `Learner level: ${plan.preferences?.level || 'beginner'}\n\n` +
      `Topics the student has completed (ONLY test these):\n${covered}`,
    options,
  });

  const quizId = `quiz_${plan._id}_${Date.now()}`;
  await SkillPlan.updateOne({ _id: plan._id }, { $set: { quizId, quizConfiguration: { ...options, createdAt: new Date() } } });

  return {
    quizId,
    questions,
    configuration: { ...options, completedDays: completedDays.length, totalDays: plan.duration },
  };
}

async function saveQuizResult({ userId, planId, quizId, score, totalQuestions, questionCount, difficulty, style, focus }) {
  if (!quizId || score === undefined) throw badRequest('Missing required fields');
  const plan = await findOwnPlan(userId, planId);

  const percentage = number(score, 'Score', { min: 0, max: 100 });
  const total = integer(totalQuestions, 'Total questions', { min: 1, max: 100 });
  const result = {
    score: percentage,
    correctAnswers: Math.round((percentage / 100) * total),
    totalQuestions: total,
    questionCount: integer(questionCount, 'Question count', { min: 1, max: 100, required: false, fallback: total }),
    style: text(style, 'Style', { required: false, max: 40 }) || undefined,
    focus: text(focus, 'Focus', { required: false, max: 200 }) || undefined,
    difficulty: oneOf(difficulty, 'Difficulty', QUIZ_DIFFICULTIES, { fallback: plan.quizConfiguration?.difficulty || 'intermediate' }),
    completedDaysAtQuiz: plan.dailyPlan.filter((day) => day.completed).length,
    completedAt: new Date(),
  };

  // quizCompleted / quizScore are the older single-result fields, kept for existing readers.
  await SkillPlan.updateOne(
    { _id: plan._id },
    { $push: { quizResults: result }, $set: { quizCompleted: true, quizScore: percentage } }
  );
  return { message: 'Quiz results saved successfully', score: percentage, totalQuestions: total, result };
}

/** A day is completed only by passing its quiz; it cannot be ticked by hand. */
async function toggleDay({ userId, planId, dayNumber }) {
  const plan = await findOwnPlan(userId, planId);
  const dayNo = integer(dayNumber, 'Day', { min: 1, max: MAX_DAYS * 10 });
  if (!plan.dailyPlan.some((d) => d.day === dayNo)) throw notFound('Day not found');
  throw conflict(`Pass the day's quiz (${PASS_PERCENT}% or more) to complete it.`, { code: 'QUIZ_REQUIRED' });
}

async function findOwnDay(userId, planId, dayNumber) {
  const plan = await findOwnPlan(userId, planId);
  const dayNo = integer(dayNumber, 'Day', { min: 1, max: MAX_DAYS * 10 });
  const day = plan.dailyPlan.find((d) => d.day === dayNo);
  if (!day) throw notFound('Day not found');
  return { plan, day, dayNo };
}

const DAY_DIFFICULTY = { beginner: 'beginner', intermediate: 'intermediate' };
const questionsForClient = (questions) => questions.map((q) => ({ question: q.question, options: q.options }));

/**
 * The quiz that completes a day: a few questions on that day's topic and
 * objective. Asking again before submitting returns the same quiz.
 */
async function startDayQuiz({ userId, planId, dayNumber }) {
  const { plan, day, dayNo } = await findOwnDay(userId, planId, dayNumber);
  if (day.completed) throw conflict('This day is already completed.', { code: 'ALREADY_COMPLETED' });
  if (day.quiz?.questions?.length) {
    return { day: dayNo, passPercent: PASS_PERCENT, questions: questionsForClient(day.quiz.questions) };
  }

  const questions = await generateQuiz({
    subject: `${plan.skillName} - day ${dayNo}: ${day.topic}`,
    content:
      `Skill: ${plan.skillName}\nLearner level: ${plan.preferences?.level || 'beginner'}\n\n`
      + `Today's topic (ONLY test this): ${day.topic}\nObjective: ${day.objective}`
      + (day.youtubeVideo?.title ? `\nThe day's video: ${day.youtubeVideo.title}` : ''),
    options: readQuizOptions({ questionCount: DAY_QUIZ_QUESTIONS, difficulty: DAY_DIFFICULTY[plan.preferences?.level] || 'beginner', style: 'mixed', focus: day.topic }),
  });
  // Only if no quiz was started meanwhile, so a double click makes one quiz.
  await SkillPlan.updateOne(
    { _id: plan._id, userId, dailyPlan: { $elemMatch: { day: dayNo, completed: { $ne: true }, 'quiz.questions.0': { $exists: false } } } },
    { $set: { 'dailyPlan.$.quiz': { questions, createdAt: new Date() } } },
  );
  const fresh = (await findOwnDay(userId, planId, dayNo)).day;
  return { day: dayNo, passPercent: PASS_PERCENT, questions: questionsForClient(fresh.quiz?.questions?.length ? fresh.quiz.questions : questions) };
}

/**
 * Grade the day's quiz on the server. Passing (PASS_PERCENT or more) completes
 * the day; either way the attempt is kept and the next try gets new questions.
 */
async function submitDayQuiz({ userId, planId, dayNumber, answers }) {
  const { plan, day, dayNo } = await findOwnDay(userId, planId, dayNumber);
  const questions = day.quiz?.questions || [];
  if (!questions.length) throw conflict('Start the day\'s quiz first.', { code: 'NO_QUIZ' });
  const list = Array.isArray(answers) ? answers : [];
  if (list.length !== questions.length) throw badRequest(`Send one answer per question (${questions.length}).`);
  const picked = list.map((a) => (a === null || a === undefined ? -1 : integer(a, 'Answer', { min: -1, max: 3 })));

  const correct = questions.filter((q, i) => picked[i] === q.correctAnswer).length;
  const percentage = Math.round((correct / questions.length) * 100);
  const passed = hasPassed(correct / questions.length);
  const attempt = { correct, total: questions.length, percentage, passed, difficulty: DAY_DIFFICULTY[plan.preferences?.level] || 'beginner', at: new Date() };

  // Tied to this exact quiz, so the same answers cannot be counted twice.
  const update = await SkillPlan.updateOne(
    { _id: plan._id, userId, dailyPlan: { $elemMatch: { day: dayNo, 'quiz.createdAt': day.quiz.createdAt } } },
    {
      $push: { 'dailyPlan.$.quizAttempts': attempt },
      $unset: { 'dailyPlan.$.quiz': '' },
      ...(passed && !day.completed ? { $set: { 'dailyPlan.$.completed': true, 'dailyPlan.$.completedAt': new Date() } } : {}),
    },
  );
  if (!update.modifiedCount) throw conflict('This quiz was already submitted.', { code: 'ALREADY_SUBMITTED' });

  const after = await findOwnPlan(userId, planId);
  const completedDays = after.dailyPlan.filter((d) => d.completed).length;
  return {
    day: dayNo,
    passPercent: PASS_PERCENT,
    correct,
    total: questions.length,
    percentage,
    passed,
    completed: Boolean(after.dailyPlan.find((d) => d.day === dayNo)?.completed),
    completedDays,
    progress: Math.round((completedDays / after.duration) * 100),
    answers: picked,
    questions: questions.map((q) => ({ question: q.question, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation })),
    dayState: presentDay(after.dailyPlan.find((d) => d.day === dayNo)),
  };
}

async function deletePlan({ userId, planId }) {
  const result = await SkillPlan.deleteOne({ _id: objectId(planId, 'plan id'), userId });
  if (!result.deletedCount) throw notFound('Plan not found');
}

/** Swap a day's video for a different search result. */
async function refreshDayVideo({ userId, planId, dayNumber }) {
  const plan = await findOwnPlan(userId, planId);
  const dayNo = integer(dayNumber, 'Day', { min: 1, max: MAX_DAYS * 10 });
  const day = plan.dailyPlan.find((d) => d.day === dayNo);
  if (!day) throw notFound('Day not found');

  const query = `${day.topic} ${plan.skillName} tutorial in ${plan.preferences?.language || 'English'}`;
  const videos = await searchVideos(query, 5);
  const next = videos.find((v) => v.videoId !== day.youtubeVideo?.videoId) || videos[0];
  if (!next) throw upstreamError('No alternative videos found');

  const youtubeVideo = toVideo(next);
  await SkillPlan.updateOne({ _id: plan._id, 'dailyPlan.day': dayNo }, { $set: { 'dailyPlan.$.youtubeVideo': youtubeVideo } });
  return { message: 'Video refreshed', youtubeVideo };
}

module.exports = {
  MIN_DAYS,
  MAX_DAYS,
  createSkillPlan,
  listPlans,
  generatePlanQuiz,
  saveQuizResult,
  toggleDay,
  startDayQuiz,
  submitDayQuiz,
  presentDay,
  deletePlan,
  refreshDayVideo,
  _internal: { readPlanRequest, normaliseDays },
};
