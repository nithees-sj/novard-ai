const { createFakeChatModel } = require('../helpers/fakeChatModel');

let mockModel = createFakeChatModel();
jest.mock('../../ai/conversation', () => ({
  ...jest.requireActual('../../ai/conversation'),
  chatModel: jest.fn(() => mockModel),
}));
jest.mock('../../services/youtubeService', () => ({
  ...jest.requireActual('../../services/youtubeService'),
  searchVideos: jest.fn(async () => [{ videoId: 'abcdefghijk', title: 'Docker volumes', channelName: 'TechWorld', duration: '10:00', url: 'https://www.youtube.com/watch?v=abcdefghijk' }]),
}));

const { runTurn } = require('../../agent/novardAgent');
const ChatbotConversation = require('../../models/chatbotConversation');
const DoubtClearance = require('../../models/doubtClearance');
const { useTestDatabase } = require('../helpers/db');
const { ALICE } = require('../helpers/auth');

useTestDatabase();

async function turn(input, script, { history = [], signal } = {}) {
  mockModel = createFakeChatModel(script);
  const convo = await ChatbotConversation.create({ userId: ALICE.email, messages: history });
  const events = [];
  const message = await runTurn({
    conversationId: convo._id, userId: ALICE.email, userName: 'Alice', input, emit: (event, data) => events.push({ event, data }), signal,
  });
  const saved = await ChatbotConversation.findById(convo._id).lean();
  const streamed = events.filter((e) => e.event === 'token').map((e) => e.data.text).join('');
  return { message, events, saved, streamed };
}

const DOUBT_ARGS = { title: 'Docker Volumes vs Bind Mounts', description: 'What is the difference between Docker volumes and bind mounts?' };
const LONG_ANSWER = `Docker volumes are managed by Docker. ${'They persist data beyond the container lifecycle. '.repeat(10)}`;

describe('Novard Agent turn', () => {
  it('answers a learning question and attaches a suggestion card that has not run', async () => {
    const { message, saved, streamed } = await turn('What is the difference between Docker volumes and bind mounts?', [
      { tools: [{ name: 'propose_create_doubt', args: DOUBT_ARGS }] },
      { text: LONG_ANSWER, chunks: 4 },
    ]);

    expect(streamed).toBe(LONG_ANSWER);
    expect(message.actions).toEqual([expect.objectContaining({ type: 'create_doubt', status: 'proposed', origin: 'suggested' })]);
    expect(saved.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(await DoubtClearance.countDocuments()).toBe(0); // only created once the student confirms
  });

  it('does what the student commands, with a fixed confirmation and no lecture', async () => {
    const { message, events } = await turn('Create a doubt about Docker volumes vs bind mounts', [
      { tools: [{ name: 'create_doubt', args: DOUBT_ARGS }] },
      { text: 'This text must never be shown.' },
    ]);

    const doubt = await DoubtClearance.findOne({ userId: ALICE.email });
    expect(doubt.title).toBe(DOUBT_ARGS.title);
    expect(message.content).toBe(`Done! I've created the doubt **"${DOUBT_ARGS.title}"** in Doubt Clearance.`);
    expect(message.actions[0]).toMatchObject({ status: 'done', origin: 'requested', result: { route: `/doubts?tool=doubts&open=${doubt._id}` } });
    expect(events.filter((e) => e.event === 'token').map((e) => e.data.text).join('')).toBe(message.content);
    expect(mockModel.calls).toHaveLength(1); // no second mockModel call after the task ran
  });

  it('never lets a plain question create something without a Yes', async () => {
    const { message } = await turn('What are Docker volumes?', [
      { tools: [{ name: 'create_doubt', args: DOUBT_ARGS }] },
      { text: 'Volumes store data.' },
    ]);
    expect(await DoubtClearance.countDocuments()).toBe(0);
    expect(message.content).toMatch(/Volumes store data/);
    const toolResult = mockModel.calls[1].messages.find((m) => m._getType?.() === 'tool');
    expect(JSON.parse(toolResult.content).error).toMatch(/asked a question/);
  });

  it('adds a missing suggestion card to a long answer to a learning question', async () => {
    const { message, streamed } = await turn('How do Docker volumes work?', [
      { text: LONG_ANSWER },
      { tools: [{ name: 'propose_create_doubt', args: DOUBT_ARGS }] }, // the forced follow-up
    ]);
    expect(message.actions).toHaveLength(1);
    expect(message.content).toMatch(/save it as a doubt/);
    expect(streamed).toMatch(/save it as a doubt/);
  });

  it('only proposes videos from real search results', async () => {
    const { message } = await turn('Can you recommend a video on Docker volumes?', [
      { tools: [{ name: 'propose_add_video', args: { videoId: 'made-up-id!' } }] },
      { tools: [{ name: 'search_youtube_videos', args: { query: 'docker volumes' } }] },
      { tools: [{ name: 'propose_add_video', args: { videoId: 'abcdefghijk', reason: 'Clear intro' } }] },
      { text: 'Here is a good one.' },
    ]);
    expect(message.actions).toHaveLength(1);
    expect(message.actions[0].args).toMatchObject({ videoId: 'abcdefghijk', title: 'Docker volumes', channelName: 'TechWorld' });
  });

  it('keeps what was written when the student presses Stop', async () => {
    const controller = new AbortController();
    const pending = turn('Explain Docker networking', [{ text: 'Docker networks connect', waitForAbort: true }], { signal: controller.signal });
    setTimeout(() => controller.abort(), 30);
    const { message, saved } = await pending;
    expect(message.content).toBe('Docker networks connect\n\n*(stopped)*');
    expect(saved.messages[1].content).toBe(message.content);
  });

  it('fails the turn when the mockModel produces nothing', async () => {
    await expect(turn('hi', [{ text: '' }])).rejects.toMatchObject({ status: 502 });
  });
});
