const request = require('supertest');
const { createApp } = require('../../app');
const Report = require('../../models/report');
const RiskAssessment = require('../../models/riskAssessment');
const RiskStep = require('../../models/riskStep');
const RiskObject = require('../../models/riskObject');
const AdminAuditLog = require('../../models/adminAuditLog');
const settings = require('../../services/settingsService');
const { seedDemo } = require('../../services/earlyWarning/demoSeed');
const { runAssessment } = require('../../services/earlyWarning/graph/runner');
const { cleanHypotheses } = require('../../services/earlyWarning/graph/agents');
const { useTestDatabase } = require('../helpers/db');
const { adminBearer } = require('../helpers/auth');

useTestDatabase();
const app = createApp();
const NOW = new Date('2026-09-30T15:00:00Z');
const WINDOW = new Date('2026-09-30T00:00:00Z');

/**
 * A scripted model layer: `script[task]` is a list of replies (or Errors) used
 * in turn; the last one repeats. Records every call.
 */
function fakeModels(script) {
  const calls = [];
  const used = {};
  const callJson = async (opts) => {
    calls.push(opts);
    const list = script[opts.task] || [new Error(`no script for ${opts.task}`)];
    const i = Math.min(used[opts.task] || 0, list.length - 1);
    used[opts.task] = (used[opts.task] || 0) + 1;
    const reply = typeof list[i] === 'function' ? list[i](opts) : list[i];
    if (reply instanceof Error) throw reply;
    return { data: reply, model: opts.task === 'risk_verifier' ? 'verifier-model' : 'author-model', provider: 'groq', tokensIn: 500, tokensOut: 100, usd: 0.0001, attempts: 1 };
  };
  return { callJson, calls };
}

/** A root cause citing the first semantic evidence it is offered. */
const citingRootCause = (opts) => {
  const ids = /ALLOWED IDS you may cite: (.*)/.exec(opts.user)[1].split(', ');
  const nv = ids.filter((id) => id.startsWith('NV-')).slice(0, 3);
  return {
    hypotheses: [{ cause: 'Caption downloads from YouTube are failing, so summaries come back empty.', confidence: 0.8, evidenceIds: [...nv, ids.find((id) => id.startsWith('X'))].filter(Boolean) }],
    recommendations: [
      { action: 'Flag the area', actionType: 'flag_area', params: {}, kind: 'corrective', priority: 1, rationale: 'visible on the board' },
      { action: 'Tell students we know', actionType: 'known_issue_banner', params: { tool: 'videoSummarizer', message: 'Captions are failing; we are on it.' }, priority: 1, rationale: 'reduce duplicate reports', execution: 'auto' },
      { action: 'Resolve the reports once fixed', actionType: 'bulk_resolve', params: { note: 'Captions are back.' }, priority: 2 },
    ],
  };
};

const SCRIPT = {
  risk_supervisor: [{ action: 'investigate', lanes: ['temporal', 'peers', 'semantic', 'telemetry', 'history'], reason: 'critical with no evidence' }, { action: 'analyze', reason: 'enough' }],
  risk_lane: [{ finding: 'Clear, rising problem.' }],
  risk_root_cause: [citingRootCause],
  risk_verifier: [{ verdict: 'accept', note: 'Citations support the claim.' }],
};

let seeded = false;
beforeEach(async () => {
  settings._reset();
  seeded = false;
});
const seed = async () => {
  if (!seeded) await seedDemo({ area: 'video-summarizer', now: NOW });
  seeded = true;
};

