const mongoose = require('mongoose');
const Exam = require('../models/exam');
const { MODELS } = require('../config/ai');
const { complete } = require('../ai/groqClient');
const { condenseToFit } = require('../ai/condense');
const { examSyllabusPrompt, examMockPrompt, examTutorPrompt } = require('../ai/prompts');
const { converse } = require('../ai/conversation');
const { parseModelJson } = require('../utils/parseModelJson');
const { relevantText, sampleContent, CHAT_SOURCE_CHARS } = require('../utils/longText');
const { badRequest, conflict, notFound, upstreamError } = require('../utils/httpError');
const { objectId, isObjectId, text, integer } = require('../utils/validate');
const logger = require('../utils/logger');
const { generateQuiz, readQuizOptions, normaliseQuestion, shuffleOptions } = require('./quizService');
const { notify } = require('./notificationService');
const { isDay, addDays, daysBetween, dayOf } = require('./examAutopilot/dates');
const { WEIGHT, topicState, nextStage } = require('./examAutopilot/mastery');
const { normaliseTopics } = require('./examAutopilot/topics');
const { replan } = require('./examAutopilot/replan');
const { MAX_DAILY_MINUTES, studied } = require('./examAutopilot/scheduler');
const { PASS_PERCENT, DAY_QUIZ_QUESTIONS, passed: hasPassed } = require('../config/learning');

/**
 * Exam Autopilot. The student gives an exam date and a syllabus; Novard reads
 * it into weighted topics (a draft they confirm), then keeps a day-by-day plan
 * that re-plans itself after every result, skipped task or new day, with a
 * forecast of exam-day readiness.
 *
 * The AI reads the syllabus and writes questions; everything else - mastery,
 * scheduling, the forecast and the reasons - is the deterministic engine in
 * examAutopilot/. Quizzes are graded here: the answers never reach the client
 * before the student submits.
 */

const LIMITS = { title: 120, syllabus: 40000, minSyllabus: 40, logSize: 40 };
const QUIZ_SIZE = { check: DAY_QUIZ_QUESTIONS, practice: 6, review: 5, diagnostic: 10, mock: 15 };
const DIFFICULTY = { 1: 'beginner', 2: 'intermediate', 3: 'advanced' };
const KIND_LABEL = { check: 'Topic check', practice: 'Practice quiz', review: 'Review quiz', diagnostic: 'Diagnostic test', mock: 'Mock exam' };
// Quizzes that complete their task (and topic) only when passed. A mock exam is a rehearsal: taking it completes its task.
const PASS_TO_COMPLETE = ['check', 'practice', 'review'];
const TASK_QUIZ = { learn: 'check', practice: 'practice', review: 'review' };
const DRAFT_TTL_DAYS = 2;
const MAX_ATTEMPTS = 3;
const TUTOR_SHOWN = 200;

const pct = (x) => `${Math.round((x || 0) * 100)}%`;
const serverToday = () => new Date().toISOString().slice(0, 10);

/** The student's day (sent by the client), or the server's when absent. */
function readToday(value) {
  if (value === undefined || value === null || value === '') return serverToday();
  if (!isDay(value)) throw badRequest('today must be a date (YYYY-MM-DD).');
  return value;
}

// ── loading and saving ─────────────────────────────────────────────────────

async function findOwn(userId, id, { withSyllabus = false } = {}) {
  const query = Exam.findOne({ _id: objectId(id === undefined || id === null ? id : String(id), 'exam id'), userId });
  if (withSyllabus) query.select('+syllabus');
  const exam = await query;
  if (!exam) throw notFound('Exam not found');
  return exam;
}

/**
 * Load, change and save an exam. If another request saved it in between, the
 * change is made again on the fresh copy (optimistic concurrency).
 */
async function updateExam(userId, id, change) {
  for (let attempt = 1; ; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const exam = await findOwn(userId, id);
    const result = change(exam);
    try {
      // eslint-disable-next-line no-await-in-loop
      await exam.save();
      return { exam, result };
    } catch (error) {
      if (error.name !== 'VersionError' || attempt >= MAX_ATTEMPTS) throw error;
    }
  }
}

/** The exam in the engine's shape: plain data, ids as strings. */
function engineInput(exam) {
  return {
    examDate: exam.examDate,
    dailyMinutes: exam.dailyMinutes,
    restDays: exam.restDays,
    targetReadiness: exam.targetReadiness,
    forecast: exam.forecast,
    topics: exam.topics.map((t) => ({
      id: String(t._id),
      name: t.name,
      summary: t.summary,
      weight: t.weight,
      difficulty: t.difficulty,
      order: t.order,
      prerequisites: (t.prerequisites || []).map(String),
      evidence: (t.evidence || []).map((e) => ({ at: e.at, kind: e.kind, score: e.score, weight: e.weight })),
      reviewStage: t.reviewStage || 0,
      learnedAt: t.learnedAt,
    })),
    plan: (exam.plan || []).map((d) => ({
      date: d.date,
      phase: d.phase,
      rest: d.rest,
      tasks: d.tasks.map((t) => ({ ...(t.toObject ? t.toObject() : t), topicId: t.topicId ? String(t.topicId) : null })),
    })),
  };
}

