import { api, apiJson, errorMessage } from '../api';
import { saveSession, SESSION_EXPIRED_EVENT } from '../session';

describe('API client', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends the session token with axios requests', async () => {
    saveSession({ token: 'secret-token', user: { email: 'a@b.c' } });
    let seen;
    await api.get('/x', { adapter: async (config) => { seen = config; return { data: {}, status: 200, headers: {}, config }; } });
    expect(seen.headers.Authorization).toBe('Bearer secret-token');
  });

  it('announces an expired session on a 401', async () => {
    const onExpired = jest.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    await expect(api.get('/x', {
      adapter: async (config) => Promise.reject(Object.assign(new Error('401'), { config, response: { status: 401, data: {} } })),
    })).rejects.toBeTruthy();
    expect(onExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  });

  it('apiJson sends JSON with the token and surfaces the API error message', async () => {
    saveSession({ token: 'tok', user: { email: 'a@b.c' } });
    global.fetch = jest.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: 'Title is required.', code: 'BAD_REQUEST' }) }));
    await expect(apiJson('/api/forum/issues', { method: 'POST', body: { a: 1 } })).rejects.toMatchObject({
      message: 'Title is required.', status: 400, data: { code: 'BAD_REQUEST' },
    });
    const [, init] = global.fetch.mock.calls[0];
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok', 'Content-Type': 'application/json' });
    expect(init.body).toBe('{"a":1}');
  });

  it('errorMessage prefers the API message', () => {
    expect(errorMessage({ response: { data: { error: 'From API' } } }, 'fallback')).toBe('From API');
    expect(errorMessage(new Error('network'), 'fallback')).toBe('fallback');
  });
});
