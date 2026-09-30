// Env layer for the rateLimits setting (read when config/env.js loads).
process.env.RATE_LIMIT_API_PER_MINUTE = '123';

const request = require('supertest');
const { createApp } = require('../../app');
const Setting = require('../../models/setting');
const AdminAuditLog = require('../../models/adminAuditLog');
const settings = require('../../services/settingsService');
const { useTestDatabase } = require('../helpers/db');
const { adminBearer, superadminBearer } = require('../helpers/auth');

useTestDatabase();
const app = createApp();

afterEach(() => settings._reset());

const find = (list, key) => list.find((s) => s.key === key);

describe('runtime settings: DB > env > default', () => {
  it('uses the code default, then env, then a saved override', async () => {
    const root = await superadminBearer();
    const list = (await request(app).get('/api/admin/settings').set('Authorization', root)).body.settings;

    expect(find(list, 'features.notes')).toMatchObject({ source: 'default', value: { enabled: true } });
    expect(find(list, 'rateLimits')).toMatchObject({ source: 'env', value: { apiPerMinute: 123 } });

    await request(app).put('/api/admin/settings/rateLimits').set('Authorization', root).send({ value: { apiPerMinute: 500 } }).expect(200);
    const after = (await request(app).get('/api/admin/settings').set('Authorization', root)).body.settings;
    // Partial update: the other fields keep their value.
    expect(find(after, 'rateLimits')).toMatchObject({ source: 'db', value: { apiPerMinute: 500, aiPerMinute: 30 }, updatedBy: 'root@example.com' });
    expect(await settings.get('rateLimits')).toMatchObject({ apiPerMinute: 500 });
  });

  it('reset removes the override', async () => {
    const admin = await adminBearer();
    await request(app).put('/api/admin/settings/features.notes').set('Authorization', admin).send({ value: { enabled: false, message: 'Back soon' } }).expect(200);
    expect((await settings.get('features.notes')).enabled).toBe(false);
    const res = await request(app).put('/api/admin/settings/features.notes').set('Authorization', admin).send({ reset: true });
    expect(res.body.value.enabled).toBe(true);
    expect(await Setting.countDocuments({ key: 'features.notes' })).toBe(0);
  });

  it('writes an audit entry with before and after', async () => {
    const admin = await adminBearer();
    await request(app).put('/api/admin/settings/features.quizzes').set('Authorization', admin).send({ value: { enabled: false } });
    const entry = await AdminAuditLog.findOne({ action: 'setting.update' }).lean();
    expect(entry).toMatchObject({ adminId: 'ada@example.com', target: { type: 'setting', id: 'features.quizzes' } });
    expect(entry.before.enabled).toBe(true);
    expect(entry.after.enabled).toBe(false);
  });
});

describe('validation', () => {
  it.each([
    ['features.notes', { enabled: 'no' }],
    ['features.notes', { enabled: true, colour: 'red' }],
    ['rateLimits', { apiPerMinute: 0 }],
    ['risk.thresholds', { fixed: { MEDIUM: 0.9, HIGH: 0.5, CRITICAL: 0.95 } }],
    ['ai.routes', { made_up_task: 'openai/gpt-oss-20b' }],
    ['ai.routes', { risk_lane: 'not a model; drop' }],
    ['reports', { areas: [{ id: 'notes', label: 'Notes' }] }],
    ['banners.dashboard', { until: 'someday' }],
  ])('rejects %s = %j', async (key, value) => {
    const root = await superadminBearer();
    const res = await request(app).put(`/api/admin/settings/${key}`).set('Authorization', root).send({ value });
    expect(res.status).toBe(400);
    expect(await Setting.countDocuments({ key })).toBe(0);
  });

  it('404s an unknown setting', async () => {
    const root = await superadminBearer();
    expect((await request(app).put('/api/admin/settings/nope').set('Authorization', root).send({ value: 1 })).status).toBe(404);
  });

  it('accepts a renamed and an added area', async () => {
    const root = await superadminBearer();
    const { areas } = await settings.get('reports');
    const next = [...areas.map((a) => (a.id === 'notes' ? { ...a, label: 'Notes & PDFs' } : a)), { id: 'mock-tests', label: 'Mock tests', mergedInto: null }];
    const res = await request(app).put('/api/admin/settings/reports').set('Authorization', root).send({ value: { areas: next } });
    expect(res.status).toBe(200);
    expect(res.body.value.areas.find((a) => a.id === 'notes').label).toBe('Notes & PDFs');
    expect(res.body.value.maxOpenPerArea).toBe(2);
  });
});

