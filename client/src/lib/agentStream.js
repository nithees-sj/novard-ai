import { apiFetch, apiJson } from './api';

/**
 * Send one message to the Novard Agent and read its Server-Sent Events
 * stream (POST, so EventSource cannot be used).
 *
 * handlers: onMeta, onToken, onStatus, onAction (new or updated card),
 * onAsk (questions with tap-to-answer options), onSuperseded, onTitle, onDone, onError.
 * Pass an AbortSignal to stop generation; the server keeps what was written.
 */
export async function streamAgentReply({ conversationId, message, signal }, handlers = {}) {
  const res = await apiFetch('/api/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, message }),
    signal,
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `The agent is unavailable (${res.status}).`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const dispatch = (block) => {
    let event = 'message';
    let data = '';
    block.split('\n').forEach((line) => {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    });
    if (!data) return;
    let payload;
    try { payload = JSON.parse(data); } catch { return; }
    const handler = {
      meta: handlers.onMeta,
      token: handlers.onToken,
      status: handlers.onStatus,
      action: handlers.onAction,
      ask: handlers.onAsk,
      superseded: handlers.onSuperseded,
      title: handlers.onTitle,
      done: handlers.onDone,
      error: handlers.onError,
    }[event];
    handler?.(payload);
  };

  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let split = buffer.indexOf('\n\n');
    while (split !== -1) {
      dispatch(buffer.slice(0, split));
      buffer = buffer.slice(split + 2);
      split = buffer.indexOf('\n\n');
    }
  }
  if (buffer.trim()) dispatch(buffer);
}

const enc = encodeURIComponent;

/**
 * Chat history, action cards and the learner profile. The student is
 * identified by the session, not by these arguments.
 * decide body: {decision: 'create'|'accept'|'confirm'|'dismiss', args?, remember?}
 */
export const agentApi = {
  list: (userId) => apiJson(`/api/agent/conversations/user/${enc(userId)}`),
  get: (id) => apiJson(`/api/agent/conversations/${enc(id)}`),
  rename: (id, userId, title) => apiJson(`/api/agent/conversations/${enc(id)}`, { method: 'PATCH', body: { title } }),
  remove: (id) => apiJson(`/api/agent/conversations/${enc(id)}`, { method: 'DELETE' }),
  decide: (id, actionId, body) => apiJson(`/api/agent/conversations/${enc(id)}/actions/${enc(actionId)}`, { method: 'POST', body }),
  getProfile: () => apiJson('/api/agent/profile'),
  saveProfile: (profile) => apiJson('/api/agent/profile', { method: 'PUT', body: profile }),
};
