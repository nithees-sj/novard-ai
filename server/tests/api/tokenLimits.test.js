// The Groq SDK is replaced, so the real model-call logging and token counting run end to end.
const mockCreate = jest.fn();
jest.mock('groq-sdk', () => {
  const Groq = jest.fn().mockImplementation(() => ({ chat: { completions: { create: mockCreate } } }));
  Groq.default = Groq;
  return Groq;
});

const request = require('supertest');
const { createApp } = require('../../app');
const Notes = require('../../models/notes');
const Notification = require('../../models/notification');
const User = require('../../models/user');
const settings = require('../../services/settingsService');
const { periodWindow } = require('../../ai/tokenLimits');
const { MODELS } = require('../../config/ai');
const { useTestDatabase } = require('../helpers/db');
const { ALICE, BOB, bearer, adminBearer } = require('../helpers/auth');

useTestDatabase();
const app = createApp();

afterEach(() => {
  mockCreate.mockReset();
  settings._reset();
});

const reply = (content, { tokensIn = 400, tokensOut = 200 } = {}) => ({
  model: MODELS.FAST,
  choices: [{ message: { role: 'assistant', content } }],
  usage: { prompt_tokens: tokensIn, completion_tokens: tokensOut, total_tokens: tokensIn + tokensOut },
});
const makeNote = (userId = ALICE.email) => Notes.create({ userId, title: 'Bio', fileName: 'bio.pdf', filePath: 'notes/bio.pdf', extractedText: 'Photosynthesis makes glucose from light.' });
const summarize = (note, user = ALICE) => request(app).post('/summarize-notes').set('Authorization', bearer(user)).send({ noteId: note._id });
const setLimits = async (value) => request(app).put('/api/admin/settings/ai.tokenLimits').set('Authorization', await adminBearer()).send({ value });

describe('per-student AI token limits', () => {
  it('are off by default: nothing is refused, and use is still counted', async () => {
    mockCreate.mockResolvedValue(reply('### Summary'));
    const note = await makeNote();
    for (let i = 0; i < 3; i += 1) expect((await summarize(note)).status).toBe(200); // eslint-disable-line no-await-in-loop
    const usage = await request(app).get('/api/ai-usage').set('Authorization', bearer());
    expect(usage.body.period).toBe('day');
    expect(usage.body.tools).toEqual([{ tool: 'notes', label: 'Notes & PDF chat', used: 1800, limit: 0, reached: false }]);
  });

  it('an admin sets a limit per tool; at the limit the student is told why, and other tools keep working', async () => {
    const saved = await setLimits({ perStudent: { notes: 1000 } });
    expect(saved.status).toBe(200);
    mockCreate.mockResolvedValue(reply('### Summary'));
    const note = await makeNote();

    expect((await summarize(note)).status).toBe(200); // 600 tokens
    expect((await summarize(note)).status).toBe(200); // 1,200: this request crosses the limit and still finishes
    const refused = await summarize(note);
    expect(refused.status).toBe(429);
    expect(refused.body.code).toBe('AI_TOKEN_LIMIT');
    expect(refused.body.error).toMatch(/daily allowance of 1,000 AI tokens for Notes & PDF chat\. It resets at midnight \(UTC\)/);
    expect(mockCreate).toHaveBeenCalledTimes(2); // refused before any model call

    // Told once, in the bell.
    const bell = await Notification.find({ userId: ALICE.email }).lean();
    expect(bell).toHaveLength(1);
    expect(bell[0]).toMatchObject({ kind: 'ai_limit', title: 'AI limit reached: Notes & PDF chat' });

    // The dashboard can show it.
    const usage = await request(app).get('/api/ai-usage').set('Authorization', bearer());
    expect(usage.body.tools[0]).toMatchObject({ tool: 'notes', used: 1200, limit: 1000, reached: true });
    expect(usage.body.tools[0].message).toMatch(/1,000 AI tokens/);

    // Another student, and another tool, are not affected.
    expect((await summarize(await makeNote(BOB.email), BOB)).status).toBe(200);
    const doubt = await request(app).post('/doubt-clearances').set('Authorization', bearer())
      .send({ title: 'Recursion', description: 'Why does my recursion never stop?' });
    expect(doubt.status).toBe(201);
  });

  it('the admin sees a student\'s use per tool, and the quota reset gives the tokens back', async () => {
    await setLimits({ perStudent: { notes: 500 } });
    mockCreate.mockResolvedValue(reply('### Summary'));
    const note = await makeNote();
    await summarize(note);
    expect((await summarize(note)).status).toBe(429);

    const alice = await User.create({ email: ALICE.email, name: ALICE.name });
    const admin = await adminBearer();
    const detail = await request(app).get(`/api/admin/users/${alice._id}`).set('Authorization', admin);
    expect(detail.body.ai.tokens.tools).toEqual([expect.objectContaining({ tool: 'notes', used: 600, limit: 500, reached: true })]);

    await request(app).post(`/api/admin/users/${alice._id}/reset-quota`).set('Authorization', admin);
    expect((await summarize(note)).status).toBe(200);
  });

  it('validates the setting: whole numbers only, and problem reports are never limited', async () => {
    expect((await setLimits({ perStudent: { notes: -5 } })).status).toBe(400);
    expect((await setLimits({ perStudent: { reports: 100 } })).status).toBe(400);
    expect((await setLimits({ period: 'year' })).status).toBe(400);
    expect((await setLimits({ period: 'week', perStudent: { doubts: 50000 } })).status).toBe(200);
  });
});

describe('limit periods (UTC)', () => {
  const at = new Date('2026-10-02T15:30:00Z'); // a Friday
  it('a day resets at midnight, a week on Monday, a month on the 1st', () => {
    expect(periodWindow('day', at).resetsAt.toISOString()).toBe('2026-10-03T00:00:00.000Z');
    expect(periodWindow('week', at)).toEqual({ id: 'w2026-09-28', resetsAt: new Date('2026-10-05T00:00:00Z') });
    expect(periodWindow('month', at)).toEqual({ id: 'm2026-10', resetsAt: new Date('2026-11-01T00:00:00Z') });
  });
});
