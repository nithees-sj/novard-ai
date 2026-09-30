// The scheduler's secret is read once when config/env.js loads.
process.env.RISK_CRON_SECRET = 'scheduler-secret';

const request = require('supertest');
const { createApp } = require('../../app');
const Report = require('../../models/report');
const ModelCall = require('../../models/modelCall');
const RiskScore = require('../../models/riskScore');
const RiskAlert = require('../../models/riskAlert');
const RiskObject = require('../../models/riskObject');
const RiskPrecedent = require('../../models/riskPrecedent');
const AreaFeature = require('../../models/areaFeature');
const AdminAuditLog = require('../../models/adminAuditLog');
const { nextLifecycle, detectEscalations, buildFeatures } = require('../../services/earlyWarning/scoring');
const { applyCycle } = require('../../services/earlyWarning/lifecycle');
const { rescanAll } = require('../../services/earlyWarning/rescan');
const { seedDemo, clearDemo } = require('../../services/earlyWarning/demoSeed');
const { useTestDatabase } = require('../helpers/db');
const { adminBearer } = require('../helpers/auth');

useTestDatabase();
const app = createApp();
const NOW = new Date('2026-09-30T15:00:00Z');
const DAY = 24 * 3600 * 1000;

describe('risk-object lifecycle (EWDI resolve_risk_object)', () => {
  it('new -> ongoing -> escalated -> resolved (after 3 low cycles) -> recurring', () => {
    let o = null;
    const cycle = (score, isAlert) => {
      const next = nextLifecycle(o, { score, isAlert });
      if (next) o = { state: next.state, currentScore: score, lowStreak: next.lowStreak, riseStreak: next.riseStreak };
      return next;
    };
    expect(cycle(0.3, false)).toBeNull(); // nothing to track yet
    expect(cycle(0.85, true).state).toBe('new');
    expect(cycle(0.84, true).state).toBe('ongoing');
    expect(cycle(0.9, true).state).toBe('ongoing'); // one rise
    expect(cycle(0.95, true).state).toBe('escalated'); // two rises while alerting
    expect(cycle(0.4, false).state).toBe('escalated'); // below HIGH: state kept, streak 1
    expect(cycle(0.3, false).state).toBe('escalated');
    const resolved = cycle(0.2, false);
    expect(resolved).toMatchObject({ state: 'resolved', writePrecedent: true });
    expect(cycle(0.2, false)).toMatchObject({ state: 'resolved', writePrecedent: false }); // EWDI re-wrote one here
    expect(cycle(0.9, true).state).toBe('recurring');
  });

  it('applies a cycle once per window and writes one precedent', async () => {
    const day = (n) => new Date(Date.parse('2026-09-01T00:00:00Z') + n * DAY);
    const base = { area: 'notes', topic: 'pdf upload failure', riskScore: { attribution: [{ feature: 'n_reports', z: 4 }] } };
    const get = () => RiskObject.findOne({ dedupeKey: 'notes:pdf upload failure' }).lean();

    await applyCycle({ ...base, score: 0.9, isAlert: true, windowEnd: day(1), existing: null });
    expect((await get()).state).toBe('new');
    await applyCycle({ ...base, score: 0.95, isAlert: true, windowEnd: day(2), existing: await get() });
    await applyCycle({ ...base, score: 0.95, isAlert: true, windowEnd: day(2), existing: await get() }); // same window again: no-op
    expect((await get())).toMatchObject({ state: 'ongoing', riseStreak: 1 });
    for (let d = 3; d <= 5; d += 1) {
      // eslint-disable-next-line no-await-in-loop
      await applyCycle({ ...base, score: 0.2, isAlert: false, windowEnd: day(d), existing: await get() });
    }
    expect((await get()).state).toBe('resolved');
    await applyCycle({ ...base, score: 0.2, isAlert: false, windowEnd: day(6), existing: await get() });
    const precedents = await RiskPrecedent.find().lean();
    expect(precedents).toHaveLength(1);
    expect(precedents[0].resolution).toMatch(/stayed below HIGH for 3 cycles/);
  });
});

