const request = require('supertest');

jest.mock('../../ai/groqClient', () => ({ complete: jest.fn() }));
jest.mock('../../ai/conversation', () => ({ ...jest.requireActual('../../ai/conversation'), converse: jest.fn() }));
jest.mock('../../services/doubtTitle', () => ({ contextualTitle: jest.fn(async () => 'How useEffect Dependencies Work') }));
jest.mock('youtube-search-api', () => ({ GetListByKeyword: jest.fn() }));

const youtubeSearch = require('youtube-search-api');
const { complete } = require('../../ai/groqClient');
const { converse } = require('../../ai/conversation');
const { createApp } = require('../../app');
const DoubtClearance = require('../../models/doubtClearance');
const { useTestDatabase } = require('../helpers/db');
const { ALICE, BOB, bearer } = require('../helpers/auth');
const { quizJson } = require('../helpers/fixtures');

useTestDatabase();
const app = createApp();
afterEach(() => {
  jest.clearAllMocks();
  complete.mockReset(); // also drops queued mockResolvedValueOnce values
});

const createDoubt = (user = ALICE, body = { description: 'Why does my useEffect run twice?' }) => request(app)
  .post('/doubt-clearances').set('Authorization', bearer(user)).send({ ...body, userId: user.email });

/** A doubt with `n` chat messages already exchanged. */
async function doubtWithChat(n = 4) {
  const { body } = await createDoubt();
  const chatHistory = Array.from({ length: n }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `message ${i}` }));
  await DoubtClearance.updateOne({ _id: body._id }, { $set: { chatHistory } });
  return body;
}

describe('Doubt Clearance workflow', () => {
  it('creates a doubt with an AI-written title', async () => {
    const res = await createDoubt();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'How useEffect Dependencies Work', description: 'Why does my useEffect run twice?', userId: ALICE.email });
  });

  it('validates the description and image link', async () => {
    expect((await createDoubt(ALICE, { description: '' })).status).toBe(400);
    expect((await createDoubt(ALICE, { description: 'x'.repeat(2001) })).body.error).toBe('The description must be 2000 characters or fewer.');
    expect((await createDoubt(ALICE, { description: 'ok?', imageUrl: 'javascript:alert(1)' })).status).toBe(400);
  });

  it('lists only the student’s own doubts', async () => {
    await createDoubt(ALICE);
    await createDoubt(BOB);
    const res = await request(app).get(`/doubt-clearances/${ALICE.email}`).set('Authorization', bearer());
    expect(res.body).toHaveLength(1);
    expect(res.body[0].userId).toBe(ALICE.email);
  });

  it('chats about a doubt with memory scoped to the owner', async () => {
    const { body: doubt } = await createDoubt();
    converse.mockResolvedValue('Because of StrictMode.');
    const res = await request(app).post('/chat-with-doubt-clearance').set('Authorization', bearer())
      .send({ doubtId: doubt._id, message: 'Why?', userId: ALICE.email });
    expect(res.body).toEqual({ response: 'Because of StrictMode.' });
    expect(converse.mock.calls[0][0].filter.userId).toBe(ALICE.email);
  });

  it('keeps every doubt action to its owner', async () => {
    const doubt = await doubtWithChat(4);
    const asBob = (path, body) => request(app).post(path).set('Authorization', bearer(BOB)).send({ doubtId: doubt._id, ...body });

    expect((await asBob('/chat-with-doubt-clearance', { message: 'hi' })).status).toBe(404);
    expect((await asBob('/summarize-doubt-clearance')).status).toBe(404);
    expect((await asBob('/generate-doubt-quiz')).status).toBe(404);
    expect((await asBob('/save-doubt-quiz-results', { quizIndex: 0, score: 1 })).status).toBe(404);
    expect((await asBob('/get-youtube-recommendations')).status).toBe(404);
    expect((await request(app).delete(`/doubt-clearances/${doubt._id}`).set('Authorization', bearer(BOB))).status).toBe(404);
    expect(await DoubtClearance.countDocuments()).toBe(1);
  });

  it('needs two exchanges before a quiz', async () => {
    const doubt = await doubtWithChat(2);
    const res = await request(app).post('/generate-doubt-quiz').set('Authorization', bearer()).send({ doubtId: doubt._id });
    expect(res.status).toBe(400);
  });

  it('generates a quiz and saves a bounded score', async () => {
    const doubt = await doubtWithChat(4);
    complete.mockResolvedValue(quizJson(5));
    const quiz = await request(app).post('/generate-doubt-quiz').set('Authorization', bearer()).send({ doubtId: doubt._id, questionCount: 5 });
    expect(quiz.status).toBe(200);
    expect(quiz.body.quizIndex).toBe(0);

    const tooHigh = await request(app).post('/save-doubt-quiz-results').set('Authorization', bearer()).send({ doubtId: doubt._id, quizIndex: 0, score: 6 });
    expect(tooHigh.status).toBe(400);
    const badIndex = await request(app).post('/save-doubt-quiz-results').set('Authorization', bearer()).send({ doubtId: doubt._id, quizIndex: 3, score: 1 });
    expect(badIndex.status).toBe(400);

    const ok = await request(app).post('/save-doubt-quiz-results').set('Authorization', bearer()).send({ doubtId: doubt._id, quizIndex: 0, score: 4 });
    expect(ok.status).toBe(200);
    const stored = (await DoubtClearance.findById(doubt._id)).quizzes[0];
    expect(stored.score).toBe(4);
    expect(stored.attemptedAt).toBeInstanceOf(Date);
  });

  it('summarises once and then serves the stored summary', async () => {
    const doubt = await doubtWithChat(2);
    complete.mockResolvedValue('### Summary');
    const first = await request(app).post('/summarize-doubt-clearance').set('Authorization', bearer()).send({ doubtId: doubt._id });
    const second = await request(app).post('/summarize-doubt-clearance').set('Authorization', bearer()).send({ doubtId: doubt._id });
    expect(first.body.summary).toBe('### Summary');
    expect(second.body.summary).toBe('### Summary');
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('recommends de-duplicated YouTube videos from the chat', async () => {
    const doubt = await doubtWithChat(4);
    complete.mockResolvedValue('["useEffect", "React StrictMode"]');
    youtubeSearch.GetListByKeyword.mockImplementation(async (q) => ({
      items: [{ type: 'video', id: 'aaaaaaaaaaa', title: 'Shared video' }, { type: 'video', id: `v${q.length}`.padEnd(11, 'x'), title: q }],
    }));

    const res = await request(app).post('/get-youtube-recommendations').set('Authorization', bearer()).send({ doubtId: doubt._id });
    expect(res.status).toBe(200);
    const urls = res.body.recommendations.map((v) => v.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.length).toBeLessThanOrEqual(6);
    expect((await DoubtClearance.findById(doubt._id)).youtubeRecommendations).toHaveLength(urls.length);
  });

  it('deletes the owner’s doubt', async () => {
    const { body: doubt } = await createDoubt();
    const res = await request(app).delete(`/doubt-clearances/${doubt._id}`).set('Authorization', bearer());
    expect(res.status).toBe(200);
    expect(await DoubtClearance.countDocuments()).toBe(0);
  });
});
