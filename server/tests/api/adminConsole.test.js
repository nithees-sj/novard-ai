// A Gemini key is set so the "keys never leak" check covers it too (no Gemini call is made here).
process.env.GOOGLE_API_KEY = 'test-gemini-secret-key-9876';

const mockCreate = jest.fn();
jest.mock('groq-sdk', () => {
  const Groq = jest.fn().mockImplementation(() => ({ chat: { completions: { create: mockCreate } } }));
  Groq.default = Groq;
  return Groq;
});

const request = require('supertest');
const { createApp } = require('../../app');
const User = require('../../models/user');
const ForumIssue = require('../../models/forumIssue');
const ForumComment = require('../../models/forumComment');
const Notification = require('../../models/notification');
const RiskAlert = require('../../models/riskAlert');
const AdminAuditLog = require('../../models/adminAuditLog');
const settings = require('../../services/settingsService');
const { seedDemo } = require('../../services/earlyWarning/demoSeed');
const { env } = require('../../config/env');
const { useTestDatabase } = require('../helpers/db');
const { ALICE, bearer, adminBearer, superadminBearer } = require('../helpers/auth');

useTestDatabase();
const app = createApp();

afterEach(() => {
  mockCreate.mockReset();
  settings._reset();
});

const get = (path, auth) => request(app).get(path).set('Authorization', auth);

describe('overview and risk board', () => {
  it('ranks the spiking area first with plain-word drivers and a sparkline', async () => {
    await seedDemo({ area: 'video-summarizer', now: new Date() });
    const admin = await adminBearer();

    const board = await get('/api/admin/risk/board?rescan=false', admin);
    expect(board.status).toBe(200);
    const [top] = board.body.areas;
    expect(top).toMatchObject({ area: 'video-summarizer', label: 'Video Summarizer' });
    expect(['HIGH', 'CRITICAL']).toContain(top.level);
    expect(top.drivers[0].label).toMatch(/[a-z]/);
    expect(top.sparkline.length).toBeGreaterThan(20);
    expect(top.openReports).toBeGreaterThan(0);

    const area = await get('/api/admin/risk/areas/video-summarizer', admin);
    expect(area.body).toMatchObject({ area: 'video-summarizer', thresholds: { from: expect.any(String) } });
    expect(area.body.series.length).toBeGreaterThan(20);
    expect(area.body.openReports.length).toBeGreaterThan(0);
    expect((await get('/api/admin/risk/areas/nowhere', admin)).status).toBe(404);

    const overview = await get('/api/admin/overview', admin);
    expect(overview.body.risk.levels.LOW).toBeGreaterThan(5);
    expect(overview.body.reports.open).toBeGreaterThan(0);
    expect(overview.body.gateways).toMatchObject({ mongodb: 'ok' });
    expect(overview.body.alerts.length).toBeGreaterThan(0);
  }, 60000);

  it('acknowledging an alert is audited, and only works once', async () => {
    const alert = await RiskAlert.create({ area: 'notes', windowEnd: new Date('2026-09-30T00:00:00Z'), level: 'HIGH', score: 0.9, message: 'Notes risk has risen' });
    const admin = await adminBearer();
    expect((await get('/api/admin/risk/alerts', admin)).body.open).toHaveLength(1);
    expect((await request(app).post(`/api/admin/risk/alerts/${alert._id}/ack`).set('Authorization', admin)).status).toBe(200);
    expect((await request(app).post(`/api/admin/risk/alerts/${alert._id}/ack`).set('Authorization', admin)).status).toBe(404);
    expect((await get('/api/admin/risk/alerts', admin)).body.open).toHaveLength(0);
    expect(await AdminAuditLog.findOne({ action: 'risk.alert.ack' })).toBeTruthy();
  });
});