describe('escalation: one alert per episode', () => {
  const rows = (levels) => levels.map((level, i) => ({ windowEnd: new Date(Date.UTC(2026, 8, i + 1)), level, score: 0.5 + i / 100, attribution: [] }));

  it('alerts at the start of the episode and again on each worsening', () => {
    const marks = detectEscalations(rows(['LOW', 'MEDIUM', 'HIGH', 'HIGH', 'CRITICAL', 'CRITICAL']));
    expect(marks.map((m) => [m.row.level, m.prevLevel])).toEqual([['HIGH', 'MEDIUM'], ['CRITICAL', 'HIGH']]);
  });

  it('stays quiet once the area has recovered, and for a new episode alerts again', () => {
    expect(detectEscalations(rows(['HIGH', 'CRITICAL', 'MEDIUM']))).toEqual([]);
    const marks = detectEscalations(rows(['HIGH', 'LOW', 'HIGH']));
    expect(marks).toHaveLength(1);
    expect(marks[0].row.windowEnd).toEqual(new Date(Date.UTC(2026, 8, 3)));
  });
});

describe('cold start', () => {
  it('days before anything was measured are missing, not quiet (no launch-day spike)', () => {
    const days = { '2026-09-28': { n_reports: 4 }, '2026-09-29': { n_reports: 5 }, '2026-09-30': { n_reports: 4 } };
    const cfg = { metrics: [{ name: 'n_reports', kind: 'count' }], windowDays: 7, baselineDays: 28 };
    // As EWDI counts it, 21 empty baseline days: median 0, so 4 reports a day looks like a spike.
    expect(buildFeatures(days, '2026-09-30', cfg).n_reports__base_median).toBe(0);
    // Measured from the first day there was data: no baseline yet, nothing to score against.
    const f = buildFeatures(days, '2026-09-30', { ...cfg, dataStart: '2026-09-28' });
    expect(f.n_reports__base_median).toBeNull();
    expect(f.n_reports).toBeCloseTo(13 / 3);
  });

  it('an area with too little history is insufficient_baseline and uses fixed thresholds', async () => {
    const reports = Array.from({ length: 12 }, (_, i) => ({
      ref: `NV-${String(i).padStart(8, '0')}`, userId: `s${i}@example.com`, area: 'roadmap', text: 'Roadmap generation fails every time.',
      createdAt: new Date(NOW.getTime() - (i % 3) * DAY), open: false,
      enrichment: { status: 'done', sentiment: -0.8, urgency: 'high', intent: 'bug', topic: 'roadmap failure' },
    }));
    await Report.insertMany(reports);
    await rescanAll({ now: NOW });
    const latest = await RiskScore.findOne({ area: 'roadmap' }).sort({ windowEnd: -1 }).lean();
    expect(latest).toMatchObject({ status: 'insufficient_baseline', levelsFrom: 'fixed' });
  });
});

describe('the demo seed and a full rescan', () => {
  it('produces a genuine alert in the spiking area only, and re-running never re-alerts', async () => {
    const result = await seedDemo({ area: 'video-summarizer', now: NOW, student: 'you@example.com' });
    expect(result.spikeReports).toBeGreaterThan(40);
    expect(result.alerts.map((a) => a.area)).toEqual(expect.arrayContaining(['video-summarizer']));
    expect(result.alerts.every((a) => a.area === 'video-summarizer')).toBe(true);

    const latest = await RiskScore.findOne({ area: 'video-summarizer', windowEnd: new Date('2026-09-30T00:00:00Z') }).lean();
    expect(['HIGH', 'CRITICAL']).toContain(latest.level);
    expect(latest.status).toBe('scored');
    const drivers = latest.attribution.slice(0, 4).map((a) => a.feature);
    expect(drivers).toEqual(expect.arrayContaining(['n_reports']));
    const quiet = await RiskScore.findOne({ area: 'notes', windowEnd: new Date('2026-09-30T00:00:00Z') }).lean();
    expect(['LOW', 'MEDIUM']).toContain(quiet.level);
    // No false alarm anywhere in the quiet areas' history either.
    expect(await RiskScore.countDocuments({ area: { $ne: 'video-summarizer' }, level: { $in: ['HIGH', 'CRITICAL'] } })).toBe(0);

    // The real student got two of the open spike reports.
    expect(await Report.countDocuments({ userId: 'you@example.com', open: true })).toBe(2);
    // A risk object tracks the problem, keyed by area + topic.
    expect(await RiskObject.findOne({ area: 'video-summarizer' }).lean()).toMatchObject({ state: 'new' });

    const alerts = await RiskAlert.countDocuments();
    await rescanAll({ now: NOW });
    await rescanAll({ now: new Date(NOW.getTime() + 3600 * 1000) });
    expect(await RiskAlert.countDocuments()).toBe(alerts);

    // --clear removes exactly what the demo made.
    await Report.create({ ref: 'NV-REAL0001', userId: 'real@example.com', area: 'notes', text: 'A real report stays.', open: false });
    await clearDemo({ now: NOW });
    expect(await Report.countDocuments()).toBe(1);
    expect(await ModelCall.countDocuments()).toBe(0);
    expect(await RiskAlert.countDocuments()).toBe(0);
    expect(await RiskObject.countDocuments()).toBe(0);
    expect(await AreaFeature.countDocuments({ area: 'notes' })).toBeGreaterThan(0);
  }, 60000);
});

