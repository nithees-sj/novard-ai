const apiUrl = process.env.REACT_APP_API_ENDPOINT;

/**
 * Send one message to the Novard Agent and read its Server-Sent Events
 * stream (POST, so EventSource cannot be used).
 *
 * handlers: onMeta, onToken, onStatus, onAction (new or updated card),
 * onSuperseded, onTitle, onDone, onError.
 * Pass an AbortSignal to stop generation; the server keeps what was written.
 */
export async function streamAgentReply({ userId, userName, conversationId, message, signal }, handlers = {}) {
  const res = await fetch(`${apiUrl}/api/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, userName, conversationId, message }),
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

const json = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { data });
  return data;
};

export const agentApi = {
  list: (userId) => fetch(`${apiUrl}/api/agent/conversations/user/${encodeURIComponent(userId)}`).then(json),
  get: (id, userId) => fetch(`${apiUrl}/api/agent/conversations/${id}?userId=${encodeURIComponent(userId)}`).then(json),
  rename: (id, userId, title) => fetch(`${apiUrl}/api/agent/conversations/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, title }),
  }).then(json),
  remove: (id, userId) => fetch(`${apiUrl}/api/agent/conversations/${id}?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' }).then(json),
  decide: (id, actionId, body) => fetch(`${apiUrl}/api/agent/conversations/${id}/actions/${actionId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(json),
};
