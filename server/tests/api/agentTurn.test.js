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
      { tools: [{ name: 'suggest_next_step', args: { kind: 'doubt', topic: 'Docker volumes vs bind mounts', reason: null } }] },
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
      { tools: [{ name: 'suggest_next_step', args: { kind: 'doubt', topic: 'Docker volumes' } }] }, // the forced follow-up
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

  it('retries once when the model returns nothing, then fails the turn', async () => {
    const { message } = await turn('hi', [{ text: '' }, { text: 'Hello!' }]);
    expect(message.content).toBe('Hello!');
    await expect(turn('hi', [{ text: '' }, { text: '' }])).rejects.toMatchObject({ status: 502 });
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

  it('sends an empty prepare_* call back once, quoting what the student said', async () => {
    await turn('Create a 7-day plan to learn React', [
      { tools: [{ name: 'prepare_skill_plan', args: { allowDuplicate: null, stated: [] } }] },
      { tools: [{ name: 'prepare_skill_plan', args: { skillName: 'React', durationDays: 7, stated: ['skillName', 'durationDays'] } }] },
      { text: 'Plans run 10-60 days.' },
    ]);
    const [first, second] = toolResults();
    expect(first.error).toMatch(/no details.*Create a 7-day plan to learn React/);
    expect(second).toMatchObject({ status: 'invalid', invalid: [expect.objectContaining({ key: 'durationDays' })] });
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
    // The draft is confirmed with a fixed line, without a second model call.
    expect(mockModel.calls).toHaveLength(1);
    expect(message.content).toBe("Here's your draft to generate a career roadmap: **DevOps Engineer · beginner · 15 h/week · 6 months · knows Linux**. Check the details, change anything you like, and create it when it looks right. I assumed timeline (months) 6 - change it if that doesn't suit you. Some details come from your learner profile.");
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
    expect(prepared.status).toBe('invalid');
    expect(prepared.invalid).toEqual([expect.objectContaining({ key: 'durationDays', reason: expect.stringMatching(/between 10 and 60/) })]);
  });

  it('also catches an out-of-range value the model forgot to mark as stated', async () => {
    await turn('Create a 7-day plan to learn React', [
      { tools: [{ name: 'prepare_skill_plan', args: { skillName: 'React', durationDays: 7, stated: ['skillName'] } }] },
      { text: 'Plans run 10 to 60 days.' },
    ]);
    const [prepared] = toolResults();
    expect(prepared.invalid).toEqual([expect.objectContaining({ key: 'durationDays' })]);
    expect(prepared.missing.map((m) => m.key)).toEqual(['level', 'description']);
  });

  it('treats null for unknown fields as not given, like the real model sends them', async () => {
    const nulls = { role: null, level: null, knownSkills: null, hoursPerWeek: null, timelineMonths: null, goal: null, stated: null };
    await turn('Make me a roadmap', [
      { tools: [{ name: 'prepare_roadmap', args: nulls }] },
      { tools: [{ name: 'prepare_roadmap', args: nulls }] }, // the request really had no details
      { text: 'A few questions.' },
    ]);
    const [first, second] = toolResults();
    expect(first.error).toMatch(/no details/);
    expect(second.missing.map((m) => m.key)).toEqual(['role', 'level', 'knownSkills', 'time']);
  });

  it('retries a step once when the provider rejects a malformed tool call', async () => {
    const rejected = Object.assign(new Error('400 Tool call validation failed: parameters for tool prepare_roadmap did not match schema'), { status: 400 });
    const { message } = await turn('Make me a roadmap', [
      { error: rejected },
      { text: 'Which role are you aiming for?' },
    ]);
    expect(message.content).toBe('Which role are you aiming for?');
    expect(mockModel.calls[1].messages.at(-1).content).toMatch(/rejected/);
    await expect(turn('Make me a roadmap', [{ error: rejected }, { error: rejected }])).rejects.toThrow(/validation failed/);
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

  it('asks the student first, and only then has the agent write the parts it owns, like a doubt title', async () => {
    const { title, ...noTitle } = DOUBT;
    await turn('Create a doubt about docker', [
      { tools: [{ name: 'prepare_doubt', args: { level: 'beginner', stated: [] } }] },
      { tools: [{ name: 'prepare_doubt', args: noTitle }] },
      { tools: [{ name: 'prepare_doubt', args: { ...noTitle, title } }] },
      { text: 'Draft ready.' },
    ]);
    const [first, second, third] = toolResults();
    expect(first.missing.map((m) => m.key)).toEqual(['question', 'context']); // never the title
    expect(second.error).toMatch(/title yourself.*never ask/);
    expect(third.status).toBe('drafted');
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

describe('Novard Agent turn: todo lists', () => {
  const TodoList = require('../../models/todoList');
  const { decideAction } = require('../../agent/conversations');

  it('drafts a todo list one task per line, and creates it only on Create, with the student’s edits', async () => {
    const { message, saved } = await turn('Make me a todo list for my DBMS exam on Friday', [
      { tools: [{ name: 'prepare_todo_list', args: { title: 'DBMS exam prep', items: ['1. Revise ER diagrams, keys and constraints', '- Practise SQL joins', ''], description: null, stated: ['items'] } }] },
    ]);
    const [draft] = message.actions;
    expect(draft).toMatchObject({
      type: 'create_todo_list',
      status: 'draft',
      args: { title: 'DBMS exam prep', items: ['Revise ER diagrams, keys and constraints', 'Practise SQL joins'] },
      provenance: { items: 'chat', title: 'auto' },
    });
    expect(draft.meta.fields.find((f) => f.key === 'items')).toMatchObject({ type: 'lines', need: 'must' });
    expect(message.content).toMatch(/create a todo list: \*\*DBMS exam prep · 2 tasks\*\*/);
    expect(await TodoList.countDocuments()).toBe(0);

    const action = await decideAction({
      userId: ALICE.email, userName: 'Alice', conversationId: String(saved._id), actionId: draft.id, decision: 'create',
      args: { items: 'Revise ER diagrams, keys and constraints\nPractise SQL joins\nSolve past papers' },
    });
    expect(action).toMatchObject({ status: 'done', result: { label: 'Open list', note: '3 tasks' } });
    const list = await TodoList.findOne({ userId: ALICE.email }).lean();
    expect(list).toMatchObject({ title: 'DBMS exam prep', source: 'agent' });
    expect(list.items.map((i) => i.text)).toEqual(['Revise ER diagrams, keys and constraints', 'Practise SQL joins', 'Solve past papers']);
    expect(action.result.route).toBe(`/todos?open=${list._id}`);
  });

  it('asks for the tasks when the student has not said what they need to do', async () => {
    await turn('Make me a todo list', [
      { tools: [{ name: 'prepare_todo_list', args: { title: 'My tasks', items: null, stated: [] } }] },
      { tools: [{ name: 'prepare_todo_list', args: { title: 'My tasks', items: null, stated: [] } }] },
      { tools: [{ name: 'ask_student', args: { questions: [{ question: 'What do you need to get done?', options: ['Exam prep', 'A project'] }] } }] },
    ]);
    expect(toolResults().some((r) => r.status === 'needs_info' && r.missing.some((m) => m.key === 'items'))).toBe(true);
    expect(await TodoList.countDocuments()).toBe(0);
  });
});