describe('rescan endpoints', () => {
  it('Cloud Scheduler needs the shared secret', async () => {
    expect((await request(app).post('/api/internal/risk/rescan')).status).toBe(401);
    expect((await request(app).post('/api/internal/risk/rescan').set('X-Risk-Cron-Secret', 'wrong')).status).toBe(401);
    const ok = await request(app).post('/api/internal/risk/rescan').set('X-Risk-Cron-Secret', 'scheduler-secret');
    expect(ok.status).toBe(200);
    expect(ok.body).toHaveProperty('scored');
  });

  it('an admin can rescan from the console (audited)', async () => {
    const admin = await adminBearer();
    const res = await request(app).post('/api/admin/risk/rescan').set('Authorization', admin).send({});
    expect(res.status).toBe(200);
    expect(await AdminAuditLog.findOne({ action: 'risk.rescan' })).toBeTruthy();
  });
});

describe('complaint rule: enough complaints put an area at risk, whatever its history', () => {
  const HOUR = 3600 * 1000;
  let n = 0;
  const complaint = (userId, fields, extra = {}) => {
    n += 1;
    return {
      ref: `NV-C${String(n).padStart(7, '0')}`, userId, area: 'notes', text: 'The notes chat does not work.', createdAt: new Date(Date.now() - n * HOUR),
      quotaSlot: n % 2, enrichment: { status: 'done', sentiment: -0.4, urgency: 'medium', intent: 'bug', ...fields }, ...extra,
    };
  };

  it('5 complaints from several students on a brand-new platform: HIGH, and the board says why', async () => {
    await Report.insertMany(['a', 'b', 'c', 'd', 'e'].map((s) => complaint(`${s}@example.com`, {})));
    const admin = await adminBearer();
    const res = await request(app).get('/api/admin/risk/board').set('Authorization', admin);
    expect(res.status).toBe(200);
    const notes = res.body.areas.find((a) => a.area === 'notes');
    expect(notes.level).toBe('HIGH');
    expect(notes.complaints).toMatchObject({ complaints: 5, severe: 0, reporters: 5, level: 'HIGH', raised: true });
    expect(notes.drivers[0]).toMatchObject({ feature: 'complaints', label: '5 complaints in 7 days', text: true });
    // It is at the top of the board, and an alert explains it.
    expect(res.body.areas[0].area).toBe('notes');
    const alert = await RiskAlert.findOne({ area: 'notes' }).lean();
    expect(alert.message).toMatch(/5 complaints in 7 days/);

    // The area page says how each report was read.
    const detail = await request(app).get('/api/admin/risk/areas/notes').set('Authorization', admin);
    expect(detail.body.openReports.map((r) => r.risk)).toEqual(Array(5).fill('complaint'));
    expect(detail.body.openReports[0].userId).toBeUndefined();
  });

  it('3 severe complaints are enough; suggestions and praise never count', async () => {
    await Report.insertMany([
      ...['a', 'b', 'c'].map((s) => complaint(`${s}@example.com`, { sentiment: -0.85, urgency: 'high' })),
      ...['d', 'e', 'f', 'g', 'h', 'i'].map((s) => complaint(`${s}@example.com`, { intent: 'feature_request', sentiment: 0.3, urgency: 'low' }, { area: 'quizzes' })),
    ]);
    await rescanAll();
    const latest = async (area) => RiskScore.findOne({ area }).sort({ windowEnd: -1 }).lean();
    expect(await latest('notes')).toMatchObject({ level: 'HIGH', complaints: expect.objectContaining({ severe: 3 }) });
    expect((await latest('quizzes')).level).toBe('LOW');
  });

  it('resolving the complaints brings the level down on the next board view', async () => {
    await Report.insertMany(['a', 'b', 'c', 'd', 'e'].map((s) => complaint(`${s}@example.com`, {})));
    const admin = await adminBearer();
    const level = async () => (await request(app).get('/api/admin/risk/board').set('Authorization', admin)).body.areas.find((a) => a.area === 'notes').level;
    expect(await level()).toBe('HIGH');
    const { resolveReports } = require('../../services/reportService');
    await resolveReports({ area: 'notes', note: 'Fixed the notes chat.', actor: 'ada@example.com' });
    await new Promise((r) => { setTimeout(r, 20); });
    expect(await level()).toBe('LOW');
  });
});
