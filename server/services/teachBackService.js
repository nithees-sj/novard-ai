const TeachBack = require('../models/teachBack');
const { MODELS } = require('../config/ai');
const { env } = require('../config/env');
const { complete } = require('../ai/groqClient');
const { converse } = require('../ai/conversation');
const { transcribe } = require('../ai/transcribe');
const { teachBackClassmatePrompt, teachBackGradePrompt, teachBackCoachPrompt } = require('../ai/prompts');
const { parseModelJson } = require('../utils/parseModelJson');
const { CHAT_SOURCE_CHARS, relevantText, sampleContent } = require('../utils/longText');
const { removeUpload, resolveStoredPath } = require('../utils/uploads');
const { badRequest, conflict, notFound, unprocessable, upstreamError, HttpError } = require('../utils/httpError');
const { objectId, text } = require('../utils/validate');
const settings = require('./settingsService');
const logger = require('../utils/logger');

/**
 * Teach-Back Arena. The student picks what to teach (a PDF plus what to focus
 * on, or just a concept), explains it to Novard - who plays a curious
 * classmate and asks a few follow-ups - then gets marks: the concept as an
 * ordered flow, each step rated, plus corrections to their understanding
 * (never their language). Finally Novard turns tutor and teaches the steps
 * they lagged on.
 *
 * Starting a session makes no model call (the opener is a template), so it is
 * instant and costs nothing; each explanation is one small call, the marks one
 * call, and each coaching message one call.
 */

const MAX_FOLLOW_UPS = 3;
const LIMITS = { concept: 120, focus: 500, turn: 4000, transcript: 12000 };
// The slice of the PDF the explanation is judged against: the passages that
// best match the concept and focus, small enough to sit beside a long
// explanation in one request.
const REFERENCE_CHARS = CHAT_SOURCE_CHARS;
const STATUSES = ['good', 'partial', 'missed', 'wrong'];
const STEP_POINTS = { good: 1, partial: 0.5, missed: 0, wrong: 0 };

// ── shapes ─────────────────────────────────────────────────────────────────

