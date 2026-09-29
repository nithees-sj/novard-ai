const request = require('supertest');

jest.mock('../../agent/novardAgent', () => ({
  runTurn: jest.fn(),
  titleFor: jest.fn(async () => 'Docker Basics'),
}));

const { runTurn } = require('../../agent/novardAgent');
const { ACTIONS } = require('../../agent/actions');
const { createApp } = require('../../app');
const ChatbotConversation = require('../../models/chatbotConversation');
const DoubtClearance = require('../../models/doubtClearance');
const LearnerProfile = require('../../models/learnerProfile');
const Roadmap = require('../../models/roadmap');
const { useTestDatabase } = require('../helpers/db');
const { ALICE, BOB, bearer } = require('../helpers/auth');

useTestDatabase();
const app = createApp();
afterEach(() => jest.restoreAllMocks());

/** Parse an SSE body into [{event, data}]. */
const events = (text) => text.trim().split('\n\n').map((block) => {
  const event = /^event: (.+)$/m.exec(block)[1];
  const data = JSON.parse(/^data: (.+)$/m.exec(block)[1]);
  return { event, data };
});

const EXPLANATION = `useEffect runs after React paints the screen. ${'It re-runs whenever a dependency changes. '.repeat(10)}`;

/** A chat where the agent explained, offered a doubt, the student said yes, and a draft was prepared. */
const seedConversation = (userId = ALICE.email, draft = {}) => ChatbotConversation.create({
  userId,
  title: 'Chat',
  messages: [
    { role: 'user', content: 'What is useEffect?' },
    {
      role: 'assistant',
      content: EXPLANATION,
      actions: [{ id: 'fff000fff000', type: 'create_doubt', status: 'proposed', origin: 'suggested', args: { topic: 'When useEffect runs' } }],
    },
    { role: 'user', content: 'Yes, save it' },
    {
      role: 'assistant',
      content: 'Here is the draft.',
      actions: [{
        id: 'abc123abc123', type: 'create_doubt', status: 'draft', origin: 'requested',
        args: { title: 'When useEffect Runs', question: 'When exactly does useEffect run?', context: 'My effect fires twice on load.' },
        provenance: { title: 'auto', question: 'chat', context: 'chat' },
        ...draft,
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
    expect(list.body).toEqual([expect.objectContaining({ title: 'Chat', messageCount: 4 })]);

    const one = await request(app).get(`/api/agent/conversations/${mine._id}`).set('Authorization', bearer());
    expect(one.body.messages).toHaveLength(4);
    expect(one.body.messages[3].actions[0].meta).toMatchObject({ label: 'Create a doubt', fields: expect.any(Array) });
    expect((await request(app).get(`/api/agent/conversations/${mine._id}`).set('Authorization', bearer(BOB))).status).toBe(404);

    const renamed = await request(app).patch(`/api/agent/conversations/${mine._id}`).set('Authorization', bearer()).send({ title: '  New   name ' });
    expect(renamed.body).toEqual({ title: 'New name' });

    expect((await request(app).delete(`/api/agent/conversations/${mine._id}`).set('Authorization', bearer(BOB))).status).toBe(404);
    expect((await request(app).delete(`/api/agent/conversations/${mine._id}`).set('Authorization', bearer())).status).toBe(200);
    expect(await ChatbotConversation.countDocuments({ userId: ALICE.email })).toBe(0);
  });

  it('creates a draft exactly once, with the student\'s edits and the explanation carried over', async () => {
    const convo = await seedConversation();
    const url = `/api/agent/conversations/${convo._id}/actions/abc123abc123`;

    const res = await request(app).post(url).set('Authorization', bearer()).send({ decision: 'create', args: { title: 'useEffect Timing', level: 'beginner', ignored: 'x' } });
    expect(res.status).toBe(200);
    expect(res.body.action).toMatchObject({
      status: 'done',
      args: { title: 'useEffect Timing', level: 'beginner' },
      provenance: { title: 'edited', level: 'edited', question: 'chat' },
      result: { label: 'Open doubt' },
    });
    expect(res.body.action.args.ignored).toBeUndefined();

    const doubt = await DoubtClearance.findOne({ userId: ALICE.email });
    expect(doubt.title).toBe('useEffect Timing');
    expect(doubt.description).toMatch(/When exactly does useEffect run\?\n\nMy effect fires twice on load\.\n\n\(My level: beginner\)/);
    expect(doubt.chatHistory.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(doubt.chatHistory[1].content).toBe(EXPLANATION);

    const again = await request(app).post(url).set('Authorization', bearer()).send({ decision: 'create' });
    expect(again.status).toBe(409);
    expect(await DoubtClearance.countDocuments()).toBe(1);
  });

  it('rejects a bad edit and leaves the draft as it was', async () => {
    const convo = await seedConversation();
    const url = `/api/agent/conversations/${convo._id}/actions/abc123abc123`;
    const res = await request(app).post(url).set('Authorization', bearer()).send({ decision: 'create', args: { question: '' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Your question is required/);
    const saved = await ChatbotConversation.findById(convo._id).lean();
    expect(saved.messages[3].actions[0]).toMatchObject({ status: 'draft', args: { question: 'When exactly does useEffect run?' } });
    expect((await request(app).post(url).set('Authorization', bearer()).send({ decision: 'create', args: 'nope' })).status).toBe(400);
  });

  it('accepts an offer once, which continues in the chat without creating anything', async () => {
    const convo = await seedConversation();
    const url = `/api/agent/conversations/${convo._id}/actions/fff000fff000`;
    const res = await request(app).post(url).set('Authorization', bearer()).send({ decision: 'accept' });
    expect(res.body.action).toMatchObject({ status: 'accepted', meta: { followUp: expect.stringMatching(/useEffect/) } });
    expect((await request(app).post(url).set('Authorization', bearer()).send({ decision: 'accept' })).status).toBe(409);
    expect((await request(app).post(url).set('Authorization', bearer()).send({ decision: 'create' })).status).toBe(409);
    expect(await DoubtClearance.countDocuments()).toBe(0);
  });

  it('saves what the student stated to their profile only when they tick "remember"', async () => {
    const run = jest.spyOn(ACTIONS.generate_roadmap, 'run').mockResolvedValue({ itemId: 'r1', route: '/career?tool=roadmap&open=r1', label: 'Open roadmap' });
    const roadmapDraft = (id) => ({
      id, type: 'generate_roadmap',
      args: { role: 'DevOps Engineer', level: 'beginner', knownSkills: ['Linux'], hoursPerWeek: 10, timelineMonths: 6 },
      provenance: { role: 'chat', level: 'chat', knownSkills: 'chat', hoursPerWeek: 'assumed', timelineMonths: 'assumed' },
    });

    const first = await seedConversation(ALICE.email, roadmapDraft('abc123abc123'));
    await request(app).post(`/api/agent/conversations/${first._id}/actions/abc123abc123`).set('Authorization', bearer()).send({ decision: 'create' });
    expect(await LearnerProfile.countDocuments()).toBe(0);

    const second = await seedConversation(ALICE.email, roadmapDraft('abc123abc124'));
    const res = await request(app).post(`/api/agent/conversations/${second._id}/actions/abc123abc124`).set('Authorization', bearer())
      .send({ decision: 'create', remember: true, args: { timelineMonths: 3, knownSkills: ['Linux', 'Git'] } });
    expect(res.status).toBe(200);
    expect(run).toHaveBeenLastCalledWith(expect.objectContaining({ timelineMonths: 3, knownSkills: ['Linux', 'Git'] }), expect.anything());

    const profile = await LearnerProfile.findOne({ userId: ALICE.email }).lean();
    expect(profile).toMatchObject({ targetRole: 'DevOps Engineer', level: 'beginner', knownSkills: ['Linux', 'Git'], timelineMonths: 3 });
    expect(profile.hoursPerWeek).toBeUndefined(); // an assumed default is never saved as a fact
  });

  it('saves a "remember this?" card on Yes', async () => {
    const convo = await seedConversation(ALICE.email, { type: 'profile_update', status: 'proposed', origin: 'suggested', args: { hoursPerWeek: 12, knownSkills: ['SQL'] }, provenance: undefined });
    const url = `/api/agent/conversations/${convo._id}/actions/abc123abc123`;
    expect((await request(app).post(url).set('Authorization', bearer()).send({ decision: 'create' })).status).toBe(400);
    const res = await request(app).post(url).set('Authorization', bearer()).send({ decision: 'confirm' });
    expect(res.body.action).toMatchObject({ status: 'done', result: { note: 'Saved to your learner profile' } });
    expect(await LearnerProfile.findOne({ userId: ALICE.email }).lean()).toMatchObject({ hoursPerWeek: 12, knownSkills: ['SQL'] });
  });

  it('dismisses a card, and rejects bad decisions and other students', async () => {
    const convo = await seedConversation();
    const url = `/api/agent/conversations/${convo._id}/actions/abc123abc123`;
    expect((await request(app).post(url).set('Authorization', bearer()).send({ decision: 'maybe' })).status).toBe(400);
    expect((await request(app).post(url).set('Authorization', bearer()).send({ decision: 'confirm' })).status).toBe(400);
    expect((await request(app).post(url).set('Authorization', bearer(BOB)).send({ decision: 'dismiss' })).status).toBe(404);
    const res = await request(app).post(url).set('Authorization', bearer()).send({ decision: 'dismiss' });
    expect(res.body.action.status).toBe('dismissed');
    expect((await request(app).post(url).set('Authorization', bearer()).send({ decision: 'create' })).status).toBe(409);
  });

  it('returns the failed card next to the error when a draft cannot run, and lets it be retried', async () => {
    // A plan below the minimum length slipped into a stored draft: the service refuses it.
    const convo = await seedConversation(ALICE.email, {
      type: 'create_skill_plan', args: { skillName: 'SQL', level: 'beginner', description: 'Write reports', durationDays: 5 }, provenance: {},
    });
    const url = `/api/agent/conversations/${convo._id}/actions/abc123abc123`;
    const res = await request(app).post(url).set('Authorization', bearer()).send({ decision: 'create' });
    expect(res.status).toBe(400);
    expect(res.body.action).toMatchObject({ status: 'failed' });
    expect(res.body.error).toMatch(/at least 10 days/);

    const retry = await request(app).post(url).set('Authorization', bearer()).send({ decision: 'create', args: { durationDays: 3 } });
    expect(retry.status).toBe(400);
    expect(retry.body.error).toMatch(/between 10 and 60/);
  });
});

describe('Learner profile', () => {
  it('fills gaps from the student\'s latest roadmap until they save their own values', async () => {
    await Roadmap.create({ userId: ALICE.email, role: 'Data Engineer', inputs: { level: 'intermediate', hoursPerWeek: 8, knownSkills: ['Python', 'SQL'] } });
    const res = await request(app).get('/api/agent/profile').set('Authorization', bearer());
    expect(res.body).toMatchObject({
      saved: false,
      profile: { targetRole: 'Data Engineer', level: 'intermediate', hoursPerWeek: 8, knownSkills: ['Python', 'SQL'] },
      derivedKeys: expect.arrayContaining(['targetRole', 'level', 'hoursPerWeek', 'knownSkills']),
    });

    const saved = await request(app).put('/api/agent/profile').set('Authorization', bearer()).send({ level: 'beginner', knownSkills: 'Python, python, Excel', notes: '  Night owl  ' });
    expect(saved.body).toMatchObject({ saved: true, profile: { level: 'beginner', knownSkills: ['Python', 'Excel'], notes: 'Night owl', targetRole: 'Data Engineer' } });
    expect(saved.body.derivedKeys).not.toContain('level');

    const cleared = await request(app).put('/api/agent/profile').set('Authorization', bearer()).send({ notes: null });
    expect(cleared.body.profile.notes).toBeUndefined();

    const bob = await request(app).get('/api/agent/profile').set('Authorization', bearer(BOB));
    expect(bob.body).toMatchObject({ saved: false, profile: {} });
  });

  it('validates what the student saves', async () => {
    const put = (body) => request(app).put('/api/agent/profile').set('Authorization', bearer()).send(body);
    expect((await put({ level: 'guru' })).status).toBe(400);
    expect((await put({ hoursPerWeek: 500 })).status).toBe(400);
    expect((await put({ goal: { $gt: '' } })).status).toBe(400);
    expect((await put({ goal: 'x'.repeat(241) })).status).toBe(400);
    expect(await LearnerProfile.countDocuments()).toBe(0);
  });
});
