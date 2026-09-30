const mockCreate = jest.fn();
jest.mock('groq-sdk', () => {
  const Groq = jest.fn().mockImplementation(() => ({ chat: { completions: { create: mockCreate } } }));
  Groq.default = Groq;
  return Groq;
});

const request = require('supertest');
const { createApp } = require('../../app');
const ChatbotConversation = require('../../models/chatbotConversation');
const Report = require('../../models/report');
const { ACTIONS, KIND_TO_TYPE, prepareArgs } = require('../../agent/actions');
const { useTestDatabase } = require('../helpers/db');
const { ALICE, bearer } = require('../helpers/auth');

useTestDatabase();
const app = createApp();

beforeEach(() => mockCreate.mockResolvedValue({
  choices: [{ message: { content: '{"area":"quizzes","urgency":"medium","sentiment":-0.5,"intent":"wrong_ai_answer","topic":"wrong quiz answer","isRepeat":false}' } }],
  usage: { prompt_tokens: 200, completion_tokens: 30 },
}));
afterEach(() => mockCreate.mockReset());

const draft = (args) => ChatbotConversation.create({
  userId: ALICE.email,
  title: 'Chat',
  messages: [
    { role: 'user', content: 'The quiz on photosynthesis marked my right answer as wrong. Can you report it?' },
    { role: 'assistant', content: 'Here is your draft.', actions: [{ id: 'aaa111bbb222', type: 'report_problem', status: 'draft', origin: 'requested', args }] },
  ],
});

describe('the Novard Agent\'s report_problem action', () => {
  it('is a draft the student reviews, never a suggestion', () => {
    expect(ACTIONS.report_problem.prepareTool.function.name).toBe('prepare_report_problem');
    expect(Object.values(KIND_TO_TYPE)).not.toContain('report_problem');
    const out = prepareArgs(ACTIONS.report_problem, { area: 'Quizzes', description: 'The quiz marked my right answer as wrong.' }, { stated: ['area', 'description'] });
    expect(out.missing).toEqual([]);
    expect(out.args).toEqual({ area: 'quizzes', description: 'The quiz marked my right answer as wrong.' });
    expect(prepareArgs(ACTIONS.report_problem, { description: 'The page is broken.' }, { stated: ['description'] }).missing.map((m) => m.key)).toEqual(['area']);
  });

  it('pressing Create files a real report through the same service as the form', async () => {
    const convo = await draft({ area: 'quizzes', description: 'The photosynthesis quiz marked my correct answer as wrong.' });
    const res = await request(app).post(`/api/agent/conversations/${convo._id}/actions/aaa111bbb222`).set('Authorization', bearer()).send({ decision: 'create' });
    expect(res.status).toBe(200);
    expect(res.body.action).toMatchObject({ status: 'done', result: { route: expect.stringMatching(/^\/reports\/NV-/), label: 'Open report' } });

    const report = await Report.findOne({ userId: ALICE.email }).lean();
    expect(report).toMatchObject({ area: 'quizzes', text: 'The photosynthesis quiz marked my correct answer as wrong.', source: { tool: 'agent' } });
    expect(report.enrichment.intent).toBe('wrong_ai_answer');
  });

  it('shows the quota message on the card when the student already has open reports there', async () => {
    await Report.create([0, 1].map((slot) => ({ ref: `NV-0000000${slot}`, userId: ALICE.email, area: 'quizzes', text: 'earlier report text', quotaSlot: slot })));
    const convo = await draft({ area: 'quizzes', description: 'Yet another wrong quiz answer here.' });
    const res = await request(app).post(`/api/agent/conversations/${convo._id}/actions/aaa111bbb222`).set('Authorization', bearer()).send({ decision: 'create' });
    expect(res.body.action.status).toBe('failed');
    expect(res.body.error).toMatch(/already have 2 open reports about Quizzes/);
    expect(await Report.countDocuments()).toBe(2);
  });
});
