// The Groq SDK is replaced, so the real complete() / callJson() / chatModel() run end to end.
const mockCreate = jest.fn();
jest.mock('groq-sdk', () => {
  const Groq = jest.fn().mockImplementation(() => ({ chat: { completions: { create: mockCreate } } }));
  Groq.default = Groq;
  return Groq;
});
jest.mock('youtube-search-api', () => ({ GetListByKeyword: jest.fn(async () => ({ items: [] })) }));

const request = require('supertest');
const { ChatGroq } = require('@langchain/groq');
const { createApp } = require('../../app');
const Notes = require('../../models/notes');
const ModelCall = require('../../models/modelCall');
const GatewayEvent = require('../../models/gatewayEvent');
const UsageCounter = require('../../models/usageCounter');
const settings = require('../../services/settingsService');
const { complete } = require('../../ai/groqClient');
const { chatModel } = require('../../ai/conversation');
const { callJson } = require('../../ai/modelGateway');
const { runWithAi } = require('../../ai/aiContext');
const { resetStudentQuota } = require('../../ai/usageGuard');
const { searchVideos } = require('../../services/youtubeService');
const { dayKey } = require('../../ai/modelCallLog');
const { MODELS } = require('../../config/ai');
const { useTestDatabase } = require('../helpers/db');
const { ALICE, bearer } = require('../helpers/auth');

useTestDatabase();
const app = createApp();

afterEach(() => {
  mockCreate.mockReset();
  jest.restoreAllMocks();
  settings._reset();
});

const reply = (content, { model = MODELS.FAST, tokensIn = 100, tokensOut = 20 } = {}) => ({
  model,
  choices: [{ message: { role: 'assistant', content } }],
  usage: { prompt_tokens: tokensIn, completion_tokens: tokensOut, total_tokens: tokensIn + tokensOut },
});
const apiError = (status, message) => Object.assign(new Error(`${status} ${message}`), { status });
const DAILY = () => apiError(429, 'Rate limit reached for model on tokens per day (TPD): Limit 200000. Please try again in 38m12s.');
const system = { email: 'root@example.com', role: 'superadmin' };
const makeNote = (extractedText = 'Photosynthesis makes glucose from light.') => Notes.create({
  userId: ALICE.email, title: 'Bio', fileName: 'bio.pdf', filePath: 'notes/bio.pdf', extractedText,
});

describe('model-call logging for existing features', () => {
  it('logs the notes summary with its feature, student, tokens and cost', async () => {
    const note = await makeNote('Photosynthesis makes glucose from light.');
    mockCreate.mockResolvedValue(reply('## Summary\nPlants make glucose.', { model: MODELS.FAST, tokensIn: 1000, tokensOut: 200 }));

    const res = await request(app).post('/summarize-notes').set('Authorization', bearer()).send({ noteId: String(note._id) });
    expect(res.status).toBe(200);

    const calls = await ModelCall.find().lean();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      feature: 'notes.summary', area: 'notes', userId: ALICE.email, provider: 'groq', model: MODELS.FAST,
      tokensIn: 1000, tokensOut: 200, outcome: 'ok',
    });
    expect(calls[0].usd).toBeCloseTo((1000 * 0.075 + 200 * 0.3) / 1e6, 10);
    const spend = await UsageCounter.findOne({ key: `spend:${dayKey()}` }).lean();
    expect(spend.value).toBeCloseTo(calls[0].usd, 10);
  });

  it('sends the same request as before while settings are at their defaults', async () => {
    mockCreate.mockResolvedValue(reply('ok'));
    await complete({ messages: [{ role: 'user', content: 'hi' }], model: MODELS.REASONING, temperature: 0.7, maxTokens: 900 });
    expect(mockCreate.mock.calls[0][0]).toEqual({
      messages: [{ role: 'user', content: 'hi' }], model: MODELS.REASONING, reasoning_effort: 'low', temperature: 0.7, max_tokens: 900,
    });
  });

  it('uses the admin\'s tier models and parameters', async () => {
    await settings.set('ai.tiers', { FAST: 'llama-3.1-8b-instant' }, { actor: system });
    await settings.set('ai.params', { reasoningEffort: 'medium', maxTokensScale: 0.5 }, { actor: system });
    mockCreate.mockResolvedValue(reply('ok'));
    await complete({ messages: [{ role: 'user', content: 'hi' }], maxTokens: 1000 });
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ model: 'llama-3.1-8b-instant', reasoning_effort: 'medium', max_tokens: 500 });
  });
});

