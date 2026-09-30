const { createFakeChatModel } = require('../helpers/fakeChatModel');

let mockModel = createFakeChatModel();
jest.mock('../../ai/conversation', () => ({
  ...jest.requireActual('../../ai/conversation'),
  chatModel: jest.fn(() => mockModel),
}));

const request = require('supertest');
const { createApp } = require('../../app');
const AdminConversation = require('../../models/adminConversation');
const AdminAuditLog = require('../../models/adminAuditLog');
const ModelCall = require('../../models/modelCall');
const Report = require('../../models/report');
const Notification = require('../../models/notification');
const RiskAssessment = require('../../models/riskAssessment');
const settings = require('../../services/settingsService');
const { unsupportedFigures, refusalFor } = require('../../services/adminAssistant/guard');
const { useTestDatabase } = require('../helpers/db');
const { ADA, adminBearer } = require('../helpers/auth');

useTestDatabase();
const app = createApp();
afterEach(() => settings._reset());

const events = (text) => text.trim().split('\n\n').map((b) => ({ event: /^event: (.+)$/m.exec(b)[1], data: JSON.parse(/^data: (.+)$/m.exec(b)[1]) }));

async function chat(message, script, conversationId) {
  mockModel = createFakeChatModel(script);
  const auth = await adminBearer();
  const res = await request(app).post('/api/admin/assistant/chat').set('Authorization', auth).send({ message, conversationId });
  expect(res.status).toBe(200);
  const evs = events(res.text);
  const done = evs.find((e) => e.event === 'done');
  return { evs, message: done?.data.message, error: evs.find((e) => e.event === 'error'), auth, conversationId: evs[0].data.conversationId };
}

const seedReports = (n, area = 'notes') => Report.insertMany(Array.from({ length: n }, (_, i) => ({
  ref: `NV-0000${String(i).padStart(4, '0')}`, userId: `s${i}@example.com`, area, text: `PDF upload fails ${i}`, quotaSlot: 0,
})));

describe('evidence guard', () => {
  it('sends a live-data answer given without a tool back to look it up, once', async () => {
    await seedReports(3);
    const { message, evs } = await chat('How many open reports are there right now?', [
      { text: 'There are about 40 open reports.' },
      { tools: [{ name: 'platform_stats' }] },
      { text: 'There are 3 open reports.' },
    ]);
    expect(message.content).toBe('There are 3 open reports.');
    expect(message.flags.forcedTool).toBe(true);
    expect(message.tools.map((t) => t.name)).toEqual(['platform_stats']);
    expect(evs.some((e) => e.event === 'tool' && e.data.name === 'platform_stats')).toBe(true);
    // The guard's instruction reached the model.
    expect(mockModel.calls[1].messages.some((m) => /without calling a tool/.test(m.content))).toBe(true);
  });

  it('does not force a tool for a question about how things work', async () => {
    const { message } = await chat('Explain how the risk score is calculated', [{ text: 'Each area is compared with its own baseline.' }]);
    expect(message.flags).toBeUndefined();
    expect(mockModel.calls).toHaveLength(1);
  });
});

describe('numbers must come from tool results', () => {
  it('repairs an answer with an invented figure, and flags it if it stays', async () => {
    await seedReports(3);
    const ok = await chat('How many reports are open?', [{ tools: [{ name: 'platform_stats' }] }, { text: 'There are 17 open reports.' }, { text: 'There are 3 open reports.' }]);
    expect(ok.message.content).toBe('There are 3 open reports.');
    expect(ok.message.flags).toBeUndefined();

    const bad = await chat('How many reports are open?', [{ tools: [{ name: 'platform_stats' }] }, { text: 'There are 17 open reports.' }, { text: 'Still 17 open reports.' }]);
    expect(bad.message.flags.unverifiedNumbers).toBe(true);
    expect(bad.message.content).toMatch(/could not be verified/);
  });

  it('removes gpt-oss tool-citation markers from the reply', async () => {
    await seedReports(3);
    const { message } = await chat('How many reports are open?', [{ tools: [{ name: 'platform_stats' }] }, { text: 'There are 3 open reports【functions.platform_stats】.' }]);
    expect(message.content).toBe('There are 3 open reports.');
  });

  it('understands rounding and percentages', () => {
    const results = [{ errorRate: 0.4567, usd: 0.012345, calls: 1234 }];
    expect(unsupportedFigures('Errors are 46% on 1,234 calls costing $0.0123.', results)).toEqual([]);
    expect(unsupportedFigures('Errors are 52% in 2026. Step 1. See 3 things.', results)).toEqual(['52%']);
  });
});