describe('gateways', () => {
  it('never returns an API key, only whether it is set and its last 4 characters', async () => {
    const admin = await superadminBearer();
    const paths = ['/api/admin/gateways', '/api/admin/gateways/groq', '/api/admin/gateways/gemini', '/api/admin/gateways/youtube',
      '/api/admin/gateways/oauth', '/api/admin/gateways/mongodb', '/api/admin/overview', '/api/admin/settings', '/api/admin/costs',
      '/api/admin/risk/board?rescan=false', '/api/admin/users', '/api/admin/audit-log', '/api/admin/auth/me', '/api/app-status'];
    const bodies = await Promise.all(paths.map((p) => get(p, admin)));
    bodies.forEach((res, i) => {
      expect([paths[i], res.status]).toEqual([paths[i], 200]);
      const text = JSON.stringify(res.body);
      [env.groqApiKey, env.geminiApiKey, env.jwtSecret].forEach((secret) => expect(text).not.toContain(secret));
    });
    const list = bodies[0].body.gateways;
    expect(list.find((g) => g.id === 'groq').key).toEqual({ configured: true, last4: env.groqApiKey.slice(-4) });
    expect(list.find((g) => g.id === 'gemini').key).toEqual({ configured: true, last4: '9876' });
  });

  it('only the settings that belong to a gateway can be changed from its page', async () => {
    const admin = await adminBearer();
    const ok = await request(app).put('/api/admin/gateways/youtube/settings').set('Authorization', admin).send({ key: 'gateways.youtube', value: { enabled: false } });
    expect(ok.status).toBe(200);
    expect((await settings.get('gateways.youtube')).enabled).toBe(false);
    expect((await request(app).put('/api/admin/gateways/youtube/settings').set('Authorization', admin).send({ key: 'ai.routes', value: {} })).status).toBe(400);
    expect((await request(app).put('/api/admin/gateways/groq/settings').set('Authorization', admin).send({ key: 'ai.params', value: { reasoningEffort: 'extreme' } })).status).toBe(400);
    // Critical settings stay superadmin-only on the gateway page too.
    expect((await request(app).put('/api/admin/gateways/groq/settings').set('Authorization', admin).send({ key: 'ai.limits', value: { globalDailyUsdCap: 2 } })).status).toBe(403);
  });

  it('tests a gateway with one tiny call', async () => {
    const admin = await adminBearer();
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'OK' } }], usage: { prompt_tokens: 12, completion_tokens: 2 } });
    const groq = await request(app).post('/api/admin/gateways/groq/test').set('Authorization', admin);
    expect(groq.body).toMatchObject({ ok: true, result: 'OK' });
    expect(groq.body.latencyMs).toEqual(expect.any(Number));
    const detail = await get('/api/admin/gateways/groq', admin);
    expect(detail.body.windows['24h']).toMatchObject({ calls: 1, errorRate: 0 });
    expect(detail.body.byFeature[0]).toMatchObject({ feature: 'admin.test' });

    mockCreate.mockRejectedValue(Object.assign(new Error('401 Invalid API Key'), { status: 401 }));
    expect((await request(app).post('/api/admin/gateways/groq/test').set('Authorization', admin)).body.ok).toBe(false);
    expect((await request(app).post('/api/admin/gateways/mongodb/test').set('Authorization', admin)).body).toMatchObject({ ok: true });
    expect((await request(app).post('/api/admin/gateways/nope/test').set('Authorization', admin)).status).toBe(404);
  });
});

describe('users', () => {
  it('lists users with masked emails; revealing one is audited', async () => {
    await User.create({ email: ALICE.email, name: ALICE.name });
    const admin = await adminBearer();
    const list = await get('/api/admin/users?q=alice', admin);
    expect(list.body.users).toHaveLength(1);
    expect(list.body.users[0].email).toBe('a***@example.com');
    const detail = await get(`/api/admin/users/${list.body.users[0]._id}`, admin);
    expect(detail.body.user.email).toBe('a***@example.com');
    expect(detail.body.activity).toHaveProperty('notes', 0);
    const reveal = await request(app).post(`/api/admin/users/${list.body.users[0]._id}/reveal-email`).set('Authorization', admin);
    expect(reveal.body.email).toBe(ALICE.email);
    expect(await AdminAuditLog.findOne({ action: 'user.reveal_email' })).toBeTruthy();
    const admins = await get('/api/admin/users?role=admins', admin);
    expect(admins.body.users.map((u) => u.role)).toEqual(['admin']);
  });
});

