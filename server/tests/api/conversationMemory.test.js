// Replies for successive model calls (summaries first when a summary is needed).
const mockReplies = [];
jest.mock('@langchain/groq', () => ({
  ChatGroq: class {
    constructor() {
      const { FakeListChatModel } = jest.requireActual('@langchain/core/utils/testing');
      return new FakeListChatModel({ responses: mockReplies.length ? [...mockReplies] : ['ok'] });
    }
  },
}));

const { converse, MongoChatHistory, MEMORY } = require('../../ai/conversation');
const SkillGapSession = require('../../models/skillGapSession');
const { useTestDatabase } = require('../helpers/db');

useTestDatabase();
afterEach(() => { mockReplies.length = 0; });

const session = (messages = []) => SkillGapSession.create({
  userId: 'alice@example.com', profile: { targetRole: 'SRE' }, messages,
});

describe('conversation memory', () => {
  it('answers with the history and stores both messages in order', async () => {
    const doc = await session([{ role: 'assistant', content: 'Hi, I am your coach.' }]);
    mockReplies.push('Learn Kubernetes next.');

    const text = await converse({
      Model: SkillGapSession, filter: { _id: doc._id, userId: 'alice@example.com' }, field: 'messages', timeKey: 'createdAt',
      system: 'You are a coach.', input: 'What next?',
    });

    expect(text).toBe('Learn Kubernetes next.');
    const saved = await SkillGapSession.findById(doc._id).lean();
    expect(saved.messages.map((m) => [m.role, m.content])).toEqual([
      ['assistant', 'Hi, I am your coach.'], ['user', 'What next?'], ['assistant', 'Learn Kubernetes next.'],
    ]);
    expect(saved.messages[1].createdAt < saved.messages[2].createdAt).toBe(true);
  });

  it('refuses to write to a conversation the filter does not match', async () => {
    const doc = await session();
    await expect(converse({
      Model: SkillGapSession, filter: { _id: doc._id, userId: 'mallory@example.com' }, field: 'messages', timeKey: 'createdAt',
      system: 's', input: 'hi',
    })).rejects.toMatchObject({ status: 404 });
  });

  it('folds old turns into a running summary once the chat is long', async () => {
    const big = 'x'.repeat(MEMORY.summarizeAt * 4 / 20);
    const doc = await session(Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `${i} ${big}` })));
    mockReplies.push('- asked about SRE basics');

    const history = new MongoChatHistory({ Model: SkillGapSession, filter: { _id: doc._id }, field: 'messages', timeKey: 'createdAt' });
    const view = await history.getMessages();

    expect(view[0]._getType()).toBe('system');
    expect(view[0].content).toMatch(/asked about SRE basics/);
    expect(view.length).toBeLessThan(40);
    const saved = await SkillGapSession.findById(doc._id).lean();
    expect(saved.memory.summary).toBe('- asked about SRE basics');
    expect(saved.memory.summarizedCount).toBe(40 - (view.length - 1));
  });
});