/** Re-plan in place (on the loaded document) and record why. */
function applyReplan(exam, today, trigger) {
  const out = replan(engineInput(exam), today, trigger);
  exam.plan = out.plan;
  exam.forecast = out.forecast;
  exam.plannedFor = today;
  exam.planLog = [...exam.planLog, out.log].slice(-LIMITS.logSize);
  exam.snapshots = [...exam.snapshots.filter((s) => s.date !== today), out.snapshot].sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** An active exam is re-planned once on each new day it is opened. */
async function freshExam(userId, id, today) {
  const exam = await findOwn(userId, id);
  if (exam.status !== 'active' || exam.plannedFor === today) return exam;
  return (await updateExam(userId, id, (e) => {
    if (e.plannedFor !== today) applyReplan(e, today, 'New day');
  })).exam;
}

// ── shapes ─────────────────────────────────────────────────────────────────

const findTask = (exam, taskId) => {
  for (const day of exam.plan) {
    const task = day.tasks.find((t) => String(t._id) === String(taskId));
    if (task) return { day, task };
  }
  return {};
};

/** A quiz as the student sees it: answers only once submitted. */
function presentQuiz(exam, quiz) {
  const done = Boolean(quiz.submittedAt);
  const names = new Map(exam.topics.map((t) => [String(t._id), t.name]));
  return {
    _id: quiz._id,
    kind: quiz.kind,
    label: KIND_LABEL[quiz.kind],
    taskId: quiz.taskId,
    topics: quiz.topicIds.map((id) => names.get(String(id))).filter(Boolean),
    questions: quiz.questions.map((q) => ({
      question: q.question,
      options: q.options,
      topic: names.get(String(q.topicId)) || '',
      ...(done ? { correctAnswer: q.correctAnswer, explanation: q.explanation } : {}),
    })),
    answers: done ? quiz.answers : undefined,
    correct: done ? quiz.correct : undefined,
    total: quiz.questions.length,
    createdAt: quiz.createdAt,
    submittedAt: quiz.submittedAt || null,
  };
}

function presentTask(task, names) {
  return {
    _id: task._id,
    topicId: task.topicId,
    topic: task.topicId ? names.get(String(task.topicId)) || '' : 'All topics',
    type: task.type,
    minutes: task.minutes,
    gain: task.gain || 0,
    reason: task.reason,
    status: task.status,
    quizId: task.quizId,
  };
}

/** Everything the dashboard shows, computed for `today`. */
function present(exam, today) {
  const names = new Map(exam.topics.map((t) => [String(t._id), t.name]));
  const input = engineInput(exam);
  const states = new Map(input.topics.map((t) => [t.id, topicState(t, today)]));
  const todayPlan = exam.plan.find((d) => d.date === today);
  const allTasks = exam.plan.flatMap((d) => d.tasks);
  const count = (status) => allTasks.filter((t) => t.status === status).length;

  return {
    _id: exam._id,
    status: exam.status,
    title: exam.title,
    examDate: exam.examDate,
    daysLeft: exam.examDate ? daysBetween(today, exam.examDate) : null,
    dailyMinutes: exam.dailyMinutes,
    restDays: exam.restDays,
    targetReadiness: exam.targetReadiness,
    source: { kind: exam.source?.kind, noteId: exam.source?.noteId || null, label: exam.source?.label || '' },
    topics: input.topics.map((t) => {
      const s = states.get(t.id);
      return {
        _id: t.id,
        name: t.name,
        summary: t.summary,
        importance: exam.topics.find((x) => String(x._id) === t.id).importance,
        weight: t.weight,
        difficulty: t.difficulty,
        prerequisites: t.prerequisites,
        learned: studied(t), // completed: passed a graded result on it (the planner's own rule)
        mastery: s.mastery,
        confidence: s.confidence,
        retention: s.retention,
        reviewDue: s.reviewDue,
        daysSince: s.daysSince,
        evidenceCount: s.evidenceCount,
        weakPrerequisites: t.prerequisites
          .filter((p) => (states.get(p)?.mastery ?? 0) < 0.3)
          .map((p) => names.get(p))
          .filter(Boolean),
      };
    }),
    today: todayPlan
      ? { date: today, phase: todayPlan.phase, rest: todayPlan.rest, tasks: todayPlan.tasks.map((t) => presentTask(t, names)) }
      : { date: today, phase: exam.examDate && today >= exam.examDate ? 'exam' : 'none', rest: false, tasks: [] },
    upcoming: exam.plan.filter((d) => d.date > today).slice(0, 7).map((d) => ({
      date: d.date,
      phase: d.phase,
      rest: d.rest,
      minutes: d.tasks.reduce((m, t) => m + t.minutes, 0),
      tasks: d.tasks.map((t) => ({ type: t.type, topic: t.topicId ? names.get(String(t.topicId)) : 'All topics' })),
    })),
    forecast: exam.forecast?.projected === undefined ? null : {
      now: exam.forecast.now,
      projected: exam.forecast.projected,
      low: exam.forecast.low,
      high: exam.forecast.high,
      reached: exam.forecast.reached || null,
      series: exam.forecast.series || [],
      advice: exam.forecast.advice || null,
    },
    snapshots: exam.snapshots,
    planLog: [...exam.planLog].reverse().slice(0, 15),
    stats: {
      done: count('done'),
      missed: count('missed'),
      skipped: count('skipped'),
      minutesDone: allTasks.filter((t) => t.status === 'done').reduce((m, t) => m + t.minutes, 0),
      topicsCompleted: input.topics.filter(studied).length,
    },
    passPercent: PASS_PERCENT,
    quizzes: exam.quizzes.filter((q) => q.submittedAt).slice(-10).reverse().map((q) => ({
      _id: q._id, kind: q.kind, label: KIND_LABEL[q.kind], correct: q.correct, total: q.total, submittedAt: q.submittedAt,
    })),
    openQuizzes: exam.quizzes.filter((q) => !q.submittedAt).map((q) => ({ _id: q._id, kind: q.kind, taskId: q.taskId })),
    tutor: (exam.tutor || []).slice(-TUTOR_SHOWN).map((m) => ({ _id: m._id, role: m.role, content: m.content, topicId: m.topicId || null, timestamp: m.at })),
    createdAt: exam.createdAt,
  };
}

/** A draft as the student reviews it before the plan exists. */
function presentDraft(exam) {
  return {
    _id: exam._id,
    status: exam.status,
    title: exam.title,
    examDate: exam.examDate,
    source: { kind: exam.source?.kind, noteId: exam.source?.noteId || null, label: exam.source?.label || '' },
    topics: exam.topics.map((t) => ({
      key: String(t._id),
      name: t.name,
      summary: t.summary,
      importance: t.importance,
      difficulty: t.difficulty,
      prerequisites: t.prerequisites.map(String),
    })),
  };
}

// ── reading ────────────────────────────────────────────────────────────────

async function listExams(userId, today) {
  const day = readToday(today);
  const exams = await Exam.find({ userId, status: { $ne: 'draft' } })
    .select('title status examDate dailyMinutes forecast.now forecast.projected forecast.advice plan createdAt')
    .sort({ examDate: 1 })
    .lean();
  return exams.map((e) => {
    const todayPlan = (e.plan || []).find((d) => d.date === day);
    const tasks = todayPlan?.tasks || [];
    return {
      _id: e._id,
      title: e.title,
      status: e.status,
      examDate: e.examDate,
      daysLeft: daysBetween(day, e.examDate),
      readiness: e.forecast?.now ?? 0,
      projected: e.forecast?.projected ?? 0,
      onTrack: e.forecast?.advice?.onTrack ?? null,
      todayTasks: tasks.filter((t) => t.status === 'todo').length,
      todayMinutes: tasks.filter((t) => t.status === 'todo').reduce((m, t) => m + t.minutes, 0),
      createdAt: e.createdAt,
    };
  });
}

async function getExam(userId, id, today) {
  const day = readToday(today);
  const exam = await freshExam(userId, id, day);
  return exam.status === 'draft' ? presentDraft(exam) : present(exam, day);
}

async function deleteExam(userId, id) {
  const gone = await Exam.findOneAndDelete({ _id: objectId(id, 'exam id'), userId }).select('_id').lean();
  if (!gone) throw notFound('Exam not found');
  return { deleted: true };
}

// ── a new exam: syllabus → draft → plan ────────────────────────────────────

/** Where the syllabus comes from: an uploaded PDF (saved to Notes too), a note, or pasted text. */
async function readSyllabusSource({ userId, file, noteId, pasted, title }) {
  const notes = require('./notesService');
  if (file) {
    const created = await notes.createNote({ userId, file, title: title || undefined });
    const note = await notes.findOwnNote(userId, String(created._id), 'title extractedText');
    return { source: { kind: 'pdf', noteId: note._id, label: note.title }, content: note.extractedText };
  }
  if (noteId) {
    const note = await notes.findOwnNote(userId, noteId, 'title extractedText');
    return { source: { kind: 'note', noteId: note._id, label: note.title }, content: note.extractedText };
  }
  const content = text(pasted, 'Syllabus', { max: LIMITS.syllabus, collapse: false });
  return { source: { kind: 'text', noteId: null, label: 'Pasted syllabus' }, content };
}

/** Read a syllabus into topics the student reviews. Nothing is planned until they confirm. */
async function draftExam({ userId, file, noteId, syllabus, title, examDate, today }) {
  const day = readToday(today);
  let name;
  try {
    name = text(title, 'Exam name', { required: false, max: LIMITS.title });
    if (examDate && (!isDay(examDate) || examDate <= day)) throw badRequest('The exam date must be after today.');
    if (!file && !noteId && !syllabus) throw badRequest('Upload the syllabus as a PDF, pick one of your notes, or paste it.');
  } catch (error) {
    if (file) await require('../utils/uploads').removeUpload(file.path);
    throw error;
  }

  const { source, content } = await readSyllabusSource({ userId, file, noteId, pasted: syllabus, title: name });
  if (String(content || '').trim().length < LIMITS.minSyllabus) throw badRequest('That syllabus is too short to plan from. Add the list of units or topics.');

  const { text: material } = await condenseToFit(content, { what: 'syllabus' });
  const reply = await complete({
    messages: [
      { role: 'system', content: examSyllabusPrompt() },
      { role: 'user', content: `${name ? `Exam: ${name}\n\n` : ''}Syllabus:\n${material}` },
    ],
    model: MODELS.REASONING,
    temperature: 0.2,
  });

  let raw = null;
  try {
    raw = parseModelJson(reply, { context: 'exam syllabus' });
  } catch (error) {
    logger.warn('Could not parse the syllabus topics', { error: error.message });
  }
  if (raw && typeof raw.declined === 'string' && raw.declined.trim()) throw badRequest(raw.declined.trim().slice(0, 500), { code: 'DECLINED' });
  const topics = normaliseTopics(raw?.topics);
  if (!topics) throw upstreamError('The syllabus could not be read into topics. Please try again.');

  // Drafts nobody confirmed are cleared out after a couple of days.
  await Exam.deleteMany({ userId, status: 'draft', createdAt: { $lt: new Date(Date.now() - DRAFT_TTL_DAYS * 864e5) } });

  const ids = topics.map(() => new mongoose.Types.ObjectId());
  const exam = await Exam.create({
    userId,
    status: 'draft',
    title: name || String(raw.title || '').trim().slice(0, LIMITS.title) || source.label || 'My exam',
    examDate: examDate || null,
    source,
    syllabus: material,
    topics: topics.map((t, i) => ({
      _id: ids[i], name: t.name, summary: t.summary, importance: t.importance, weight: t.weight, difficulty: t.difficulty, order: i,
      prerequisites: t.prereqIdx.map((p) => ids[p]),
    })),
  });
  return presentDraft(exam);
}

function readSettings(body, day, { partial = false, current = {} } = {}) {
  const out = {};
  const has = (k) => body[k] !== undefined;
  if (!partial || has('title')) out.title = text(body.title, 'Exam name', { max: LIMITS.title });
  if (!partial || has('examDate')) {
    if (!isDay(body.examDate)) throw badRequest('Choose the exam date.');
    if (body.examDate <= day) throw badRequest('The exam date must be after today.');
    if (daysBetween(day, body.examDate) > 365) throw badRequest('The exam must be within a year.');
    out.examDate = body.examDate;
  }
  if (!partial || has('dailyMinutes')) out.dailyMinutes = integer(body.dailyMinutes, 'Minutes a day', { min: 15, max: MAX_DAILY_MINUTES, required: !partial, fallback: 60 }) ?? 60;
  if (!partial || has('targetReadiness')) out.targetReadiness = integer(body.targetReadiness, 'Target readiness', { min: 50, max: 95, required: false, fallback: 70 }) ?? 70;
  if (!partial || has('restDays')) {
    const days = Array.isArray(body.restDays) ? body.restDays : [];
    if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw badRequest('Rest days must be weekdays (0 = Sunday … 6 = Saturday).');
    const unique = [...new Set(days)].sort();
    if (unique.length > 5) throw badRequest('Keep at least two study days a week.');
    out.restDays = unique;
  }
  const merged = { ...current, ...out };
  if (merged.examDate && merged.examDate <= day) throw badRequest('The exam date must be after today.');
  return out;
}

/** The student confirms (and may edit) the draft: the exam goes live with its first plan. */
async function activateExam({ userId, id, body = {}, today }) {
  const day = readToday(today);
  const settings = readSettings(body, day);
  const draft = await findOwn(userId, id);
  if (draft.status !== 'draft') throw conflict('This exam already has a plan.', { code: 'ALREADY_ACTIVE' });

  // Topics as edited: `key` is a draft topic id or any new key; prerequisites refer to keys.
  const rows = Array.isArray(body.topics) ? body.topics : draft.topics.map((t) => ({ key: String(t._id), name: t.name, summary: t.summary, importance: t.importance, difficulty: t.difficulty, prerequisites: t.prerequisites.map(String) }));
  const keys = rows.map((r, i) => String(r?.key ?? i));
  const topics = normaliseTopics(rows, { ref: (k) => keys.indexOf(String(k)), keepConfidence: true });
  if (!topics) throw badRequest('Keep at least two topics, each with a name.');

  // normaliseTopics drops duplicates, so map surviving rows back to their keys by name.
  const byName = new Map(rows.map((r, i) => [String(r?.name ?? '').replace(/\s+/g, ' ').trim().toLowerCase(), keys[i]]));
  const ids = topics.map((t) => {
    const key = byName.get(t.name.toLowerCase());
    return isObjectId(key) && draft.topics.some((d) => String(d._id) === key) ? new mongoose.Types.ObjectId(key) : new mongoose.Types.ObjectId();
  });

  const { exam } = await updateExam(userId, id, (e) => {
    if (e.status !== 'draft') throw conflict('This exam already has a plan.', { code: 'ALREADY_ACTIVE' });
    Object.assign(e, settings, { status: 'active' });
    e.topics = topics.map((t, i) => ({
      _id: ids[i], name: t.name, summary: t.summary, importance: t.importance, weight: t.weight, difficulty: t.difficulty, order: i,
      prerequisites: t.prereqIdx.map((p) => ids[p]),
      // "How confident are you?" is a weak hint until there is real evidence.
      evidence: t.confidence ? [{ at: day, kind: 'self', score: (t.confidence - 1) / 4, weight: WEIGHT.self }] : [],
    }));
    applyReplan(e, day, 'Plan created');
  });
  return present(exam, day);
}

async function updateExamSettings({ userId, id, body = {}, today }) {
  const day = readToday(today);
  const current = await findOwn(userId, id);
  if (current.status === 'draft') throw conflict('Confirm the topics first.', { code: 'DRAFT' });
  const settings = readSettings(body, day, { partial: true, current: { examDate: current.examDate } });
  if (body.status !== undefined) {
    if (!['active', 'archived'].includes(body.status)) throw badRequest('status must be active or archived.');
    settings.status = body.status;
  }
  const { exam } = await updateExam(userId, id, (e) => {
    Object.assign(e, settings);
    if (e.status === 'active') applyReplan(e, day, 'Settings changed');
  });
  return present(exam, day);
}

// ── doing the plan ─────────────────────────────────────────────────────────

const topicOf = (exam, id) => exam.topics.find((t) => String(t._id) === String(id));

/** Record a result for one topic: evidence, the review stage, and that it has been studied. */
function addEvidence(exam, topic, day, { kind, score, weight, ref = '' }) {
  const before = topicState(engineInput(exam).topics.find((t) => t.id === String(topic._id)), day);
  topic.evidence.push({ at: day, kind, score: Math.min(1, Math.max(0, score)), weight, ref });
  topic.reviewStage = nextStage(topic.reviewStage, score, before.daysSince);
  // The topic is completed only by passing (a failed attempt still counts towards mastery).
  if (!topic.learnedAt && kind !== 'self' && hasPassed(score)) topic.learnedAt = day;
  return before;
}

/** Done or skipped, by the student. Finishing a "learn" task marks the topic as studied. */
async function setTaskStatus({ userId, id, taskId, status, today }) {
  const day = readToday(today);
  if (!['done', 'skipped', 'todo'].includes(status)) throw badRequest('status must be skipped or todo.');
  const { exam } = await updateExam(userId, id, (e) => {
    if (e.status !== 'active') throw conflict('This exam is not active.');
    const { day: planDay, task } = findTask(e, objectId(taskId, 'task id'));
    if (!task) throw notFound('Task not found');
    // Completed only by passing: there is no manual "done".
    if (status === 'done') {
      throw conflict(`Tasks are completed by passing them (${PASS_PERCENT}% or more): take the quiz, or finish the teach-back.`, { code: 'QUIZ_REQUIRED' });
    }
    if (planDay.date !== day) throw conflict('Only today’s tasks can be changed.', { code: 'NOT_TODAY' });
    if (task.status === status) return;
    if (task.status === 'done') throw conflict('A completed task cannot be changed.', { code: 'COMPLETED' });
    task.status = status;
    const topic = task.topicId && topicOf(e, task.topicId);
    const what = `${topic ? `${topic.name} ` : ''}${task.type}`;
    applyReplan(e, day, status === 'skipped' ? `Skipped: ${what}` : `Reopened: ${what}`);
  });
  return present(exam, day);
}

/** The passage of the student's material that covers a topic. */
async function materialFor(exam, query, budget) {
  if (exam.source?.noteId) {
    const Notes = require('../models/notes');
    const note = await Notes.findOne({ _id: exam.source.noteId, userId: exam.userId }).select('extractedText').lean();
    if (note?.extractedText) return relevantText(note.extractedText, query, budget);
  }
  const withSyllabus = await Exam.findById(exam._id).select('+syllabus').lean();
  return relevantText(withSyllabus?.syllabus || '', query, budget);
}

async function storeQuiz(userId, id, quiz, taskId) {
  const { exam, result } = await updateExam(userId, id, (e) => {
    e.quizzes.push(quiz);
    const stored = e.quizzes.at(-1);
    if (taskId) {
      const { task } = findTask(e, taskId);
      if (task) task.quizId = stored._id;
    }
    return stored;
  });
  return presentQuiz(exam, result);
}

/** The quiz for a practice or review task (the same one again if it was started and not finished). */
async function startTaskQuiz({ userId, id, taskId, today }) {
  const day = readToday(today);
  const exam = await freshExam(userId, id, day);
  const { day: planDay, task } = findTask(exam, objectId(taskId, 'task id'));
  if (!task) throw notFound('Task not found');
  if (planDay.date !== day || task.status !== 'todo') throw conflict('This task is not open today.', { code: 'NOT_OPEN' });
  if (task.type === 'mock') return startMock({ userId, id, kind: 'mock', today: day, taskId });
  if (!TASK_QUIZ[task.type]) throw badRequest('This task is completed by a teach-back, not a quiz.');

  const open = task.quizId && exam.quizzes.id(task.quizId);
  if (open && !open.submittedAt) return presentQuiz(exam, open);

  const topic = topicOf(exam, task.topicId);
  const material = await materialFor(exam, `${topic.name} ${topic.summary}`, CHAT_SOURCE_CHARS);
  const questions = await generateQuiz({
    subject: `${topic.name} (${exam.title})`,
    content: `Topic: ${topic.name}\nWhat it covers: ${topic.summary}\n\n${material || '(No study material for this topic: use standard subject knowledge.)'}`,
    options: readQuizOptions({ questionCount: QUIZ_SIZE[TASK_QUIZ[task.type]], difficulty: task.type === 'learn' ? DIFFICULTY[Math.max(1, topic.difficulty - 1)] : DIFFICULTY[topic.difficulty], style: 'mixed', focus: topic.name }),
  });
  return storeQuiz(userId, id, {
    kind: TASK_QUIZ[task.type],
    taskId: task._id,
    topicIds: [topic._id],
    questions: questions.map((q) => ({ ...q, topicId: topic._id })),
  }, task._id);
}

/** A diagnostic test (what do I know already?) or a mock exam across every topic, in one model call. */
async function startMock({ userId, id, kind = 'mock', today, taskId }) {
  const day = readToday(today);
  if (!['diagnostic', 'mock'].includes(kind)) throw badRequest('kind must be diagnostic or mock.');
  const exam = await freshExam(userId, id, day);
  if (exam.status !== 'active') throw conflict('This exam is not active.');
  const pending = exam.quizzes.find((q) => !q.submittedAt && q.kind === kind);
  if (pending) return presentQuiz(exam, pending);

  const count = QUIZ_SIZE[kind];
  const topics = [...exam.topics].sort((a, b) => a.order - b.order);
  const material = await materialFor(exam, topics.map((t) => t.name).join(' '), Math.round(CHAT_SOURCE_CHARS * 1.2));
  const reply = await complete({
    messages: [
      { role: 'system', content: 'You are an expert examiner who writes accurate, well-calibrated questions. You always return valid JSON.' },
      { role: 'user', content: `${examMockPrompt({ title: exam.title, topics, count, kind })}\n\nMATERIAL:\n${sampleContent(material, Math.round(CHAT_SOURCE_CHARS * 1.2)) || '(none)'}` },
    ],
    model: MODELS.REASONING,
    temperature: 0.5,
  });
  let list = [];
  try {
    const parsed = parseModelJson(reply, { context: 'exam mock' });
    list = Array.isArray(parsed) ? parsed : parsed?.questions || [];
  } catch (error) {
    logger.warn('Could not parse the mock exam', { error: error.message });
  }
  const questions = list.map((q) => {
    const clean = normaliseQuestion(q);
    const topic = topics[Number(q?.topic)];
    return clean && topic ? shuffleOptions({ ...clean, topicId: topic._id }) : null;
  }).filter(Boolean).slice(0, count);
  if (questions.length < Math.min(5, count)) throw upstreamError(`The ${KIND_LABEL[kind].toLowerCase()} could not be written. Please try again.`);

  const mockTask = taskId || exam.plan.find((d) => d.date === day)?.tasks.find((t) => t.type === 'mock' && t.status === 'todo')?._id;
  return storeQuiz(userId, id, {
    kind,
    taskId: kind === 'mock' ? mockTask || null : null,
    topicIds: [...new Set(questions.map((q) => String(q.topicId)))],
    questions,
  }, kind === 'mock' ? mockTask : null);
}

async function getQuiz({ userId, id, quizId }) {
  const exam = await findOwn(userId, id);
  const quiz = exam.quizzes.id(objectId(quizId, 'quiz id'));
  if (!quiz) throw notFound('Quiz not found');
  return presentQuiz(exam, quiz);
}

function readAnswers(answers, total) {
  const list = Array.isArray(answers) ? answers : [];
  if (list.length !== total) throw badRequest(`Send one answer per question (${total}).`);
  return list.map((a) => (a === null || a === undefined ? -1 : integer(a, 'Answer', { min: -1, max: 3 })));
}

/**
 * Grade a quiz, record what it shows about each topic, and re-plan. Returns
 * the marked quiz, the per-topic breakdown and how readiness and the plan moved.
 */
async function submitQuiz({ userId, id, quizId, answers, today }) {
  const day = readToday(today);
  let breakdown = [];
  let before = null;
  const { exam, result } = await updateExam(userId, id, (e) => {
    breakdown = [];
    const quiz = e.quizzes.id(objectId(quizId, 'quiz id'));
    if (!quiz) throw notFound('Quiz not found');
    if (quiz.submittedAt) throw conflict('This quiz was already submitted.', { code: 'ALREADY_SUBMITTED' });
    const picked = readAnswers(answers, quiz.questions.length);

    const perTopic = new Map();
    quiz.questions.forEach((q, i) => {
      const key = String(q.topicId);
      const row = perTopic.get(key) || { correct: 0, total: 0 };
      row.total += 1;
      if (picked[i] === q.correctAnswer) row.correct += 1;
      perTopic.set(key, row);
    });
    quiz.answers = picked;
    quiz.correct = [...perTopic.values()].reduce((n, r) => n + r.correct, 0);
    quiz.total = quiz.questions.length;
    quiz.submittedAt = new Date();

    before = { now: e.forecast?.now ?? 0, projected: e.forecast?.projected ?? 0 };
    const evidenceKind = PASS_TO_COMPLETE.includes(quiz.kind) ? 'quiz' : quiz.kind; // check, practice and review are all topic quizzes
    perTopic.forEach((row, key) => {
      const topic = topicOf(e, key);
      if (!topic) return;
      const state = addEvidence(e, topic, day, { kind: evidenceKind, score: row.correct / row.total, weight: row.total, ref: String(quiz._id) });
      breakdown.push({ topicId: key, topic: topic.name, correct: row.correct, total: row.total, masteryBefore: state.mastery });
    });

    const pass = hasPassed(quiz.correct / quiz.total);
    let taskCompleted = false;
    if (quiz.taskId) {
      const { day: planDay, task } = findTask(e, quiz.taskId);
      if (task && task.status === 'todo' && planDay.date === day) {
        if (pass || !PASS_TO_COMPLETE.includes(quiz.kind)) {
          task.status = 'done';
          task.doneAt = new Date();
          taskCompleted = true;
        } else {
          task.quizId = null; // the next try gets new questions
        }
      }
    }
    const names = breakdown.map((b) => b.topic);
    const label = names.length > 2 ? KIND_LABEL[quiz.kind] : `${KIND_LABEL[quiz.kind]} on ${names.join(' and ')}`;
    const out = applyReplan(e, day, `${label}: ${quiz.correct}/${quiz.total}${PASS_TO_COMPLETE.includes(quiz.kind) ? (pass ? ' (passed)' : ' (not passed)') : ''}`);
    return { quiz, log: out.log, pass, taskCompleted };
  });

  const states = new Map(engineInput(exam).topics.map((t) => [t.id, topicState(t, day)]));
  return {
    quiz: presentQuiz(exam, result.quiz),
    breakdown: breakdown.map((b) => ({ ...b, masteryAfter: states.get(b.topicId)?.mastery ?? 0 })),
    readiness: { before: before.now, after: exam.forecast.now },
    forecast: { before: before.projected, after: exam.forecast.projected },
    planChange: result.log.summary,
    passPercent: PASS_PERCENT,
    passed: result.pass,
    taskCompleted: result.taskCompleted,
    retry: Boolean(result.quiz.taskId) && PASS_TO_COMPLETE.includes(result.quiz.kind) && !result.pass,
    exam: present(exam, day),
  };
}

/**
 * A Teach-Back session linked to an exam topic was marked: it counts as strong
 * evidence (explaining beats recognising) and completes its task.
 */
async function recordTeachBack({ userId, examRef, score, today }) {
  const day = readToday(today);
  await updateExam(userId, examRef.examId, (e) => {
    if (e.status !== 'active') return;
    const topic = topicOf(e, examRef.topicId);
    if (!topic) return;
    addEvidence(e, topic, day, { kind: 'teachback', score: score / 100, weight: WEIGHT.teachback, ref: 'teachback' });
    const { day: planDay, task } = examRef.taskId ? findTask(e, examRef.taskId) : {};
    if (task && task.status === 'todo' && planDay.date === day && hasPassed(score / 100)) {
      task.status = 'done';
      task.doneAt = new Date();
    }
    applyReplan(e, day, `Teach-back on ${topic.name}: ${score}/100`);
  });
}

/** Check a Teach-Back link before a session is started from an exam task. */
async function readExamRef(userId, ref) {
  if (!ref || typeof ref !== 'object' || !ref.examId) return null;
  const exam = await findOwn(userId, ref.examId);
  const topic = topicOf(exam, objectId(ref.topicId, 'topic id'));
  if (!topic) throw notFound('Exam topic not found');
  return {
    examId: exam._id,
    topicId: topic._id,
    taskId: ref.taskId && isObjectId(ref.taskId) ? ref.taskId : null,
    topicName: topic.name,
    topicSummary: topic.summary,
    noteId: exam.source?.noteId || null,
  };
}

// ── the exam's tutor ───────────────────────────────────────────────────────

/** Where a topic stands, in words, for the tutor. */
function topicStatus(t) {
  if (!t.learned) return 'not started';
  if (t.weakPrerequisites.length) return `weak foundation (${t.weakPrerequisites.join(', ')})`;
  if (t.reviewDue) return 'review due';
  return '';
}

/**
 * One message to the exam's tutor. It knows the exam, every topic's mastery,
 * today's plan and the passages of the student's material that match the
 * question; `topicId` focuses it on one topic (a "learn" task opens it so).
 */
async function tutorChat({ userId, id, message, topicId, today }) {
  const day = readToday(today);
  const input = text(message, 'Message', { max: 4000, collapse: false });
  const exam = await freshExam(userId, id, day);
  if (exam.status !== 'active') throw conflict('This exam is not active.');
  const view = present(exam, day);
  const focus = topicId ? view.topics.find((t) => t._id === String(objectId(topicId, 'topic id'))) : null;
  if (topicId && !focus) throw notFound('Exam topic not found');

  const recent = (exam.tutor || []).filter((m) => m.role === 'user').slice(-2).map((m) => m.content);
  const material = await materialFor(exam, [input, focus ? `${focus.name} ${focus.summary}` : '', ...recent].join(' '), Math.round(CHAT_SOURCE_CHARS * 0.8));
  const names = new Map(view.topics.map((t) => [t._id, t.name]));
  const system = examTutorPrompt({
    title: exam.title,
    daysLeft: view.daysLeft,
    target: exam.targetReadiness,
    readiness: view.forecast?.now,
    projected: view.forecast?.projected,
    topics: view.topics.map((t) => ({ name: t.name, weight: t.weight, mastery: t.mastery, status: topicStatus(t) })),
    today: view.today.tasks.map((t) => ({ label: `${t.type === 'teach' ? 'teach-back' : t.type}: ${t.topicId ? names.get(String(t.topicId)) : 'all topics'}`, minutes: t.minutes, status: t.status, reason: t.reason })),
    focus,
    material,
  });

  await converse({ Model: Exam, filter: { _id: exam._id, userId }, field: 'tutor', timeKey: 'at', system, input, tier: 'REASONING', temperature: 0.5 });
  if (focus) {
    // Remember which topic the exchange was about (the last two messages are this turn).
    const saved = await Exam.findById(exam._id).select('tutor._id').lean();
    const ids = (saved?.tutor || []).slice(-2).map((m) => m._id);
    if (ids.length) await Exam.updateOne({ _id: exam._id }, { $set: { 'tutor.$[m].topicId': focus._id } }, { arrayFilters: [{ 'm._id': { $in: ids } }] });
  }
  const after = await findOwn(userId, id);
  return { messages: present(after, day).tutor };
}

/** Start the tutor conversation afresh (and forget its memory). */
async function clearTutor({ userId, id }) {
  const exam = await findOwn(userId, id);
  await Exam.updateOne({ _id: exam._id, userId }, { $set: { tutor: [], memory: { summary: '', summarizedCount: 0 } } });
  return { messages: [] };
}

// ── reminders ──────────────────────────────────────────────────────────────

/**
 * Once a day per active exam, when the bell loads (nothing runs on a timer):
 * today's tasks and readiness, with a countdown a week, three days and one day
 * out. Each exam is claimed for the day atomically, so it reminds once.
 */
async function sweepExamReminders(userId, today) {
  const day = readToday(today);
  const exams = await Exam.find({ userId, status: 'active', examDate: { $gte: day }, remindedFor: { $ne: day } }).select('_id').lean();
  const notes = [];
  for (const { _id } of exams) {
    // eslint-disable-next-line no-await-in-loop
    const claimed = await Exam.updateOne({ _id, userId, remindedFor: { $ne: day } }, { $set: { remindedFor: day } });
    if (!claimed.modifiedCount) continue;
    // eslint-disable-next-line no-await-in-loop
    const exam = await freshExam(userId, _id, day);
    const left = daysBetween(day, exam.examDate);
    const names = new Map(exam.topics.map((t) => [String(t._id), t.name]));
    const tasks = (exam.plan.find((d) => d.date === day)?.tasks || []).filter((t) => t.status === 'todo');
    const minutes = tasks.reduce((m, t) => m + t.minutes, 0);
    const countdown = [7, 3, 1].includes(left);
    if (left > 0 && !tasks.length && !countdown) continue;

    const title = left === 0
      ? `Exam day: ${exam.title}. Good luck!`
      : `${exam.title}: ${tasks.length ? `${tasks.length} task${tasks.length === 1 ? '' : 's'} · ${minutes} min today` : 'rest day'}${countdown ? ` · ${left} day${left === 1 ? '' : 's'} to go` : ''}`;
    const lines = tasks.slice(0, 4).map((t) => `• ${t.topicId ? `${names.get(String(t.topicId))}: ` : ''}${t.type === 'teach' ? 'teach-back' : t.type} (${t.minutes} min)`);
    lines.push(`Readiness ${pct(exam.forecast?.now)} now, ${pct(exam.forecast?.projected)} forecast for exam day.`);
    notes.push({ userId, kind: 'exam_today', title: title.slice(0, 200), body: lines.join('\n'), link: `/exams?open=${exam._id}` });
  }
  if (notes.length) await notify(notes);
  return notes.length;
}

module.exports = {
  listExams,
  getExam,
  deleteExam,
  draftExam,
  activateExam,
  updateExamSettings,
  setTaskStatus,
  startTaskQuiz,
  startMock,
  getQuiz,
  submitQuiz,
  recordTeachBack,
  readExamRef,
  tutorChat,
  clearTutor,
  sweepExamReminders,
  _internal: { readToday, presentQuiz, dayOf, addDays },
};
