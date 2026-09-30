import { adminFetch } from './adminApi';

/**
 * Read a server-sent event stream from the admin API with the admin token
 * (EventSource cannot send an Authorization header), as lib/agentStream.js
 * does for the Novard Agent. Calls handlers[event](data) for each event.
 * Resolves when the stream ends.
 */
export async function readAdminStream(path, handlers = {}, { signal, method = 'GET', body } = {}) {
  const response = await adminFetch(path, {
    method,
    signal,
    ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  });
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    throw Object.assign(new Error(data.error || `Request failed (${response.status})`), { status: response.status, data });
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut = buffer.indexOf('\n\n');
    while (cut !== -1) {
      const block = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const event = /^event: (.+)$/m.exec(block)?.[1];
      const data = /^data: (.+)$/m.exec(block)?.[1];
      if (event && data) {
        try {
          handlers[event]?.(JSON.parse(data));
        } catch {
          // a malformed event is skipped
        }
      }
      cut = buffer.indexOf('\n\n');
    }
  }
}