describe('fail-over and retries', () => {
  it('moves to the next model when the daily quota is used up', async () => {
    mockCreate.mockRejectedValueOnce(DAILY()).mockResolvedValueOnce(reply('from 20b'));
    const text = await runWithAi({ feature: 'roadmap.generate' }, () => complete({ messages: [], model: MODELS.REASONING }));
    expect(text).toBe('from 20b');
    expect(mockCreate.mock.calls.map((c) => c[0].model)).toEqual([MODELS.REASONING, MODELS.FAST]);
    const outcomes = (await ModelCall.find().sort({ createdAt: 1 }).lean()).map((c) => [c.model, c.outcome]);
    expect(outcomes).toEqual([[MODELS.REASONING, '429_daily'], [MODELS.FAST, 'ok']]);
  });

  it('keeps waiting out the per-minute limit on the same model, as before', async () => {
    mockCreate.mockRejectedValueOnce(apiError(429, 'Rate limit reached on tokens per minute (TPM). Please try again in 0.1s.'))
      .mockResolvedValueOnce(reply('after the wait'));
    const text = await complete({ messages: [], model: MODELS.REASONING });
    expect(text).toBe('after the wait');
    expect(mockCreate.mock.calls.map((c) => c[0].model)).toEqual([MODELS.REASONING, MODELS.REASONING]);
    expect((await ModelCall.find().lean()).map((c) => c.outcome).sort()).toEqual(['429', 'ok']);
  }, 10000);

  it('ends with one clean error when every model is out of quota', async () => {
    mockCreate.mockRejectedValue(DAILY());
    await expect(complete({ messages: [], model: MODELS.FAST })).rejects.toMatchObject({ status: 502, code: 'AI_UNAVAILABLE' });
  });

  it('backs off and retries a 5xx (JSON tasks)', async () => {
    mockCreate.mockRejectedValueOnce(apiError(503, 'Service unavailable')).mockRejectedValueOnce(apiError(500, 'oops'))
      .mockResolvedValueOnce(reply('{"intent":"bug"}'));
    const out = await callJson({ task: 'report_enrich', system: 's', user: 'u' });
    expect(out.data).toEqual({ intent: 'bug' });
    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(mockCreate.mock.calls[0][1]).toEqual({ maxRetries: 0 });
    expect(out.attempts).toBe(3);
  });

  it('repairs invalid JSON once, and logs the bad reply', async () => {
    mockCreate.mockResolvedValueOnce(reply('Sure! Here it is: intent is bug')).mockResolvedValueOnce(reply('```json\n{"intent":"bug"}\n```'));
    const out = await callJson({ task: 'report_enrich', system: 's', user: 'u' });
    expect(out.data).toEqual({ intent: 'bug' });
    expect(mockCreate.mock.calls[1][0].messages[1].content).toMatch(/not valid JSON/);
    expect((await ModelCall.find().sort({ createdAt: 1 }).lean()).map((c) => c.outcome)).toEqual(['invalid_json', 'ok']);
  });

  it('logs JSON calls against the caller\'s run and waits out the per-minute limit', async () => {
    mockCreate.mockRejectedValueOnce(apiError(429, 'Rate limit reached on tokens per minute (TPM). Please try again in 0.1s.'))
      .mockResolvedValueOnce(reply('{"finding":"ok"}'));
    const out = await runWithAi({ feature: 'risk.investigation', runId: 'run_abc', stepSeq: 4 }, () => callJson({ task: 'risk_lane', system: 's', user: 'u' }));
    expect(out.data).toEqual({ finding: 'ok' });
    expect(mockCreate.mock.calls.map((c) => c[0].model)).toEqual([MODELS.FAST, MODELS.FAST]);
    const rows = await ModelCall.find().sort({ createdAt: 1 }).lean();
    expect(rows.map((r) => [r.outcome, r.runId, r.stepSeq, r.task])).toEqual([['429', 'run_abc', 4, 'risk_lane'], ['ok', 'run_abc', 4, 'risk_lane']]);
  }, 10000);

  it('routes the verifier away from the model that wrote the analysis', async () => {
    mockCreate.mockResolvedValue(reply('{"verdict":"accept"}'));
    await callJson({ task: 'risk_verifier', system: 's', user: 'u', avoid: MODELS.FAST });
    expect(mockCreate.mock.calls[0][0].model).not.toBe(MODELS.FAST);
  });
});