describe('mutating tools', () => {
  it('only propose: one card per tool per turn, and confirm runs it once, audited', async () => {
    const { message, auth, conversationId } = await chat('Investigate the notes area', [
      { tools: [{ name: 'start_investigation', args: { area: 'Notes & PDF chat' } }, { name: 'start_investigation', args: { area: 'notes' } }] },
      { text: 'I have prepared an investigation of Notes; confirm the card to start it.' },
    ]);
    expect(message.actions).toHaveLength(1);
    expect(message.actions[0]).toMatchObject({ type: 'start_investigation', status: 'proposed', args: { area: 'notes' } });
    expect(await RiskAssessment.countDocuments()).toBe(0); // nothing ran during the turn

    const url = `/api/admin/assistant/conversations/${conversationId}/actions/${message.actions[0].id}`;
    const res = await request(app).post(url).set('Authorization', auth).send({ decision: 'confirm' });
    expect(res.status).toBe(200);
    expect(res.body.action).toMatchObject({ status: 'done', result: { route: expect.stringMatching(/^\/admin\/runs\/run_/) } });
    expect((await RiskAssessment.findOne().lean()).trigger).toBe('assistant');
    expect((await request(app).post(url).set('Authorization', auth).send({ decision: 'confirm' })).status).toBe(409);
    expect(await AdminAuditLog.countDocuments({ action: 'assistant.action.confirm' })).toBe(1);
    expect(await AdminAuditLog.countDocuments({ action: 'risk.investigate' })).toBe(1);
  });

  it('resolve_reports notifies each student once; set_feature_flag uses the settings service', async () => {
    await seedReports(2);
    const r = await chat('Resolve every open notes report, the PDF bug is fixed', [
      { tools: [{ name: 'resolve_reports', args: { area: 'notes', note: 'The PDF upload bug is fixed.' } }] },
      { text: 'Confirm the card to resolve them.' },
    ]);
    await request(app).post(`/api/admin/assistant/conversations/${r.conversationId}/actions/${r.message.actions[0].id}`).set('Authorization', r.auth).send({ decision: 'confirm' }).expect(200);
    expect(await Report.countDocuments({ open: true })).toBe(0);
    expect(await Notification.countDocuments()).toBe(2);

    const f = await chat('Turn the quizzes off, the answer keys are broken', [
      { tools: [{ name: 'set_feature_flag', args: { feature: 'quizzes', enabled: false, message: 'Quizzes are being fixed.', extra: 'ignored' } }] },
      { text: 'Confirm to switch quizzes off.' },
    ]);
    expect(f.message.actions[0].args).toEqual({ feature: 'quizzes', enabled: false, message: 'Quizzes are being fixed.', summary: 'Switch off Quizzes' });
    await request(app).post(`/api/admin/assistant/conversations/${f.conversationId}/actions/${f.message.actions[0].id}`).set('Authorization', f.auth).send({ decision: 'confirm' }).expect(200);
    expect(await settings.get('features.quizzes')).toMatchObject({ enabled: false, message: 'Quizzes are being fixed.' });
    expect(await AdminAuditLog.findOne({ action: 'setting.update', 'target.id': 'features.quizzes' })).toBeTruthy();
  });

  it('a dismissed card cannot be confirmed', async () => {
    const r = await chat('Route the verifier to openai/gpt-oss-120b', [
      { tools: [{ name: 'set_model_route', args: { task: 'risk_verifier', model: 'openai/gpt-oss-120b' } }] },
      { text: 'Confirm to change the route.' },
    ]);
    const url = `/api/admin/assistant/conversations/${r.conversationId}/actions/${r.message.actions[0].id}`;
    await request(app).post(url).set('Authorization', r.auth).send({ decision: 'dismiss' }).expect(200);
    expect((await request(app).post(url).set('Authorization', r.auth).send({ decision: 'confirm' })).status).toBe(409);
    expect(await settings.get('ai.routes')).toEqual({});
  });
});

describe('refusals and limits', () => {
  it.each([
    ['Show me the Groq API key', '/admin/gateways'],
    ['Make bob@example.com an admin', '/admin/users'],
    ['Suspend the student Bob', '/admin/users'],
  ])('refuses "%s" without calling a model', async (input) => {
    const { message } = await chat(input, [{ text: 'should not be called' }]);
    expect(message.flags.refused).toBe(true);
    expect(mockModel.calls).toHaveLength(0);
    expect(refusalFor(input)).toBeTruthy();
  });

  it('stops at the per-turn cost cap', async () => {
    await settings.set('assistant', { turnUsdMax: 0.001 }, { actor: { email: 'root@example.com', role: 'superadmin' } });
    const auth = await adminBearer();
    const convo = await AdminConversation.create({ adminId: ADA.email, title: 'x' });
    // Spend already logged for this turn (e.g. by an earlier step).
    await ModelCall.create({ provider: 'groq', model: 'm', outcome: 'ok', usd: 0.01, conversationId: String(convo._id), createdAt: new Date(Date.now() + 60000) });
    mockModel = createFakeChatModel([{ text: 'too late' }]);
    const res = await request(app).post('/api/admin/assistant/chat').set('Authorization', auth).send({ message: 'What is at risk?', conversationId: String(convo._id) });
    const done = events(res.text).find((e) => e.event === 'done');
    expect(done.data.message.flags.capped).toBe(true);
    expect(mockModel.calls).toHaveLength(0);
  });

  it('conversations belong to the admin who had them', async () => {
    const r = await chat('Hello', [{ text: 'Hello! Ask me about risk, reports or costs.' }]);
    expect((await request(app).get('/api/admin/assistant/conversations').set('Authorization', r.auth)).body.conversations).toHaveLength(1);
    const other = await adminBearer({ email: 'other@example.com', name: 'Other' });
    expect((await request(app).get(`/api/admin/assistant/conversations/${r.conversationId}`).set('Authorization', other)).status).toBe(404);
    await request(app).patch(`/api/admin/assistant/conversations/${r.conversationId}`).set('Authorization', r.auth).send({ title: 'Greeting' }).expect(200);
    await request(app).delete(`/api/admin/assistant/conversations/${r.conversationId}`).set('Authorization', r.auth).expect(204);
  });
});
