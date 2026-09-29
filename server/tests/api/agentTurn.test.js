const { createFakeChatModel } = require('../helpers/fakeChatModel');

let mockModel = createFakeChatModel();
jest.mock('../../ai/conversation', () => ({
  ...jest.requireActual('../../ai/conversation'),
  chatModel: jest.fn(() => mockModel),
}));
const VIDEO = (id, title, duration = '10:00') => ({ videoId: id, title, channelName: 'TechWorld', duration, url: `https://www.youtube.com/watch?v=${id}` });
jest.mock('../../services/youtubeService', () => ({
  ...jest.requireActual('../../services/youtubeService'),
  searchVideos: jest.fn(async () => [
    VIDEO('abcdefghijk', 'Docker volumes'),
    VIDEO('bbbbbbbbbbb', 'Docker volumes deep dive', '1:05:00'),
    VIDEO('ccccccccccc', 'Volumes in 5 minutes', '5:00'),
    VIDEO('ddddddddddd', 'Bind mounts'),
  ]),
}));

const { runTurn, messageForModel } = require('../../agent/novardAgent');
const ChatbotConversation = require('../../models/chatbotConversation');
const DoubtClearance = require('../../models/doubtClearance');
const LearnerProfile = require('../../models/learnerProfile');
const Roadmap = require('../../models/roadmap');
const SkillPlan = require('../../models/skillPlan');
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

/** The JSON the server returned to the model for its n-th tool call in this turn. */
const toolResults = () => mockModel.calls.flatMap((c) => c.messages)
  .filter((m) => m._getType?.() === 'tool')
  .filter((m, i, all) => all.findIndex((x) => x.tool_call_id === m.tool_call_id) === i)
  .map((m) => JSON.parse(m.content));

const LONG_ANSWER = `Docker volumes are managed by Docker. ${'They persist data beyond the container lifecycle. '.repeat(10)}`;
const DOUBT = {
  title: 'Docker Volumes vs Bind Mounts',
  question: 'What is the difference between Docker volumes and bind mounts?',
  context: 'I lose my database data when the container restarts.',
  stated: ['question', 'context'],
};