const flat = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Mermaid-safe label text: no quotes, angle brackets or entity starts. */
const label = (value) => flat(value, 90).replace(/["`]/g, "'").replace(/[<>{}#;]/g, ' ').replace(/\s+/g, ' ').trim();

const STATUS_MARK = { good: '✅ Explained well', partial: '🟡 Partly explained', missed: '⚪ Missed', wrong: '❌ Misunderstood' };

/**
 * The concept as a top-down flowchart, one box per step coloured by how the
 * student did. Built here rather than by the model, so it always renders.
 */
function flowChart(flow = []) {
  if (!flow.length) return '';
  const lines = ['flowchart TD'];
  flow.forEach((s, i) => {
    lines.push(`  s${i}["${i + 1}. ${label(s.step)}<br/>${STATUS_MARK[s.status] || STATUS_MARK.missed}"]:::${s.status}`);
  });
  for (let i = 1; i < flow.length; i += 1) lines.push(`  s${i - 1} --> s${i}`);
  lines.push(
    '  classDef good fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#14532d',
    '  classDef partial fill:#fef9c3,stroke:#ca8a04,stroke-width:2px,color:#713f12',
    '  classDef missed fill:#f1f5f9,stroke:#94a3b8,stroke-width:2px,stroke-dasharray:5 4,color:#334155',
    '  classDef wrong fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#7f1d1d',
  );
  return lines.join('\n');
}

const followUpsAsked = (session) => Math.max(0, session.turns.filter((t) => t.role === 'novard').length - 1);
const studentTurns = (session) => session.turns.filter((t) => t.role === 'student');

/** What the client sees: never the reference text or the chat memory. */
function present(doc) {
  const s = doc.toObject ? doc.toObject() : doc;
  const graded = s.status === 'graded';
  return {
    _id: s._id,
    id: s._id,
    source: { kind: s.source?.kind, noteId: s.source?.noteId || null, label: s.source?.label || '' },
    concept: s.concept,
    focus: s.focus || '',
    status: s.status,
    turns: (s.turns || []).map(({ role, text: t, via, at }) => ({ role, text: t, via, at })),
    followUpsLeft: Math.max(0, MAX_FOLLOW_UPS - followUpsAsked(s)),
    canFinish: !graded && (s.turns || []).some((t) => t.role === 'student'),
    result: graded ? s.result : null,
    flowChart: graded ? flowChart(s.result?.flow) : '',
    previousScore: s.previousScore ?? null,
    examRef: s.examRef?.examId ? { examId: s.examRef.examId, topicId: s.examRef.topicId } : null,
    gradedAt: s.gradedAt || null,
    coaching: (s.coaching || []).map(({ _id, role, content, at }) => ({ _id, role, content, timestamp: at })),
    createdAt: s.createdAt,
  };
}

const summary = (s) => ({
  _id: s._id,
  id: s._id,
  concept: s.concept,
  source: { kind: s.source?.kind, label: s.source?.label || '' },
  status: s.status,
  score: s.status === 'graded' ? s.result?.score ?? null : null,
  previousScore: s.previousScore ?? null,
  createdAt: s.createdAt,
  gradedAt: s.gradedAt || null,
});

async function findOwn(userId, id) {
  const session = await TeachBack.findOne({ _id: objectId(id, 'session id'), userId });
  if (!session) throw notFound('Teach-back session not found');
  return session;
}

// ── reading ────────────────────────────────────────────────────────────────

async function listSessions(userId) {
  const sessions = await TeachBack.find({ userId })
    .sort({ createdAt: -1 })
    .select('concept source status result.score previousScore createdAt gradedAt')
    .lean();
  return sessions.map(summary);
}

async function getSession(userId, id) {
  return present(await findOwn(userId, id));
}

async function deleteSession(userId, id) {
  const gone = await TeachBack.findOneAndDelete({ _id: objectId(id, 'session id'), userId }).select('_id').lean();
  if (!gone) throw notFound('Teach-back session not found');
  return { deleted: true };
}

/** Voice needs Groq Whisper (the Groq key, and Groq switched on). */
async function voiceEnabled() {
  if (!env.groqApiKey) return false;
  return (await settings.get('ai.providers')).groq !== false;
}

// ── starting ───────────────────────────────────────────────────────────────

/** An object sent as JSON text (multipart form fields are strings). */
function readJson(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    throw badRequest('examRef must be JSON.');
  }
}

const sameConcept = (a, b) => flat(a, LIMITS.concept).toLowerCase() === flat(b, LIMITS.concept).toLowerCase();

/** The last marks for the same concept (and PDF), so a retry can show the change. */
async function lastScore(userId, concept, noteId) {
  const earlier = await TeachBack.find({ userId, status: 'graded', 'source.noteId': noteId || null })
    .sort({ gradedAt: -1 })
    .select('concept result.score')
    .limit(30)
    .lean();
  const match = earlier.find((s) => sameConcept(s.concept, concept));
  return match ? match.result?.score ?? null : null;
}

/**
 * Start a session. `file` is a newly uploaded PDF (saved as a note, so it also
 * appears in Notes & Quiz); `noteId` picks a PDF already there; with neither,
 * the student teaches a concept from general knowledge.
 */
async function startSession({ userId, file, noteId, concept, focus, examRef }) {
  let note = null;
  let name;
  let what;
  let exam;
  try {
    // From an Exam Autopilot task: the topic (and the exam's PDF) unless the student chose otherwise.
    exam = examRef ? await require('./examService').readExamRef(userId, readJson(examRef)) : null;
    if (exam) {
      concept = concept || exam.topicName;
      focus = focus || exam.topicSummary;
      if (!file && !noteId && exam.noteId) noteId = String(exam.noteId);
    }
    name = text(concept, 'Concept', { required: false, max: LIMITS.concept });
    what = text(focus, 'What you will explain', { required: false, max: LIMITS.focus, collapse: false });
    if (file && noteId) throw badRequest('Upload a PDF or pick one of your notes, not both.');
    if (!file && !noteId && name.length < 2) throw badRequest('Say which concept you will explain.');
    if (file && !name && !what) throw badRequest('Say which concept or part of the PDF you will explain.');
  } catch (error) {
    if (file) await removeUpload(file.path);
    throw error;
  }

  const notes = require('./notesService');
  if (file) {
    const created = await notes.createNote({ userId, file, title: name || flat(what, 80) });
    note = await notes.findOwnNote(userId, String(created._id), 'title extractedText summary');
  } else if (noteId) {
    note = await notes.findOwnNote(userId, noteId, 'title extractedText summary');
  }

  const conceptName = name || flat(what, LIMITS.concept) || note.title;
  let reference = '';
  if (note) {
    reference = what || name
      ? relevantText(note.extractedText, `${conceptName} ${what}`, REFERENCE_CHARS)
      : sampleContent(note.summary || note.extractedText, REFERENCE_CHARS);
  }

  const session = await TeachBack.create({
    userId,
    source: note ? { kind: 'pdf', noteId: note._id, label: note.title } : { kind: 'topic', noteId: null, label: '' },
    concept: conceptName,
    focus: what,
    reference,
    previousScore: await lastScore(userId, conceptName, note?._id),
    examRef: exam ? { examId: exam.examId, topicId: exam.topicId, taskId: exam.taskId } : undefined,
    turns: [{
      role: 'novard',
      text: `Hey! I missed the class on **${conceptName}** 😅 Can you explain it to me like I'm hearing it for the first time? Take your time - talk or type, whichever is easier.`,
    }],
  });
  return present(session);
}

// ── explaining ─────────────────────────────────────────────────────────────

/** The conversation as plain text, newest kept when it is very long. */
function transcriptText(session, { studentOnly = false } = {}) {
  const turns = studentOnly ? studentTurns(session) : session.turns;
  const all = turns.map((t) => `${t.role === 'student' ? 'Student' : 'Novard'}: ${t.text}`).join('\n\n');
  return all.length > LIMITS.transcript ? `…${all.slice(-LIMITS.transcript)}` : all;
}

async function speechToText(file) {
  if (!(await voiceEnabled())) {
    await removeUpload(file.path);
    throw new HttpError(503, 'Voice is not available right now. Type your explanation instead.', { code: 'VOICE_OFF' });
  }
  const { verifyFiles } = require('./reportService');
  try {
    await verifyFiles([{ kind: 'voice', file }]); // real audio bytes, renamed with the matching extension
    return text(await transcribe(resolveStoredPath(file.path)), 'Transcript', { required: false, max: 20000, collapse: false });
  } finally {
    await removeUpload(file.path);
  }
}

/** One explanation from the student (typed, or a recording) and Novard's follow-up. */
async function addTurn({ userId, id, message, file }) {
  let session;
  try {
    session = await findOwn(userId, id);
    if (session.status === 'graded') throw conflict('This session already has its marks. Start a new one to teach it again.', { code: 'ALREADY_GRADED' });
  } catch (error) {
    if (file) await removeUpload(file.path);
    throw error;
  }

  const said = file
    ? await speechToText(file)
    : text(message, 'Your explanation', { max: LIMITS.turn, collapse: false });
  if (!said) throw unprocessable("We couldn't hear anything in that recording. Try again a little closer to the mic, or type it.");

  session.turns.push({ role: 'student', text: said.slice(0, LIMITS.turn * 2), via: file ? 'voice' : 'text', at: new Date() });

  const left = MAX_FOLLOW_UPS - followUpsAsked(session);
  let reply;
  let ready = left <= 0;
  if (ready) {
    reply = 'Thanks, I think I get it now! 🙌 Press **Finish & get marks** to see how well you explained it.';
  } else {
    const raw = await complete({
      messages: [
        { role: 'system', content: teachBackClassmatePrompt({ concept: session.concept, focus: session.focus, reference: sampleContent(session.reference, Math.round(REFERENCE_CHARS * 0.6)), followUpsLeft: left - 1 }) },
        { role: 'user', content: `The conversation so far:\n\n${transcriptText(session)}\n\nReply as Novard.` },
      ],
      model: MODELS.FAST,
      temperature: 0.6,
    });
    let parsed = null;
    try {
      parsed = parseModelJson(raw, { context: 'teach-back reply' });
    } catch (error) {
      logger.warn('Could not parse the teach-back reply', { error: error.message });
    }
    reply = flat(parsed?.reply, 800) || (raw && !/^\s*[{[]/.test(raw) ? flat(raw, 800) : '');
    ready = Boolean(parsed?.ready);
    if (!reply) throw upstreamError('Novard could not reply. Please try again.');
  }

  session.turns.push({ role: 'novard', text: reply, at: new Date() });
  await session.save();
  return { ...present(session), ready };
}

// ── marks ──────────────────────────────────────────────────────────────────

/** Check and tidy the model's marks; null when they are unusable. */
function normaliseResult(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.flow)) return null;
  const flow = raw.flow
    .map((s) => ({
      step: flat(s?.step, 90),
      status: STATUSES.includes(String(s?.status).toLowerCase()) ? String(s.status).toLowerCase() : 'missed',
      feedback: flat(s?.feedback, 500),
    }))
    .filter((s) => s.step)
    .slice(0, 8);
  if (!flow.length) return null;

  const fromSteps = Math.round((flow.reduce((n, s) => n + STEP_POINTS[s.status], 0) / flow.length) * 100);
  const given = Number(raw.score);
  const score = Number.isFinite(given) ? Math.round(Math.min(100, Math.max(0, given))) : fromSteps;
  const list = (value, max, map) => (Array.isArray(value) ? value : []).map(map).filter(Boolean).slice(0, max);

  return {
    score,
    verdict: flat(raw.verdict, 300),
    flow,
    corrections: list(raw.corrections, 6, (c) => {
      const out = { youSaid: flat(c?.youSaid, 300), actually: flat(c?.actually, 500), why: flat(c?.why, 500) };
      return out.actually ? out : null;
    }),
    strengths: list(raw.strengths, 3, (s) => flat(s, 200) || null),
    nextStep: flat(raw.nextStep, 300),
  };
}

/** Mark the explanation. Asking again after marking returns the same marks. */
async function finishSession({ userId, id, today }) {
  const session = await findOwn(userId, id);
  if (session.status === 'graded') return present(session);
  if (!studentTurns(session).length) throw badRequest('Explain the concept first, then ask for your marks.');

  const raw = await complete({
    messages: [
      { role: 'system', content: teachBackGradePrompt({ concept: session.concept, focus: session.focus, reference: session.reference }) },
      { role: 'user', content: `The whole teach-back (Novard's questions give context; mark only what the student said):\n\n${transcriptText(session)}` },
    ],
    model: MODELS.REASONING,
    temperature: 0.2,
  });
  let result = null;
  try {
    result = normaliseResult(parseModelJson(raw, { context: 'teach-back marks' }));
  } catch (error) {
    logger.warn('Could not parse the teach-back marks', { error: error.message });
  }
  if (!result) throw upstreamError('Your marks could not be worked out. Please try again.');

  // Only one request can turn the session from active to graded.
  const graded = await TeachBack.findOneAndUpdate(
    { _id: session._id, userId, status: 'active' },
    { $set: { status: 'graded', result, gradedAt: new Date() } },
    { new: true },
  );
  if (graded?.examRef?.examId) {
    // The exam learns from it too; a problem there never costs the student their marks.
    await require('./examService').recordTeachBack({ userId, examRef: graded.examRef, score: graded.result.score, today })
      .catch((error) => logger.warn('Could not record the teach-back on the exam', { error: error.message }));
  }
  return present(graded || await findOwn(userId, id));
}

// ── teach me to get stronger ───────────────────────────────────────────────

const OPENING_REQUEST = 'Teach me my weak spots so I get stronger.';

/** Novard as a tutor on the steps the student lagged on. No message = the opening lesson. */
async function coach({ userId, id, message }) {
  const session = await findOwn(userId, id);
  if (session.status !== 'graded') throw conflict('Finish teaching and get your marks first.', { code: 'NOT_GRADED' });
  const input = message === undefined || message === null || message === ''
    ? OPENING_REQUEST
    : text(message, 'Message', { max: LIMITS.turn, collapse: false });

  const reply = await converse({
    Model: TeachBack,
    filter: { _id: session._id, userId },
    field: 'coaching',
    timeKey: 'at',
    system: teachBackCoachPrompt({ concept: session.concept, focus: session.focus, reference: session.reference, result: session.result }),
    input,
    tier: 'REASONING',
    temperature: 0.5,
  });
  return { reply, session: present(await findOwn(userId, id)) };
}

module.exports = {
  MAX_FOLLOW_UPS,
  listSessions,
  getSession,
  deleteSession,
  voiceEnabled,
  startSession,
  addTurn,
  finishSession,
  coach,
  _internal: { flowChart, normaliseResult },
};