describe('the investigation graph', () => {
  it('LOW/MEDIUM never calls a model', async () => {
    await seed();
    const { callJson, calls } = fakeModels(SCRIPT);
    const run = await runAssessment({ area: 'notes', windowEnd: WINDOW, trigger: 'admin', actor: 'system', deps: { callJson } });
    expect(calls).toHaveLength(0);
    expect(run.outcome).toBe('no_investigation_needed');
    const nodes = (await RiskStep.find({ runId: run.runId }).sort({ seq: 1 }).lean()).map((s) => s.node);
    expect(nodes).toEqual(['buildFeatures', 'scoreRisk', 'resolveRiskObject', 'updateMonitor']);
  }, 60000);

  it('HIGH runs the lanes in parallel, then root cause, verifier, predictor and action', async () => {
    await seed();
    const { callJson, calls } = fakeModels(SCRIPT);
    const run = await runAssessment({ area: 'video-summarizer', windowEnd: WINDOW, trigger: 'admin', actor: 'system', deps: { callJson } });
    expect(run.outcome).toBe('investigated');
    const a = run.assessment;
    expect(a.lanesDone.sort()).toEqual(['history', 'peers', 'semantic', 'telemetry', 'temporal']);
    expect(a.evidence.some((e) => e.citeIds.some((id) => id.startsWith('NV-')))).toBe(true);
    expect(a.evidence.some((e) => e.citeIds.some((id) => id.startsWith('MC-')))).toBe(true);
    expect(a.evidence.some((e) => e.citeIds.some((id) => id.startsWith('GW-')))).toBe(true);
    expect(a.hypotheses[0]).toMatchObject({ confidence: 0.8 });
    expect(a.hypotheses[0].evidenceIds.length).toBeGreaterThan(0);
    expect(a.verification).toMatchObject({ verdict: 'accept', model: 'verifier-model' });
    expect(a.predictions.whatif).toHaveProperty(['AI error rate back to baseline']);
    expect(a.predictions.whatif['report volume +30%']).toBeGreaterThanOrEqual(a.predictions.whatif['resolve the open backlog']);
    // The verifier was told to avoid the author's model.
    expect(calls.find((c) => c.task === 'risk_verifier').avoid).toBe('author-model');

    // Only flag_area runs by itself; the "auto" the model asked for on the banner is ignored.
    const byType = Object.fromEntries(a.recommendations.map((r) => [r.actionType, r]));
    expect(byType.flag_area).toMatchObject({ execution: 'auto', status: 'auto_executed' });
    expect(byType.known_issue_banner).toMatchObject({ execution: 'manual', status: 'awaiting_approval' });
    expect((await RiskObject.findOne({ area: 'video-summarizer' })).flagged).toBe(true);
    expect((await settings.get('features.videoSummarizer')).notice).toBe('');

    const nodes = (await RiskStep.find({ runId: run.runId }).lean()).map((s) => s.node);
    expect(nodes.filter((n) => n === 'lane')).toHaveLength(5);
    expect(nodes).toEqual(expect.arrayContaining(['supervisor', 'rootCause', 'verifier', 'predictor', 'action']));
    expect(run.cost.calls).toBeGreaterThanOrEqual(0);
  }, 60000);

  it('caps uncited hypotheses at 0.35 and drops invented ids (EWDI rule)', () => {
    const allowed = new Set(['T1.1', 'NV-00000001']);
    const onlyUncited = cleanHypotheses([{ cause: 'a', confidence: 0.9, evidenceIds: ['NV-FAKE'] }, { cause: 'b', confidence: 0.2 }], allowed);
    expect(onlyUncited.map((h) => h.confidence)).toEqual([0.35, 0.2]);
    expect(onlyUncited[0]).toMatchObject({ evidenceIds: [], uncited: true });
    const mixed = cleanHypotheses([{ cause: 'cited', confidence: 0.7, evidenceIds: ['T1.1'] }, { cause: 'uncited', confidence: 0.9 }], allowed);
    expect(mixed.map((h) => h.cause)).toEqual(['cited']);
  });

  it('revises at most once, and need_more_evidence returns to the supervisor', async () => {
    await seed();
    const revise = fakeModels({ ...SCRIPT, risk_verifier: [{ verdict: 'revise', note: 'weak' }] });
    await runAssessment({ area: 'video-summarizer', windowEnd: WINDOW, actor: 'system', deps: { callJson: revise.callJson } });
    expect(revise.calls.filter((c) => c.task === 'risk_root_cause')).toHaveLength(2);
    expect(revise.calls.filter((c) => c.task === 'risk_verifier')).toHaveLength(1); // then the cap accepts
    expect(revise.calls.filter((c) => c.task === 'risk_root_cause')[1].user).toMatch(/rejected by review/);

    const more = fakeModels({ ...SCRIPT, risk_verifier: [{ verdict: 'need_more_evidence', note: 'thin' }, { verdict: 'accept', note: 'ok' }] });
    await runAssessment({ area: 'video-summarizer', windowEnd: WINDOW, actor: 'system', deps: { callJson: more.callJson } });
    // investigate -> analyze -> (verifier: need more evidence) -> supervisor again
    expect(more.calls.filter((c) => c.task === 'risk_supervisor').length).toBe(3);
    expect(more.calls.filter((c) => c.task === 'risk_root_cause').length).toBe(2);
  }, 60000);

  it('a revision that fails keeps the earlier, cited analysis', async () => {
    await seed();
    const { callJson, calls } = fakeModels({ ...SCRIPT, risk_root_cause: [citingRootCause, new Error('502 AI unavailable')], risk_verifier: [{ verdict: 'revise', note: 'tighten it' }] });
    const run = await runAssessment({ area: 'video-summarizer', windowEnd: WINDOW, actor: 'system', deps: { callJson } });
    expect(calls.filter((c) => c.task === 'risk_root_cause')).toHaveLength(2);
    expect(run.outcome).toBe('investigated');
    expect(run.assessment.hypotheses[0]).toMatchObject({ confidence: 0.8 });
    expect(run.assessment.hypotheses[0].degraded).toBeUndefined();
    expect(run.assessment.recommendations.length).toBe(3);
    expect(run.assessment.runErrors.join(' ')).toMatch(/revision/);
  }, 60000);

  it('a full model outage still ends with a degraded, cited, statistics-only assessment', async () => {
    await seed();
    const down = new Error('502 AI unavailable');
    const { callJson, calls } = fakeModels({ risk_supervisor: [down], risk_lane: [down], risk_root_cause: [down], risk_verifier: [down] });
    const run = await runAssessment({ area: 'video-summarizer', windowEnd: WINDOW, actor: 'system', deps: { callJson } });
    expect(run.status).toBe('done');
    expect(run.outcome).toBe('investigation_incomplete');
    const a = run.assessment;
    expect(a.degraded).toBe(true);
    expect(a.lanesDone.sort()).toEqual(['history', 'peers', 'semantic', 'telemetry', 'temporal']); // all lanes opened once
    expect(a.hypotheses).toHaveLength(1);
    expect(a.hypotheses[0]).toMatchObject({ confidence: 0.3, degraded: true });
    expect(a.hypotheses[0].cause).toMatch(/^Statistical anomaly: /);
    expect(a.hypotheses[0].evidenceIds.length).toBeGreaterThan(0); // cited from the tool evidence
    expect(a.evidence.some((e) => e.citeIds.some((id) => id.startsWith('NV-')))).toBe(true);
    expect(a.predictions).toBeTruthy();
    expect(calls.filter((c) => c.task === 'risk_supervisor')).toHaveLength(2); // loop 0 opens all lanes, then analyze
  }, 60000);

  it('stops spending cleanly when the budget runs out', async () => {
    await seed();
    await settings.set('risk.budget', { tokensMax: 2000 }, { actor: { email: 'root@example.com', role: 'superadmin' } });
    const { callJson, calls } = fakeModels(SCRIPT);
    const run = await runAssessment({ area: 'video-summarizer', windowEnd: WINDOW, actor: 'system', deps: { callJson } });
    expect(run.status).toBe('done');
    // supervisor (600 tokens) + some lanes; then nothing else calls a model.
    expect(calls.filter((c) => c.task === 'risk_root_cause')).toHaveLength(0);
    expect(run.assessment.hypotheses[0]).toMatchObject({ degraded: true });
    expect(run.assessment.runErrors).toEqual(expect.arrayContaining(['root cause: budget spent']));
  }, 60000);
});

