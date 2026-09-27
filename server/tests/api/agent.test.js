const request = require('supertest');

jest.mock('../../agent/novardAgent', () => ({
  runTurn: jest.fn(),
  titleFor: jest.fn(async () => 'Docker Basics'),
}));

const { runTurn } = require('../../agent/novardAgent');
const { createApp } = require('../../app');
const ChatbotConversation = require('../../models/chatbotConversation');
const DoubtClearance = require('../../models/doubtClearance');
const { useTestDatabase } = require('../helpers/db');
const { ALICE, BOB, bearer } = require('../helpers/auth');

useTestDatabase();
const app = createApp();
afterEach(() => jest.clearAllMocks());

/** Parse an SSE body into [{event, data}]. */
const events = (text) => text.trim().split('\n\n').map((block) => {
  const event = /^event: (.+)$/m.exec(block)[1];
  const data = JSON.parse(/^data: (.+)$/m.exec(block)[1]);
  return { event, data };
});

const seedConversation = (userId = ALICE.email, action = {}) => ChatbotConversation.create({
  userId,
  title: 'Chat',
  messages: [
    { role: 'user', content: 'What is useEffect?' },
    {
      role: 'assistant',
      content: 'useEffect runs after render.',
      actions: [{
        id: 'abc123abc123', type: 'create_doubt', status: 'proposed', origin: 'suggested',
        args: { title: 'When useEffect Runs', description: 'When does useEffect run?' }, ...action,
      }],
    },
  ],
});

describe('Novard Agent chat', () => {
  it('streams a turn as server-sent events and titles a new chat', async () => {
    runTurn.mockImplementation(async ({ emit }) => {
      emit('token', { text: 'Hello' });
      return { role: 'assistant', content: 'Hello' };
    });
    const res = await request(app).post('/api/agent/chat').set('Authorization', bearer()).send({ message: 'Hi there' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    const stream = events(res.text);
    expect(stream.map((e) => e.event)).toEqual(['meta', 'token', 'title', 'done']);
    expect(stream[0].data.isNew).toBe(true);
    expect(runTurn.mock.calls[0][0]).toMatchObject({ userId: ALICE.email, userName: ALICE.name, input: 'Hi there' });
    expect((await ChatbotConversation.findById(stream[0].data.conversationId)).title).toBe('Docker Basics');
  });

  it('turns a failed turn into an error event with a safe message', async () => {
    runTurn.mockRejectedValue(Object.assign(new Error('429 {"error":"rate limit"}'), { status: 429 }));
    const res = await request(app).post('/api/agent/chat').set('Authorization', bearer()).send({ message: 'Hi' });
    const last = events(res.text).pop();
    expect(last).toEqual({ event: 'error', data: { error: expect.stringMatching(/busy/) } });
  });

  it('validates the message before streaming', async () => {
    expect((await request(app).post('/api/agent/chat').set('Authorization', bearer()).send({ message: '' })).status).toBe(400);
    expect((await request(app).post('/api/agent/chat').set('Authorization', bearer()).send({ message: 'x'.repeat(6001) })).status).toBe(400);
  });

  it('never continues another student’s conversation', async () => {
    const theirs = await seedConversation(BOB.email);
    runTurn.mockResolvedValue({ role: 'assistant', content: 'ok' });
    const res = await request(app).post('/api/agent/chat').set('Authorization', bearer()).send({ message: 'Hi', conversationId: String(theirs._id) });
    const meta = events(res.text)[0].data;
    expect(meta.conversationId).not.toBe(String(theirs._id));
    expect(meta.isNew).toBe(true);
  });
});

describe('Novard Agent history and action cards', () => {
  it('lists, opens, renames and deletes the student’s chats only', async () => {
    const mine = await seedConversation(ALICE.email);
    await seedConversation(BOB.email);

    const list = await request(app).get(`/api/agent/conversations/user/${ALICE.email}`).set('Authorization', bearer());
    expect(list.body).toEqual([expect.objectContaining({ title: 'Chat', messageCount: 2 })]);

    const one = await request(app).get(`/api/agent/conversations/${mine._id}`).set('Authorization', bearer());
    expect(one.body.messages).toHaveLength(2);
    expect((await request(app).get(`/api/agent/conversations/${mine._id}`).set('Authorization', bearer(BOB))).status).toBe(404);

    const renamed = await request(app).patch(`/api/agent/conversations/${mine._id}`).set('Authorization', bearer()).send({ title: '  New   name ' });
    expect(renamed.body).toEqual({ title: 'New name' });

    expect((await request(app).delete(`/api/agent/conversations/${mine._id}`).set('Authorization', bearer(BOB))).status).toBe(404);
    expect((await request(app).delete(`/api/agent/conversations/${mine._id}`).set('Authorization', bearer())).status).toBe(200);
    expect(await ChatbotConversation.countDocuments({ userId: ALICE.email })).toBe(0);
  });

  it('confirms a suggested doubt exactly once, carrying the explanation over', async () => {
    const convo = await seedConversation();
    const url = `/api/agent/conversations/${convo._id}/actions/abc123abc123`;

    const res = await request(app).post(url).set('Authorization', bearer()).send({ decision: 'confirm' });
    expect(res.status).toBe(200);
    expect(res.body.action).toMatchObject({ status: 'done', result: { label: 'Open doubt' } });

    const doubt = await DoubtClearance.findOne({ userId: ALICE.email });
    expect(doubt.title).toBe('When useEffect Runs');
    expect(doubt.chatHistory.map((m) => m.role)).toEqual(['user', 'assistant']);

    const again = await request(app).post(url).set('Authorization', bearer()).send({ decision: 'confirm' });
    expect(again.status).toBe(409);
    expect(await DoubtClearance.countDocuments()).toBe(1);
  });

  it('dismisses a card, and rejects bad decisions and other students', async () => {
    const convo = await seedConversation();
    const url = `/api/agent/conversations/${convo._id}/actions/abc123abc123`;
    expect((await request(app).post(url).set('Authorization', bearer()).send({ decision: 'maybe' })).status).toBe(400);
    expect((await request(app).post(url).set('Authorization', bearer(BOB)).send({ decision: 'dismiss' })).status).toBe(404);
    const res = await request(app).post(url).set('Authorization', bearer()).send({ decision: 'dismiss' });
    expect(res.body.action.status).toBe('dismissed');
  });

  it('returns the failed card next to the error when an action cannot run', async () => {
    const convo = await seedConversation(ALICE.email, { args: { title: 'T', description: '' } });
    const res = await request(app).post(`/api/agent/conversations/${convo._id}/actions/abc123abc123`).set('Authorization', bearer()).send({ decision: 'confirm' });
    expect(res.status).toBe(400);
    expect(res.body.action).toMatchObject({ status: 'failed' });
    expect(res.body.error).toBeTruthy();
  });
});
