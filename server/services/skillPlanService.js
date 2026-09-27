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

/** Skill Unlocker: day-by-day learning plans with a video per day, progress and quizzes. */

const MIN_DAYS = 10;
const MAX_DAYS = 60; // the page offers 10-30; the Novard Agent may ask for up to 60
const LEVELS = ['beginner', 'intermediate'];
const QUIZ_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

/** Clean the student's plan request; throws 400 on anything unusable. */
function readPlanRequest({ skillName, duration, description, preferences }) {
  if (!skillName || !duration || !description) throw badRequest('Missing required fields');
  const days = number(duration, 'Duration', { min: -Infinity });
  if (days < MIN_DAYS) throw badRequest(`Duration must be at least ${MIN_DAYS} days`);
  if (days > MAX_DAYS || !Number.isInteger(days)) throw badRequest(`Duration must be a whole number of days, at most ${MAX_DAYS}`);

  const prefs = preferences && typeof preferences === 'object' ? preferences : {};
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
  };
}

function planPrompt({ skillName, duration, description, preferences }) {
  return `Generate a ${duration}-day learning plan for "${skillName}".

Learning Goal: ${description}
Level: ${preferences.level}
${preferences.focusAreas.length > 0 ? `Focus Areas: ${preferences.focusAreas.join(', ')}` : ''}
Language Preference: ${preferences.language}
Teaching Style Preference: ${preferences.teachingStyle}

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
    maxTokens: 4096,
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

  return SkillPlan.create({ userId, ...plan, dailyPlan });
}

async function findOwnPlan(userId, planId) {
  const plan = await SkillPlan.findOne({ _id: objectId(planId, 'plan id'), userId });
  if (!plan) throw notFound('Plan not found');
  return plan;
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
      dailyPlan: plan.dailyPlan,
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

async function toggleDay({ userId, planId, dayNumber }) {
  const plan = await findOwnPlan(userId, planId);
  const dayNo = integer(dayNumber, 'Day', { min: 1, max: MAX_DAYS * 10 });
  const day = plan.dailyPlan.find((d) => d.day === dayNo);
  if (!day) throw notFound('Day not found');

  // Conditional on the value just read, so two quick clicks cannot both "complete" the day.
  const completed = !day.completed;
  const result = await SkillPlan.updateOne(
    { _id: plan._id, dailyPlan: { $elemMatch: { day: dayNo, completed: Boolean(day.completed) } } },
    { $set: { 'dailyPlan.$.completed': completed, 'dailyPlan.$.completedAt': completed ? new Date() : null } }
  );
  if (!result.modifiedCount) throw conflict('This day was just updated. Please refresh and try again.');
  return { message: 'Day completion toggled', completed };
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
  deletePlan,
  refreshDayVideo,
  _internal: { readPlanRequest, normaliseDays },
};