describe('recommendations: approve, dismiss, feedback, what-if', () => {
  it('approving runs the same service as the console control, once, and audits it', async () => {
    await seed();
    const { callJson } = fakeModels(SCRIPT);
    const run = await runAssessment({ area: 'video-summarizer', windowEnd: WINDOW, actor: 'system', deps: { callJson } });
    const banner = run.assessment.recommendations.find((r) => r.actionType === 'known_issue_banner');
    const resolve = run.assessment.recommendations.find((r) => r.actionType === 'bulk_resolve');
    const admin = await adminBearer();
    const base = `/api/admin/risk/assessments/${run.assessment._id}/recommendations`;

    const ok = await request(app).post(`${base}/${banner.id}/approve`).set('Authorization', admin);
    expect(ok.status).toBe(200);
    // The same setting the Features & limits page writes, with its own audit entry.
    expect((await settings.get('features.videoSummarizer')).notice).toBe('Captions are failing; we are on it.');
    expect(await AdminAuditLog.findOne({ action: 'setting.update', 'target.id': 'features.videoSummarizer' })).toBeTruthy();
    expect(await AdminAuditLog.findOne({ action: 'recommendation.approve' })).toBeTruthy();
    expect((await request(app).post(`${base}/${banner.id}/approve`).set('Authorization', admin)).status).toBe(409);

    const open = await Report.countDocuments({ area: 'video-summarizer', open: true });
    expect(open).toBeGreaterThan(0);
    await request(app).post(`${base}/${resolve.id}/approve`).set('Authorization', admin).expect(200);
    expect(await Report.countDocuments({ area: 'video-summarizer', open: true })).toBe(0);

    const flag = run.assessment.recommendations.find((r) => r.actionType === 'flag_area');
    expect((await request(app).post(`${base}/${flag.id}/dismiss`).set('Authorization', admin)).status).toBe(409);

    const fb = await request(app).post(`/api/admin/risk/assessments/${run.assessment._id}/feedback`).set('Authorization', admin).send({ label: 'accurate', note: 'spot on' });
    expect(fb.status).toBe(200);
    // The spike saturates several drivers at +6 sigma: lowering one or two changes nothing, lowering them all does.
    const two = await request(app).post(`/api/admin/risk/assessments/${run.assessment._id}/whatif`).set('Authorization', admin).send({ deltas: { n_reports: 0.2, pct_urgent: 0.1 } });
    expect(two.body.newScore).toBeCloseTo(two.body.baseScore, 6);
    const deltas = Object.fromEntries(['n_reports', 'n_reporters', 'pct_urgent', 'repeat_rate', 'ai_report_rate', 'pct_negative', 'pct_unresolved', 'ai_error_rate', 'ai_429_rate', 'gateway_failure_rate', 'ai_p95_latency', 'volume_slope', 'ai_error_slope', 'unresolved_slope', 'sent_slope', 'mean_sent'].map((f) => [f, 0.05]));
    const whatif = await request(app).post(`/api/admin/risk/assessments/${run.assessment._id}/whatif`).set('Authorization', admin).send({ deltas });
    expect(whatif.body.newScore).toBeLessThan(two.body.baseScore - 0.1);
    expect(whatif.body.newZ).toBeLessThan(whatif.body.baseZ);
    expect((await request(app).post(`/api/admin/risk/assessments/${run.assessment._id}/whatif`).set('Authorization', admin).send({ deltas: { rm_rf: 2 } })).status).toBe(400);

    const detail = await request(app).get(`/api/admin/risk/assessments/${run.assessment._id}`).set('Authorization', admin);
    expect(detail.body.assessment.runId).toBe(run.runId);
  }, 60000);

  it('the live stream replays a run\'s steps and model calls, then ends with done', async () => {
    await seed();
    const { callJson } = fakeModels(SCRIPT);
    const run = await runAssessment({ area: 'notes', windowEnd: WINDOW, actor: 'system', deps: { callJson } });
    const admin = await adminBearer();
    const res = await request(app).get(`/api/admin/risk/runs/${run.runId}/stream`).set('Authorization', admin);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    const events = res.text.trim().split('\n\n').map((b) => ({ event: /^event: (.+)$/m.exec(b)[1], data: JSON.parse(/^data: (.+)$/m.exec(b)[1]) }));
    expect(events[0]).toMatchObject({ event: 'snapshot', data: { runId: run.runId } });
    expect(events.filter((e) => e.event === 'step').map((e) => e.data.node)).toEqual(['buildFeatures', 'scoreRisk', 'resolveRiskObject', 'updateMonitor']);
    expect(events[events.length - 1]).toMatchObject({ event: 'done', data: { status: 'done', outcome: 'no_investigation_needed' } });
    expect((await request(app).get('/api/admin/risk/runs/run_nope/stream').set('Authorization', admin)).status).toBe(404);
    const list = await request(app).get('/api/admin/risk/runs').set('Authorization', admin);
    expect(list.body.runs[0].runId).toBe(run.runId);
  }, 60000);

  it('POST /assess starts a run in the background and returns its id', async () => {
    await seed();
    const admin = await adminBearer();
    const res = await request(app).post('/api/admin/risk/areas/notes/assess').set('Authorization', admin);
    expect(res.status).toBe(202);
    expect(res.body.runId).toMatch(/^run_/);
    // notes is quiet: the run ends without any model call.
    for (let i = 0; i < 50; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const a = await RiskAssessment.findOne({ runId: res.body.runId }).lean();
      if (a.status !== 'running') break;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => { setTimeout(r, 100); });
    }
    expect((await RiskAssessment.findOne({ runId: res.body.runId }).lean()).outcome).toBe('no_investigation_needed');
    expect((await request(app).post('/api/admin/risk/areas/nowhere/assess').set('Authorization', admin)).status).toBe(400);
  }, 60000);
});
