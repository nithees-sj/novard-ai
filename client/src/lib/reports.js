import { api, apiFetch } from './api';

/**
 * Problem reports and notifications (the student side).
 */

/**
 * Send a report. `area` goes in the URL so the server can check the student's
 * quota before any file is uploaded.
 */
export async function submitReport({ area, text, source, routedBy, screenshot, voice, pdf }) {
  const form = new FormData();
  form.append('text', text);
  if (source) form.append('source', JSON.stringify(source));
  if (routedBy) form.append('routedBy', routedBy);
  if (screenshot) form.append('screenshot', screenshot);
  if (voice) form.append('voice', voice, voice.name || 'voice.webm');
  if (pdf) form.append('pdf', pdf);
  const { data } = await api.post(`/api/reports?area=${encodeURIComponent(area)}`, form);
  return data;
}

export const reportsApi = {
  mine: () => api.get('/api/reports/mine').then((r) => r.data),
  get: (ref) => api.get(`/api/reports/${encodeURIComponent(ref)}`).then((r) => r.data),
  reply: (ref, body) => api.post(`/api/reports/${encodeURIComponent(ref)}/notes`, { body }).then((r) => r.data),
  notifications: () => api.get('/api/notifications').then((r) => r.data),
  markRead: (ids) => api.post('/api/notifications/read', ids ? { ids } : {}).then((r) => r.data),
};

/** An attachment as an object URL (the API needs the session token, so a plain <a href> would not work). */
export async function attachmentUrl(ref, n) {
  const response = await apiFetch(`/api/reports/${encodeURIComponent(ref)}/attachments/${n}`);
  if (!response.ok) throw new Error('This attachment could not be loaded.');
  return URL.createObjectURL(await response.blob());
}

export const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' };
export const STATUS_TONE = { open: 'blue', in_progress: 'amber', resolved: 'green', closed: 'gray' };
