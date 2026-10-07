import { apiJson } from './api';

/**
 * Todo lists: API calls and the date helpers shared by the page and the bell.
 * Due dates are calendar days ("YYYY-MM-DD") in the student's own time zone;
 * every call sends `today` so the server counts overdue tasks the same way.
 */

const pad = (n) => String(n).padStart(2, '0');

/** Today in the student's time zone, as YYYY-MM-DD. */
export const localToday = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 'overdue' | 'today' | 'soon' (within 3 days) | 'later' | null for an open task. */
export function dueStatus(dueDate, today = localToday()) {
  if (!dueDate) return null;
  if (dueDate < today) return 'overdue';
  if (dueDate === today) return 'today';
  const days = (Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5;
  return days <= 3 ? 'soon' : 'later';
}

/** "Today", "Tomorrow", "Yesterday", "Mon 12 Oct" or "12 Oct 2027". */
export function dueLabel(dueDate, today = localToday()) {
  if (!dueDate) return '';
  const days = Math.round((Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  const date = new Date(`${dueDate}T12:00:00`);
  const sameYear = dueDate.slice(0, 4) === today.slice(0, 4);
  return date.toLocaleDateString(undefined, sameYear ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

export const PRIORITIES = [
  { id: 'high', label: 'High', tone: 'danger' },
  { id: 'medium', label: 'Medium', tone: 'warning' },
  { id: 'low', label: 'Low', tone: 'neutral' },
];
export const priorityOf = (id) => PRIORITIES.find((p) => p.id === id) || null;

const withToday = (path) => `${path}${path.includes('?') ? '&' : '?'}today=${localToday()}`;
const send = (method, path, body) => apiJson(withToday(path), { method, body: body === undefined ? undefined : { ...body, today: localToday() } });
const enc = encodeURIComponent;

export const todosApi = {
  lists: () => apiJson(withToday('/api/todos')).then((r) => r.lists),
  get: (id) => apiJson(withToday(`/api/todos/${enc(id)}`)),
  create: (body) => send('POST', '/api/todos', body),
  update: (id, body) => send('PATCH', `/api/todos/${enc(id)}`, body),
  remove: (id) => send('DELETE', `/api/todos/${enc(id)}`),
  addItem: (id, body) => send('POST', `/api/todos/${enc(id)}/items`, body),
  updateItem: (id, itemId, body) => send('PATCH', `/api/todos/${enc(id)}/items/${enc(itemId)}`, body),
  removeItem: (id, itemId) => send('DELETE', `/api/todos/${enc(id)}/items/${enc(itemId)}`),
  reorder: (id, itemIds) => send('PUT', `/api/todos/${enc(id)}/order`, { itemIds }),
  clearCompleted: (id) => send('POST', `/api/todos/${enc(id)}/clear-completed`, {}),
  draft: (prompt) => send('POST', '/api/todos/draft', { prompt }),
  toSkillPlan: (id, body) => send('POST', `/api/todos/${enc(id)}/skill-plan`, body),
};

/** The summary the lists rail shows, from a full list. */
export const summaryOf = ({ items, ...summary }) => summary;
