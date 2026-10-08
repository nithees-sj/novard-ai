import { apiFetch, apiJson } from './api';
import { localToday } from './todos';

/**
 * Teach-Back Arena: explain a concept to Novard, get marks shown as a flow of
 * the concept, then let Novard teach the weak steps.
 */

const enc = encodeURIComponent;

/** multipart/form-data (a PDF or a recording); the browser sets the boundary. */
async function sendForm(path, form) {
  const response = await apiFetch(path, { method: 'POST', body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || `Request failed (${response.status})`), { status: response.status, data });
  return data;
}

export const teachBackApi = {
  list: () => apiJson('/api/teachback').then((r) => r.sessions || []),
  voice: () => apiJson('/api/teachback/voice'),
  get: (id) => apiJson(`/api/teachback/${enc(id)}`),
  remove: (id) => apiJson(`/api/teachback/${enc(id)}`, { method: 'DELETE' }),

  /** { concept, focus, noteId } or, with `pdf`, an upload that is also saved to Notes. */
  start: ({ concept, focus, noteId, pdf, examRef }) => {
    if (!pdf) return apiJson('/api/teachback', { method: 'POST', body: { concept, focus, noteId: noteId || undefined, examRef: examRef || undefined } });
    const form = new FormData();
    if (concept) form.append('concept', concept);
    if (focus) form.append('focus', focus);
    if (examRef) form.append('examRef', JSON.stringify(examRef));
    form.append('pdf', pdf);
    return sendForm('/api/teachback', form);
  },

  /** A typed explanation, or a recording (`voice`, a File). */
  explain: (id, { message, voice }) => {
    if (!voice) return apiJson(`/api/teachback/${enc(id)}/turns`, { method: 'POST', body: { message } });
    const form = new FormData();
    form.append('voice', voice);
    return sendForm(`/api/teachback/${enc(id)}/turns`, form);
  },

  // `today` lets an Exam Autopilot task linked to this session be ticked on the student's own day.
  finish: (id) => apiJson(`/api/teachback/${enc(id)}/finish`, { method: 'POST', body: { today: localToday() } }),
  coach: (id, message) => apiJson(`/api/teachback/${enc(id)}/coach`, { method: 'POST', body: message ? { message } : {} }),
};

/** How a step went, for the legend and the step list. */
export const STEP_STATUS = {
  good: { label: 'Explained well', tone: 'success', icon: 'success' },
  partial: { label: 'Partly explained', tone: 'warning', icon: 'info' },
  missed: { label: 'Missed', tone: 'neutral', icon: 'alert' },
  wrong: { label: 'Misunderstood', tone: 'danger', icon: 'x' },
};

/** The verdict's colour for a score. */
export const scoreTone = (score) => (score >= 80 ? 'success' : score >= 50 ? 'accent' : 'warning');
