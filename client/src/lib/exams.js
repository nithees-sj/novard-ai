import { apiFetch, apiJson } from './api';
import { localToday } from './todos';

/**
 * Exam Autopilot: API calls and display helpers. Every call sends the
 * student's own `today`, so the plan, the countdown and "today's tasks" follow
 * their clock, not the server's.
 */

const enc = encodeURIComponent;
const withToday = (path) => `${path}${path.includes('?') ? '&' : '?'}today=${localToday()}`;
const send = (method, path, body) => apiJson(withToday(path), { method, body: body === undefined ? undefined : { ...body, today: localToday() } });

export const examsApi = {
  list: () => apiJson(withToday('/api/exams')).then((r) => r.exams || []),
  get: (id) => apiJson(withToday(`/api/exams/${enc(id)}`)),
  remove: (id) => apiJson(`/api/exams/${enc(id)}`, { method: 'DELETE' }),

  /** Read a syllabus: { title, examDate, syllabus | noteId | pdf } → a draft to review. */
  draft: async ({ title, examDate, syllabus, noteId, pdf }) => {
    if (!pdf) return send('POST', '/api/exams/draft', { title, examDate: examDate || undefined, syllabus: syllabus || undefined, noteId: noteId || undefined });
    const form = new FormData();
    if (title) form.append('title', title);
    if (examDate) form.append('examDate', examDate);
    form.append('pdf', pdf);
    const response = await apiFetch(withToday('/api/exams/draft'), { method: 'POST', body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || `Request failed (${response.status})`), { status: response.status, data });
    return data;
  },
  activate: (id, body) => send('POST', `/api/exams/${enc(id)}/activate`, body),
  update: (id, body) => send('PATCH', `/api/exams/${enc(id)}`, body),
  setTask: (id, taskId, status) => send('PATCH', `/api/exams/${enc(id)}/tasks/${enc(taskId)}`, { status }),
  taskQuiz: (id, taskId) => send('POST', `/api/exams/${enc(id)}/tasks/${enc(taskId)}/quiz`, {}),
  mock: (id, kind) => send('POST', `/api/exams/${enc(id)}/mock`, { kind }),
  quiz: (id, quizId) => apiJson(`/api/exams/${enc(id)}/quizzes/${enc(quizId)}`),
  submit: (id, quizId, answers) => send('POST', `/api/exams/${enc(id)}/quizzes/${enc(quizId)}/submit`, { answers }),
  /** The exam's own tutor: { messages }. `topicId` focuses it on one topic. */
  tutor: (id, message, topicId) => send('POST', `/api/exams/${enc(id)}/tutor`, { message, topicId: topicId || undefined }),
  clearTutor: (id) => apiJson(`/api/exams/${enc(id)}/tutor`, { method: 'DELETE' }),
};

export const pct = (x) => `${Math.round((x || 0) * 100)}%`;

/** How each kind of task looks and what its button does. */
export const TASK_TYPES = {
  learn: { label: 'Learn', icon: 'book', action: 'Study with tutor' },
  practice: { label: 'Practice quiz', icon: 'quiz', action: 'Start quiz' },
  review: { label: 'Review', icon: 'refresh', action: 'Start review' },
  teach: { label: 'Teach-back', icon: 'teach', action: 'Teach it' },
  mock: { label: 'Mock exam', icon: 'award', action: 'Start mock exam' },
};

export const PHASES = {
  learn: 'Learn & practise',
  consolidate: 'Consolidate',
  mock: 'Mock exam',
  light: 'Light review',
  rest: 'Rest day',
  exam: 'Exam day',
  none: 'Nothing planned',
};

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Thu 15 Oct" for a YYYY-MM-DD day. */
export const dayLabel = (day, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, opts);

/** Mastery as a tone: what the topic bar and badges use. */
export const masteryTone = (m) => (m >= 0.7 ? 'success' : m >= 0.4 ? 'warning' : 'danger');

/** "today", "yesterday", "3 days ago". */
export const daysAgo = (n) => (n === null || n === undefined ? '' : n === 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`);

/** Where a topic stands, as one short status for badges. */
export function topicStatus(t) {
  if (!t.learned) return t.evidenceCount ? { label: 'Not passed yet', tone: 'warning' } : { label: 'Not started', tone: 'neutral' };
  if (t.weakPrerequisites.length) return { label: 'Weak foundation', tone: 'danger', title: `Builds on ${t.weakPrerequisites.join(', ')}` };
  if (t.reviewDue) return { label: 'Review due', tone: 'warning' };
  return null;
}

/** What to ask the tutor to study a topic. */
export const lessonRequest = (topic) => `Teach me "${topic}" for this exam, step by step, then check I've understood it.`;