describe('Novard Agent turn: answering', () => {
  it('answers a learning question and attaches an offer card that has not run', async () => {
    const { message, saved, streamed } = await turn('What is the difference between Docker volumes and bind mounts?', [
      { tools: [{ name: 'suggest_doubt', args: { topic: 'Docker volumes vs bind mounts' } }] },
      { text: LONG_ANSWER, chunks: 4 },
    ]);

    expect(streamed).toBe(LONG_ANSWER);
    expect(message.actions).toEqual([expect.objectContaining({
      type: 'create_doubt', status: 'proposed', origin: 'suggested', args: { topic: 'Docker volumes vs bind mounts' },
      meta: expect.objectContaining({ followUp: expect.stringMatching(/create a doubt about "Docker volumes vs bind mounts"/) }),
    })]);
    expect(saved.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(saved.messages[1].actions[0].meta).toBeUndefined(); // computed on the way out, never stored
    expect(await DoubtClearance.countDocuments()).toBe(0);
  });

  it('adds a missing offer card to a long answer to a learning question', async () => {
    const { message, streamed } = await turn('How do Docker volumes work?', [
      { text: LONG_ANSWER },
      { tools: [{ name: 'suggest_doubt', args: { topic: 'Docker volumes' } }] }, // the forced follow-up
    ]);
    expect(message.actions).toHaveLength(1);
    expect(message.content).toMatch(/save it as a doubt/);
    expect(streamed).toMatch(/save it as a doubt/);
  });

  it('keeps what was written when the student presses Stop', async () => {
    const controller = new AbortController();
    const pending = turn('Explain Docker networking', [{ text: 'Docker networks connect', waitForAbort: true }], { signal: controller.signal });
    setTimeout(() => controller.abort(), 30);
    const { message, saved } = await pending;
    expect(message.content).toBe('Docker networks connect\n\n*(stopped)*');
    expect(saved.messages[1].content).toBe(message.content);
  });

  it('fails the turn when the model produces nothing', async () => {
    await expect(turn('hi', [{ text: '' }])).rejects.toMatchObject({ status: 502 });
  });
});

describe('Novard Agent turn: clarify -> draft', () => {
  it('reports what is missing instead of guessing, then ends the reply with the questions', async () => {
    const { message, events, saved } = await turn('Make me a roadmap for DevOps', [
      // "level" is filled in but not stated: a guess, so it must still be asked.
      { tools: [{ name: 'prepare_roadmap', args: { role: 'DevOps Engineer', level: 'beginner', stated: ['role'] } }] },
      {
        text: 'Happy to! A few quick questions so it fits you:',
        tools: [{
          name: 'ask_student',
          args: {
            questions: [
              { key: 'level', question: 'Where are you starting from?', options: ['Complete beginner', 'I know the basics'] },
              { key: 'knownSkills', question: 'Which of these do you know?', options: ['Linux', 'Git', 'Python', 'None yet'], multiSelect: true },
              { key: 'time', question: 'How much time can you give?', options: ['5 h/week', '10 h/week'] },
            ],
          },
        }],
      },
      { text: 'This must never run.' },
    ]);

    const [prepared] = toolResults();
    expect(prepared.status).toBe('needs_info');
    expect(prepared.missing.map((m) => m.key)).toEqual(['level', 'knownSkills', 'time']);
    expect(mockModel.calls).toHaveLength(2); // the reply ends with the questions

    expect(message.actions).toBeUndefined();
    expect(message.content).toBe('Happy to! A few quick questions so it fits you:');
    expect(events.find((e) => e.event === 'ask').data.ask.questions).toHaveLength(3);
    expect(saved.messages[1].ask.questions[1]).toMatchObject({ key: 'knownSkills', multiSelect: true, options: ['Linux', 'Git', 'Python', 'None yet'] });
    expect(await Roadmap.countDocuments()).toBe(0);
  });

  it('drafts once everything is known, filling gaps from the saved profile and marking assumptions', async () => {
    await LearnerProfile.create({ userId: ALICE.email, level: 'beginner', hoursPerWeek: 15 });
    const { message } = await turn('Make me a DevOps roadmap, I know Linux', [
      { tools: [{ name: 'prepare_roadmap', args: { role: 'DevOps Engineer', knownSkills: ['Linux'], stated: ['role', 'knownSkills'] } }] },
      { text: 'Here is your draft - adjust anything and press Create.' },
    ]);

    const [draft] = message.actions;
    expect(draft).toMatchObject({
      type: 'generate_roadmap',
      status: 'draft',
      origin: 'requested',
      args: { role: 'DevOps Engineer', level: 'beginner', knownSkills: ['Linux'], hoursPerWeek: 15, timelineMonths: 6 },
      provenance: { role: 'chat', knownSkills: 'chat', level: 'profile', hoursPerWeek: 'profile', timelineMonths: 'assumed' },
    });
    expect(draft.meta.fields.map((f) => f.key)).toEqual(['role', 'level', 'knownSkills', 'hoursPerWeek', 'timelineMonths', 'goal']);
    expect(toolResults()[0]).toMatchObject({ status: 'drafted', assumed: ['timelineMonths'] });
    expect(await Roadmap.countDocuments()).toBe(0); // nothing is created until the student presses Create
  });

  it('accepts "none" as an answer for skills, but never a guessed target role from the profile', async () => {
    await LearnerProfile.create({ userId: ALICE.email, targetRole: 'Data Analyst', level: 'beginner', hoursPerWeek: 5 });
    await turn('Make me a roadmap', [
      { tools: [{ name: 'prepare_roadmap', args: { knownSkills: [], stated: ['knownSkills'] } }] },
      { text: 'Which role?' },
    ]);
    const [prepared] = toolResults();
    expect(prepared.missing).toEqual([expect.objectContaining({ key: 'role', hint: expect.stringMatching(/Data Analyst/) })]);
  });

  it('asks about a value out of range instead of silently changing it', async () => {
    await turn('Make me a 7-day React plan, I am a beginner and want to build a small app', [
      {
        tools: [{
          name: 'prepare_skill_plan',
          args: { skillName: 'React', level: 'beginner', description: 'Build a small React app on my own', durationDays: 7, stated: ['skillName', 'level', 'description', 'durationDays'] },
        }],
      },
      { text: 'Plans run 10 to 60 days - shall I make it 10?' },
    ]);
    const [prepared] = toolResults();
    expect(prepared.status).toBe('needs_info');
    expect(prepared.invalid).toEqual([expect.objectContaining({ key: 'durationDays', reason: expect.stringMatching(/between 10 and 60/) })]);
  });

  it('points out an item the student already has, and drafts a new one only when asked to', async () => {
    await SkillPlan.create({ userId: ALICE.email, skillName: 'Docker', duration: 10, description: 'Learn Docker', dailyPlan: [{ day: 1, topic: 'Intro', objective: 'Start', completed: true }, { day: 2, topic: 'Images', objective: 'Build' }] });
    const args = { skillName: 'docker', level: 'beginner', description: 'Containerise my Node app', stated: ['skillName', 'level', 'description'] };

    await turn('Make me a Docker plan', [{ tools: [{ name: 'prepare_skill_plan', args }] }, { text: 'You already have one.' }]);
    expect(toolResults()[0]).toMatchObject({ status: 'exists', existing: { progress: '1 of 2 days done' } });

    const { message } = await turn('Make a new one anyway', [{ tools: [{ name: 'prepare_skill_plan', args: { ...args, allowDuplicate: true } }] }, { text: 'Draft ready.' }]);
    expect(message.actions[0]).toMatchObject({ status: 'draft', args: { skillName: 'docker', durationDays: 14, language: 'English' } });
  });

  it('replaces an earlier draft of the same kind when the student asks for a change', async () => {
    const history = [
      { role: 'user', content: 'Plan for SQL' },
      { role: 'assistant', content: 'Draft ready.', actions: [{ id: 'aaaaaaaaaaaa', type: 'create_skill_plan', origin: 'requested', status: 'draft', args: { skillName: 'SQL', durationDays: 14 } }] },
    ];
    const { saved, events } = await turn('Make it 20 days', [
      { tools: [{ name: 'prepare_skill_plan', args: { skillName: 'SQL', level: 'beginner', description: 'Write reports at work', durationDays: 20, stated: ['skillName', 'level', 'description', 'durationDays'] } }] },
      { text: 'Updated to 20 days.' },
    ], { history });

    expect(saved.messages[1].actions[0].status).toBe('superseded');
    expect(saved.messages[3].actions[0]).toMatchObject({ status: 'draft', args: { durationDays: 20 } });
    expect(events.find((e) => e.event === 'superseded').data).toMatchObject({ type: 'create_skill_plan' });
  });

  it('asks the agent to write the parts it owns, like a doubt title', async () => {
    const { title, ...noTitle } = DOUBT;
    await turn('Create a doubt about volumes vs bind mounts', [
      { tools: [{ name: 'prepare_doubt', args: noTitle }] },
      { tools: [{ name: 'prepare_doubt', args: { ...noTitle, title } }] },
      { text: 'Draft ready.' },
    ]);
    const [first, second] = toolResults();
    expect(first.error).toMatch(/title/);
    expect(second.status).toBe('drafted');
  });

  it('finds the video candidates itself and lets the student pick on the draft', async () => {
    const { message } = await turn('Find me a short video on Docker volumes', [
      { tools: [{ name: 'prepare_video', args: { topic: 'Docker volumes', length: 'short', stated: ['topic', 'length'] } }] },
      { text: 'Pick one of these.' },
    ]);
    const { args } = message.actions[0];
    expect(args.candidates).toHaveLength(3);
    expect(args.candidates.every((c) => c.duration !== '1:05:00')).toBe(true); // a deep dive is not "short"
    expect(args.videoId).toBe(args.candidates[0].videoId);
  });

  it('shows a "remember this?" card that saves nothing by itself', async () => {
    const { message } = await turn('By the way I can study 12 hours a week', [
      { tools: [{ name: 'remember_about_student', args: { hoursPerWeek: 12, bogus: 'x' } }] },
      { text: 'Noted!' },
    ]);
    expect(message.actions[0]).toMatchObject({ type: 'profile_update', status: 'proposed', args: { hoursPerWeek: 12 } });
    expect(await LearnerProfile.countDocuments()).toBe(0);
  });
});

describe('Novard Agent memory view', () => {
  it('includes drafts with their details, offers and questions', () => {
    const text = messageForModel({
      role: 'assistant',
      content: 'Here you go.',
      actions: [
        { type: 'create_skill_plan', origin: 'requested', status: 'draft', args: { skillName: 'SQL', durationDays: 14, level: 'beginner' } },
        { type: 'create_doubt', origin: 'suggested', status: 'dismissed', args: { topic: 'Joins' } },
      ],
      ask: { questions: [{ question: 'Which level?' }] },
    });
    expect(text).toMatch(/\[Draft - Create a learning plan: SQL · 14 days · beginner - status: draft shown, NOT created yet.*details: \{"skillName":"SQL"/);
    expect(text).toMatch(/\[Offer - Create a doubt: about "Joins" - status: declined by the student\]/);
    expect(text).toMatch(/\[You asked, with tap-to-answer options: Which level\?\]/);
  });
});