describe('LangChain chat models (chats, agent, forum)', () => {
  it('fail over on a daily quota and log tokens from the response', async () => {
    const spy = jest.spyOn(ChatGroq.prototype, 'completionWithRetry').mockImplementation(async (req) => {
      if (req.model === MODELS.REASONING) throw DAILY();
      return reply('hello from the fallback', { model: req.model, tokensIn: 40, tokensOut: 7 });
    });
    const res = await runWithAi({ feature: 'doubts.chat', userId: ALICE.email }, () => chatModel({ tier: 'REASONING' }).invoke('hi'));
    expect(res.content).toBe('hello from the fallback');
    expect(spy.mock.calls.map((c) => c[0].model)).toEqual([MODELS.REASONING, MODELS.FAST]);
    const rows = (await ModelCall.find().sort({ createdAt: 1 }).lean()).map((c) => ({ model: c.model, outcome: c.outcome, feature: c.feature, tokensIn: c.tokensIn }));
    expect(rows).toEqual([
      { model: MODELS.REASONING, outcome: '429_daily', feature: 'doubts.chat', tokensIn: 0 },
      { model: MODELS.FAST, outcome: 'ok', feature: 'doubts.chat', tokensIn: 40 },
    ]);
  });
});

describe('admin switches and limits', () => {
  it('a switched-off tool returns the friendly message, never a raw error, and calls no model', async () => {
    await settings.set('features.notes', { enabled: false, message: 'Notes chat is being upgraded. Back at 5pm.' }, { actor: system });
    const note = await makeNote('x');
    const res = await request(app).post('/chat-with-notes').set('Authorization', bearer()).send({ noteId: String(note._id), message: 'hi' });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'Notes chat is being upgraded. Back at 5pm.', code: 'FEATURE_UNAVAILABLE' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('a switched-off provider stops calls with a friendly 503', async () => {
    await settings.set('ai.providers', { groq: false }, { actor: system });
    await expect(complete({ messages: [] })).rejects.toMatchObject({ status: 503, code: 'AI_PROVIDER_OFF' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('at the daily USD cap, non-essential features degrade cleanly and essential ones keep working', async () => {
    await settings.set('ai.limits', { globalDailyUsdCap: 0.01 }, { actor: system });
    await UsageCounter.create({ key: `spend:${dayKey()}`, value: 0.02, expiresAt: new Date(Date.now() + 86400000) });
    mockCreate.mockResolvedValue(reply('## Summary'));

    // Video library keywords are non-essential: the request still succeeds, on its built-in keywords.
    const library = await request(app).post('/recommend-educational-videos').set('Authorization', bearer())
      .send({ title: 'React hooks', description: 'Learn useEffect', platform: 'youtube' });
    expect(library.status).toBe(200);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(await ModelCall.countDocuments()).toBe(0);

    // Summaries are essential.
    const note = await makeNote('Plants.');
    expect((await request(app).post('/summarize-notes').set('Authorization', bearer()).send({ noteId: String(note._id) })).status).toBe(200);
  });

  it('enforces the per-student daily AI quota, and an admin can reset it', async () => {
    await settings.set('ai.limits', { perStudentDaily: 2 }, { actor: system });
    const note = await makeNote('Plants.');
    mockCreate.mockResolvedValue(reply('## Summary'));
    const summarize = () => request(app).post('/summarize-notes').set('Authorization', bearer()).send({ noteId: String(note._id) });

    expect((await summarize()).status).toBe(200);
    expect((await summarize()).status).toBe(200);
    const third = await summarize();
    expect(third.status).toBe(429);
    expect(third.body.code).toBe('AI_QUOTA_REACHED');
    expect(third.body.error).toMatch(/today's 2 AI requests/);

    await resetStudentQuota(ALICE.email);
    expect((await summarize()).status).toBe(200);
    expect((await summarize()).status).toBe(200);
    expect((await summarize()).status).toBe(429);

    // The console's reset: audited, and the student can continue.
    const User = require('../../models/user');
    const AdminAuditLog = require('../../models/adminAuditLog');
    const { adminBearer } = require('../helpers/auth');
    const alice = await User.create({ email: ALICE.email, name: ALICE.name });
    const admin = await adminBearer();
    const reset = await request(app).post(`/api/admin/users/${alice._id}/reset-quota`).set('Authorization', admin);
    expect(reset.body.user.aiRequestsToday).toBe(0);
    expect(await AdminAuditLog.findOne({ action: 'user.quota.reset' }).lean()).toMatchObject({ before: { requestsToday: 3 } });
    expect((await summarize()).status).toBe(200);
  });

  it('maintenance mode closes the student app but not sign-in, status or the console', async () => {
    await settings.set('maintenance.global', { enabled: true, message: 'Upgrading the database, back in 10 minutes.' }, { actor: system });
    const res = await request(app).get(`/notes/${ALICE.email}`).set('Authorization', bearer());
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'Upgrading the database, back in 10 minutes.', code: 'MAINTENANCE' });
    expect((await request(app).get('/api/app-status')).body.maintenance.enabled).toBe(true);
    expect((await request(app).get('/api/auth/me').set('Authorization', bearer())).status).not.toBe(503);
  });
});

describe('gateway events', () => {
  it('YouTube switched off: a friendly 503 and a "disabled" event', async () => {
    await settings.set('gateways.youtube', { enabled: false }, { actor: system });
    await expect(searchVideos('react')).rejects.toMatchObject({ status: 503, code: 'YOUTUBE_DISABLED' });
    await new Promise((r) => { setTimeout(r, 20); });
    expect(await GatewayEvent.findOne({ gateway: 'youtube', outcome: 'disabled' })).toBeTruthy();
  });

  it('records searches with their outcome and the area of the request', async () => {
    const res = await request(app).post('/recommend-educational-videos').set('Authorization', bearer())
      .send({ title: 'React hooks', description: 'Learn useEffect', platform: 'youtube' });
    expect(res.status).toBe(200);
    await new Promise((r) => { setTimeout(r, 20); });
    const events = await GatewayEvent.find({ gateway: 'youtube', operation: 'search' }).lean();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toMatchObject({ outcome: 'ok', area: 'video-library' });
  });

  it('records Google sign-in checks', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 400 }));
    await request(app).post('/api/auth/google').send({ accessToken: 'bad' });
    await new Promise((r) => { setTimeout(r, 20); });
    expect(await GatewayEvent.findOne({ gateway: 'oauth', operation: 'tokeninfo', outcome: 'fail' })).toBeTruthy();
  });
});