describe('critical settings', () => {
  it('only a superadmin can change them', async () => {
    const admin = await adminBearer();
    const res = await request(app).put('/api/admin/settings/ai.limits').set('Authorization', admin).send({ value: { globalDailyUsdCap: 5 } });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SUPERADMIN_ONLY');
    const list = (await request(app).get('/api/admin/settings').set('Authorization', admin)).body.settings;
    expect(find(list, 'ai.limits').editable).toBe(false);
    expect(find(list, 'features.notes').editable).toBe(true);
  });
});

describe('cache across instances', () => {
  it('picks up a change made elsewhere after the TTL, not before', async () => {
    settings._reset({ ttlMs: 60_000 });
    expect((await settings.get('features.roadmap')).enabled).toBe(true);

    // Another instance saves a change: the row plus a new version stamp.
    await Setting.create({ key: 'features.roadmap', value: { enabled: false, message: '', notice: '' } });
    await Setting.updateOne({ key: settings.VERSION_KEY }, { $set: { value: { n: 1, stamp: 'elsewhere' } } }, { upsert: true });

    expect((await settings.get('features.roadmap')).enabled).toBe(true); // still cached
    settings._reset({ ttlMs: 0 }); // the TTL passes
    expect((await settings.get('features.roadmap')).enabled).toBe(false);
  });
});

describe('rate limits follow the setting without a restart', () => {
  afterEach(() => { delete process.env.RATE_LIMIT_IN_TESTS; });

  it('applies a lowered API limit on the next request', async () => {
    const root = await superadminBearer();
    await request(app).put('/api/admin/settings/rateLimits').set('Authorization', root).send({ value: { apiPerMinute: 10 } }).expect(200);
    process.env.RATE_LIMIT_IN_TESTS = '1';
    const statuses = [];
    for (let i = 0; i < 11; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      statuses.push((await request(app).get('/api/app-status')).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe('GET /api/app-status', () => {
  it('reports switched-off tools, notices and the banner, without signing in', async () => {
    const admin = await adminBearer();
    await request(app).put('/api/admin/settings/features.videoSummarizer').set('Authorization', admin)
      .send({ value: { enabled: false, message: 'Captions are down; back in an hour.' } });
    await request(app).put('/api/admin/settings/features.notes').set('Authorization', admin)
      .send({ value: { notice: 'PDF uploads are slow today.' } });
    await request(app).put('/api/admin/settings/banners.dashboard').set('Authorization', admin)
      .send({ value: { enabled: true, title: 'New!', body: 'Report problems from any AI answer.' } });

    const res = await request(app).get('/api/app-status');
    expect(res.status).toBe(200);
    expect(res.body.features.videoSummarizer).toMatchObject({ enabled: false, message: 'Captions are down; back in an hour.' });
    expect(res.body.features.notes).toMatchObject({ enabled: true, notice: 'PDF uploads are slow today.' });
    expect(res.body.banner).toMatchObject({ title: 'New!' });
    expect(res.body.maintenance.enabled).toBe(false);
  });

  it('hides a banner whose end date has passed', async () => {
    const admin = await adminBearer();
    await request(app).put('/api/admin/settings/banners.dashboard').set('Authorization', admin)
      .send({ value: { enabled: true, title: 'Old', until: '2020-01-01T00:00:00Z' } });
    expect((await request(app).get('/api/app-status')).body.banner).toBeNull();
  });
});
