const request = require('supertest');
const { createApp } = require('../../app');
const { useTestDatabase } = require('../helpers/db');
const { ALICE, BOB, bearer } = require('../helpers/auth');

useTestDatabase();
const app = createApp();

/** Every registered route as [method, path], with :params filled in. */
function allRoutes() {
  const routes = [];
  const walk = (stack) => stack.forEach((layer) => {
    if (layer.route) {
      Object.keys(layer.route.methods).forEach((method) => routes.push([method, layer.route.path]));
    } else if (layer.handle?.stack) {
      walk(layer.handle.stack);
    }
  });
  walk(app._router.stack);
  const fill = (path) => path
    .replace(':userId', ALICE.email)
    .replace(/:(\w+)/g, '64b7f0c2a1b2c3d4e5f60718');
  return routes.map(([method, path]) => [method, fill(path)]);
}

const PUBLIC = new Set([
  'get /health', 'get /', 'post /api/auth/google',
  'get /api/app-status', // feature switches and maintenance, shown before sign-in
  'post /api/admin/auth/google', // admin console sign-in (checks the role itself)
]);

describe('authentication on every route', () => {
  const routes = allRoutes().filter(([method, path]) => !PUBLIC.has(`${method} ${path}`));

  it('covers the whole API', () => {
    expect(routes.length).toBeGreaterThan(55);
  });

  it.each(routes)('%s %s requires a session', async (method, path) => {
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
    // Admin console routes ask for an admin sign-in instead.
    expect(res.body.code).toBe(path.startsWith('/api/admin/') ? 'ADMIN_SIGN_IN' : 'UNAUTHORIZED');
  });

  it('refuses a student session on every admin route', async () => {
    const adminRoutes = routes.filter(([, path]) => path.startsWith('/api/admin/'));
    expect(adminRoutes.length).toBeGreaterThan(5);
    const results = await Promise.all(adminRoutes.map(([method, path]) => request(app)[method](path).set('Authorization', bearer()).send({})));
    results.forEach((res) => expect(res.status).toBe(401));
  });
});

describe('ownership of user-scoped URLs', () => {
  it.each([
    ['get', `/notes/${BOB.email}`],
    ['get', `/doubt-clearances/${BOB.email}`],
    ['get', `/youtube-videos/${BOB.email}`],
    ['get', `/educational-video-requests/${BOB.email}`],
    ['get', `/api/skill-unlocker/plans/${BOB.email}`],
    ['get', `/api/roadmaps/user/${BOB.email}`],
    ['get', `/api/skill-gap/sessions/user/${BOB.email}`],
    ['get', `/api/agent/conversations/user/${BOB.email}`],
    ['get', `/api/analytics/${BOB.email}`],
    ['get', `/api/profile/${BOB.email}/overview`],
  ])('%s %s is refused for another student', async (method, path) => {
    const res = await request(app)[method](path).set('Authorization', bearer(ALICE));
    expect(res.status).toBe(403);
  });

  it('matches the email case-insensitively', async () => {
    const res = await request(app).get(`/notes/${ALICE.email.toUpperCase()}`).set('Authorization', bearer(ALICE));
    expect(res.status).toBe(200);
  });
});

describe('removed endpoints', () => {
  it.each([
    ['post', '/saveUser'],
    ['get', `/getUser/${ALICE.email}`],
    ['get', '/getUserProfile'],
    ['get', '/api/careerIds'],
    ['post', '/api/skills'],
    ['delete', '/api/skills/delete/devops'],
    ['post', '/upload-video'],
    ['post', '/youtube/search'],
    ['post', '/recommend-videos'],
    ['get', `/video-requests/${ALICE.email}`],
    ['post', '/api/forum/ai-response'],
    ['get', '/api/forum/search'],
  ])('%s %s no longer exists', async (method, path) => {
    const res = await request(app)[method](path).set('Authorization', bearer());
    expect([401, 404]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });
});

describe('request hygiene', () => {
  it('answers malformed JSON with a 400 in the standard error format', async () => {
    const res = await request(app).post('/api/forum/comments').set('Authorization', bearer())
      .set('Content-Type', 'application/json').send('{"issueId": ');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'The request body is not valid JSON.', code: 'BAD_REQUEST' });
  });

  it('refuses oversized bodies', async () => {
    const res = await request(app).post('/api/forum/comments').set('Authorization', bearer())
      .send({ content: 'x'.repeat(2 * 1024 * 1024) });
    expect(res.status).toBe(413);
  });

  it('refuses query-operator objects in place of ids', async () => {
    const res = await request(app).post('/summarize-notes').set('Authorization', bearer()).send({ noteId: { $gt: '' } });
    expect(res.status).toBe(400);
  });

  it('answers unknown routes with a JSON 404', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toMatchObject({ status: 'OK', database: 'up' });
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