describe('moderation', () => {
  it('hides a wrong AI reply from students, deletes replies and threads, all audited', async () => {
    await ForumIssue.create({ issueId: 'ISSUE_1', title: 'How do closures work?', description: 'Confused by closures in loops.', userEmail: ALICE.email, userName: 'Alice' });
    const ai = await ForumComment.create({ issueId: 'ISSUE_1', content: 'Closures copy variables by value.', userEmail: 'ai@novard.com', userName: 'AI Assistant', isAI: true });
    const human = await ForumComment.create({ issueId: 'ISSUE_1', content: 'Spam spam', userEmail: 'bob@example.com', userName: 'Bob' });
    const admin = await adminBearer();

    await request(app).put(`/api/admin/forum/comments/${ai._id}/hidden`).set('Authorization', admin).send({ hidden: true }).expect(200);
    const studentView = await get('/api/forum/issues/ISSUE_1/comments', bearer());
    expect(JSON.stringify(studentView.body)).not.toContain('Closures copy variables');
    const adminView = await get('/api/admin/forum/issues/ISSUE_1', admin);
    expect(adminView.body.comments.find((c) => c.isAI).hidden).toBe(true);

    await request(app).delete(`/api/admin/forum/comments/${human._id}`).set('Authorization', admin).expect(200);
    await request(app).put('/api/admin/forum/issues/ISSUE_1/status').set('Authorization', admin).send({ status: 'closed' }).expect(200);
    await request(app).delete('/api/admin/forum/issues/ISSUE_1').set('Authorization', admin).expect(200);
    expect(await ForumIssue.countDocuments()).toBe(0);
    const actions = (await AdminAuditLog.find().lean()).map((a) => a.action).sort();
    expect(actions).toEqual(['forum.comment.delete', 'forum.comment.hide', 'forum.issue.delete', 'forum.issue.status']);
    expect((await request(app).put(`/api/admin/forum/comments/${ai._id}/hidden`).set('Authorization', admin).send({ hidden: 'yes' })).status).toBe(400);
  });
});

describe('announcements', () => {
  it('reaches recent reporters of one area (or everyone) and can set the dashboard banner', async () => {
    await seedDemo({ area: 'video-summarizer', now: new Date() });
    await User.create([{ email: 's1@example.com', role: 'student' }, { email: 's2@example.com', role: 'student' }]);
    const admin = await adminBearer();
    const res = await request(app).post('/api/admin/announcements').set('Authorization', admin)
      .send({ audience: 'area_reporters', area: 'video-summarizer', title: 'Captions are fixed', body: 'Summaries work again.', banner: true });
    expect(res.status).toBe(201);
    expect(res.body.sent).toBeGreaterThan(10);
    expect(await Notification.countDocuments({ kind: 'announcement' })).toBe(res.body.sent);
    expect((await request(app).get('/api/app-status')).body.banner).toMatchObject({ title: 'Captions are fixed' });

    const all = await request(app).post('/api/admin/announcements').set('Authorization', admin).send({ audience: 'all', title: 'Hello everyone' });
    expect(all.body.sent).toBe(2); // students only: not admins
    expect((await get('/api/admin/announcements', admin)).body.announcements).toHaveLength(2);
    expect((await request(app).post('/api/admin/announcements').set('Authorization', admin).send({ audience: 'all' })).status).toBe(400);
  }, 60000);
});
