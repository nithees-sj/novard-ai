const fs = require('fs');
const request = require('supertest');

jest.mock('../../ai/groqClient', () => ({ complete: jest.fn() }));
jest.mock('../../ai/conversation', () => ({
  ...jest.requireActual('../../ai/conversation'),
  converse: jest.fn(),
}));
jest.mock('../../services/ocrService', () => ({ recognizePage: jest.fn(), terminateOcr: jest.fn() }));

const { complete } = require('../../ai/groqClient');
const { converse } = require('../../ai/conversation');
const { createApp } = require('../../app');
const Exam = require('../../models/exam');
const Notes = require('../../models/notes');
const Notification = require('../../models/notification');
const settings = require('../../services/settingsService');
const exams = require('../../services/examService');
const { addDays } = require('../../services/examAutopilot/dates');
const { env } = require('../../config/env');
const { useTestDatabase } = require('../helpers/db');
const { ALICE, BOB, bearer } = require('../helpers/auth');
const { makePdf } = require('../helpers/pdf');
const { quizJson } = require('../helpers/fixtures');

useTestDatabase();
const app = createApp();
afterEach(() => {
  jest.clearAllMocks();
  complete.mockReset();
});
afterAll(() => fs.rmSync(env.uploadDir, { recursive: true, force: true }));

const TODAY = '2026-10-08';
const EXAM = '2026-10-22';
const q = `?today=${TODAY}`;

const api = (user = ALICE) => ({
  get: (path) => request(app).get(path).set('Authorization', bearer(user)),
  post: (path, body = {}) => request(app).post(path).set('Authorization', bearer(user)).send(body),
  patch: (path, body = {}) => request(app).patch(path).set('Authorization', bearer(user)).send(body),
  del: (path) => request(app).delete(path).set('Authorization', bearer(user)),
});

const SYLLABUS = `DBMS end-semester syllabus.
Unit 1: ER modelling - entities, relationships, cardinality.
Unit 2: Relational model - keys, relational algebra.
Unit 3: SQL - joins, grouping, subqueries (30 marks).
Unit 4: Normalisation - functional dependencies, 1NF to BCNF.
Unit 5: Transactions - ACID, concurrency control.`;

const TOPICS = JSON.stringify({
  title: 'DBMS end-semester',
  topics: [
    { name: 'ER modelling', summary: 'Entities and relationships', importance: 5, difficulty: 1, prerequisites: [] },
    { name: 'Relational model', summary: 'Keys and relational algebra', importance: 6, difficulty: 1, prerequisites: [0] },
    { name: 'SQL', summary: 'Joins, grouping, subqueries', importance: 10, difficulty: 2, prerequisites: [1] },
    { name: 'Normalisation', summary: 'FDs and normal forms', importance: 7, difficulty: 3, prerequisites: [1] },
    { name: 'Transactions', summary: 'ACID and concurrency', importance: 6, difficulty: 2, prerequisites: [2, 4] },
  ],
});

async function draft(user = ALICE, body = { syllabus: SYLLABUS }) {
  complete.mockResolvedValueOnce(TOPICS);
  const res = await api(user).post(`/api/exams/draft${q}`, body);
  expect(res.status).toBe(201);
  return res.body;
}

async function activeExam(user = ALICE, over = {}) {
  const d = await draft(user);
  const res = await api(user).post(`/api/exams/${d._id}/activate${q}`, { title: 'DBMS finals', examDate: EXAM, dailyMinutes: 60, restDays: [0], targetReadiness: 70, ...over });
  expect(res.status).toBe(200);
  return res.body;
}

describe('Exam Autopilot', () => {
  it('reads a syllabus into a draft the student reviews, then plans it', async () => {
    const d = await draft();
    expect(d).toMatchObject({ status: 'draft', title: 'DBMS end-semester', source: { kind: 'text' } });
    expect(d.topics.map((t) => t.name)).toEqual(['ER modelling', 'Relational model', 'SQL', 'Normalisation', 'Transactions']);
    // A backward link (Transactions → Normalisation, index 4 → itself) is cleaned; real links become ids.
    expect(d.topics[2].prerequisites).toEqual([d.topics[1].key]);
    expect(d.syllabus).toBeUndefined();
    expect(complete.mock.calls[0][0].messages[1].content).toContain('Unit 3: SQL');

    // Drafts are not listed; the student edits topics before confirming.
    expect((await api().get(`/api/exams${q}`)).body.exams).toEqual([]);
    const topics = [
      ...d.topics.slice(0, 4).map((t) => ({ ...t, confidence: t.name === 'SQL' ? 4 : undefined })),
      { key: 'new-1', name: 'Indexing', summary: 'B+ trees', importance: 4, difficulty: 2, prerequisites: [d.topics[1].key] },
    ];
    const res = await api().post(`/api/exams/${d._id}/activate${q}`, { title: 'DBMS finals', examDate: EXAM, dailyMinutes: 60, restDays: [0], targetReadiness: 70, topics });
    expect(res.status).toBe(200);
    const exam = res.body;
    expect(exam).toMatchObject({ status: 'active', title: 'DBMS finals', daysLeft: 14, dailyMinutes: 60 });
    expect(exam.topics.map((t) => t.name)).toEqual(['ER modelling', 'Relational model', 'SQL', 'Normalisation', 'Indexing']);
    expect(exam.topics.reduce((s, t) => s + t.weight, 0)).toBeCloseTo(1, 6);
    expect(exam.topics[2].mastery).toBeGreaterThan(0); // the confidence hint
    expect(exam.today.tasks.length).toBeGreaterThan(0);
    exam.today.tasks.forEach((t) => expect(t).toMatchObject({ status: 'todo', reason: expect.any(String) }));
    expect(exam.today.tasks[0].topic).toBe('ER modelling'); // foundations first
    expect(exam.upcoming).toHaveLength(7);
    expect(exam.forecast).toMatchObject({ now: expect.any(Number), projected: expect.any(Number), advice: expect.any(Object) });
    expect(exam.planLog[0]).toMatchObject({ at: TODAY, trigger: 'Plan created' });
    expect(exam.snapshots).toEqual([expect.objectContaining({ date: TODAY })]);

    expect((await api().post(`/api/exams/${d._id}/activate${q}`, { title: 'x', examDate: EXAM, dailyMinutes: 60 })).status).toBe(409);
    const list = (await api().get(`/api/exams${q}`)).body.exams;
    expect(list).toEqual([expect.objectContaining({ title: 'DBMS finals', daysLeft: 14, todayTasks: exam.today.tasks.length })]);
  });

  it('reads a syllabus PDF, saved to Notes too', async () => {
    complete.mockResolvedValueOnce(TOPICS);
    const res = await request(app).post(`/api/exams/draft${q}`).set('Authorization', bearer(ALICE))
      .field('title', 'DBMS')
      .attach('pdf', makePdf('Unit 1 ER modelling. Unit 2 relational model. Unit 3 SQL joins and grouping. Unit 4 normalisation.'), { filename: 'syllabus.pdf', contentType: 'application/pdf' });
    expect(res.body.error).toBeUndefined();
    expect(res.status).toBe(201);
    expect(res.body.source.kind).toBe('pdf');
    expect(await Notes.countDocuments({ userId: ALICE.email })).toBe(1);
  });

  it('completes a topic only by passing its check, graded on the server', async () => {
    const exam = await activeExam();
    const learn = exam.today.tasks.find((t) => t.type === 'learn');
    expect(exam.passPercent).toBe(50);

    // No ticking by hand.
    const manual = await api().patch(`/api/exams/${exam._id}/tasks/${learn._id}${q}`, { status: 'done' });
    expect(manual.status).toBe(409);
    expect(manual.body).toMatchObject({ code: 'QUIZ_REQUIRED', error: expect.stringContaining('50%') });

    // The learn task's 5-question topic check.
    complete.mockResolvedValueOnce(quizJson(5));
    const check = await api().post(`/api/exams/${exam._id}/tasks/${learn._id}/quiz${q}`);
    expect(check.status).toBe(201);
    expect(check.body).toMatchObject({ kind: 'check', label: 'Topic check', total: 5 });
    const answerKey = () => Exam.findById(exam._id).lean().then((e) => e.quizzes.at(-1).questions.map((x) => x.correctAnswer));
    const wrong = (k) => (k + 1) % 4;

    // 2 of 5 fails: evidence counts, but the task stays open and the topic is not completed.
    const k1 = await answerKey();
    const fail = await api().post(`/api/exams/${exam._id}/quizzes/${check.body._id}/submit${q}`, { answers: k1.map((k, i) => (i < 2 ? k : wrong(k))) });
    expect(fail.body).toMatchObject({ passed: false, taskCompleted: false, retry: true, passPercent: 50 });
    const failedTopic = fail.body.exam.topics.find((t) => t.name === learn.topic);
    expect(failedTopic).toMatchObject({ learned: false, evidenceCount: 1 });
    expect(fail.body.exam.today.tasks.find((t) => t.type === 'learn' && t.topic === learn.topic)?.status).toBe('todo');
    expect(fail.body.exam.planLog[0].trigger).toBe(`Topic check on ${learn.topic}: 2/5 (not passed)`);

    // A retry gets new questions; 3 of 5 passes and completes the task and the topic.
    const retryTask = fail.body.exam.today.tasks.find((t) => t.type === 'learn' && t.topic === learn.topic);
    complete.mockResolvedValueOnce(quizJson(5));
    const again = await api().post(`/api/exams/${exam._id}/tasks/${retryTask._id}/quiz${q}`);
    expect(again.body._id).not.toBe(check.body._id);
    const k2 = await answerKey();
    const pass = await api().post(`/api/exams/${exam._id}/quizzes/${again.body._id}/submit${q}`, { answers: k2.map((k, i) => (i < 3 ? k : wrong(k))) });
    expect(pass.body).toMatchObject({ passed: true, taskCompleted: true, retry: false });
    expect(pass.body.exam.today.tasks.find((t) => t._id === retryTask._id).status).toBe('done');
    expect(pass.body.exam.topics.find((t) => t.name === learn.topic).learned).toBe(true);
    expect(pass.body.exam.stats.topicsCompleted).toBe(1);
    expect((await api().patch(`/api/exams/${exam._id}/tasks/${retryTask._id}${q}`, { status: 'skipped' })).status).toBe(409);

    // Practice starts the next day.
    const q2 = `?today=${addDays(TODAY, 1)}`;
    const day2 = (await api().get(`/api/exams/${exam._id}${q2}`)).body;
    const practice = day2.today.tasks.find((t) => t.type === 'practice' && t.status === 'todo');
    expect(practice).toBeTruthy();
    complete.mockResolvedValueOnce(quizJson(6));
    const quiz = await api().post(`/api/exams/${exam._id}/tasks/${practice._id}/quiz${q2}`);
    expect(quiz.status).toBe(201);
    expect(quiz.body.questions).toHaveLength(6);
    quiz.body.questions.forEach((x) => {
      expect(x.correctAnswer).toBeUndefined(); // never before submitting
      expect(x.explanation).toBeUndefined();
      expect(x.topic).toBe(practice.topic);
    });
    // Starting it again returns the same quiz, with no new model call.
    expect((await api().post(`/api/exams/${exam._id}/tasks/${practice._id}/quiz${q2}`)).body._id).toBe(quiz.body._id);
    expect(complete).toHaveBeenCalledTimes(4); // syllabus, two topic checks, this practice quiz

    const key = await answerKey();
    const answers = key.map((a, i) => (i < 5 ? a : (a + 1) % 4)); // 5 of 6 right
    expect((await api().post(`/api/exams/${exam._id}/quizzes/${quiz.body._id}/submit${q2}`, { answers: [0] })).status).toBe(400);
    const marked = await api().post(`/api/exams/${exam._id}/quizzes/${quiz.body._id}/submit${q2}`, { answers });
    expect(marked.status).toBe(200);
    expect(marked.body.quiz).toMatchObject({ correct: 5, total: 6 });
    expect(marked.body.quiz.questions[0].correctAnswer).toBe(key[0]);
    expect(marked.body.breakdown).toEqual([expect.objectContaining({ topic: practice.topic, correct: 5, total: 6 })]);
    expect(marked.body.breakdown[0].masteryAfter).toBeGreaterThan(marked.body.breakdown[0].masteryBefore);
    expect(marked.body.readiness.after).toBeGreaterThan(marked.body.readiness.before);
    expect(marked.body.exam.today.tasks.find((t) => t._id === practice._id).status).toBe('done');
    expect(marked.body.exam.planLog[0].trigger).toBe(`Practice quiz on ${practice.topic}: 5/6 (passed)`);
    expect((await api().post(`/api/exams/${exam._id}/quizzes/${quiz.body._id}/submit${q2}`, { answers })).status).toBe(409);

    // Counted on the profile like every other quiz.
    const profile = await api().get(`/api/profile/${encodeURIComponent(ALICE.email)}/overview`);
    expect(JSON.stringify(profile.body)).toContain('Exam Autopilot');
  });

  it('runs a diagnostic across topics and records each topic separately', async () => {
    const exam = await activeExam();
    const tagged = JSON.stringify(Array.from({ length: 10 }, (_, i) => ({
      topic: i % 5, question: `Q${i}?`, options: [`R${i}`, `W1${i}`, `W2${i}`, `W3${i}`], correctAnswer: 0, explanation: 'x',
    })));
    complete.mockResolvedValueOnce(tagged);
    const quiz = await api().post(`/api/exams/${exam._id}/mock${q}`, { kind: 'diagnostic' });
    expect(quiz.status).toBe(201);
    expect(quiz.body).toMatchObject({ kind: 'diagnostic', total: 10 });
    expect(new Set(quiz.body.questions.map((x) => x.topic)).size).toBe(5);

    const stored = await Exam.findById(exam._id).lean();
    const key = stored.quizzes[0].questions.map((x) => x.correctAnswer);
    const res = await api().post(`/api/exams/${exam._id}/quizzes/${quiz.body._id}/submit${q}`, { answers: key });
    expect(res.body.breakdown).toHaveLength(5);
    expect(res.body.exam.topics.every((t) => t.evidenceCount === 1)).toBe(true);
    expect(res.body.exam.planLog[0].trigger).toBe('Diagnostic test: 10/10');
    // Topics the student already knows no longer start with "learn".
    expect(res.body.exam.today.tasks.some((t) => t.type === 'learn' && t.status === 'todo')).toBe(false);
  });

  it('re-plans on a new day: missed tasks are rescheduled and logged', async () => {
    const exam = await activeExam();
    const tomorrow = addDays(TODAY, 1);
    const next = (await api().get(`/api/exams/${exam._id}?today=${tomorrow}`)).body;
    expect(next.daysLeft).toBe(13);
    expect(next.stats.missed).toBe(exam.today.tasks.length);
    expect(next.planLog[0]).toMatchObject({ at: tomorrow, trigger: 'New day' });
    expect(next.planLog[0].summary).toMatch(/rescheduled/);
    expect(next.snapshots.map((s) => s.date)).toEqual([TODAY, tomorrow]);
    // Opening it again the same day does not re-plan.
    expect((await api().get(`/api/exams/${exam._id}?today=${tomorrow}`)).body.planLog).toHaveLength(2);
  });

  it('changes settings and re-plans', async () => {
    const exam = await activeExam();
    const res = await api().patch(`/api/exams/${exam._id}${q}`, { dailyMinutes: 120 });
    expect(res.status).toBe(200);
    expect(res.body.dailyMinutes).toBe(120);
    expect(res.body.forecast.projected).toBeGreaterThan(exam.forecast.projected);
    expect(res.body.planLog[0].trigger).toBe('Settings changed');
    expect((await api().patch(`/api/exams/${exam._id}${q}`, { examDate: TODAY })).status).toBe(400);
    expect((await api().patch(`/api/exams/${exam._id}${q}`, { restDays: [0, 1, 2, 3, 4, 5] })).status).toBe(400);
  });

  it('learns from a Teach-Back started from an exam task', async () => {
    const exam = await activeExam();
    const topic = exam.topics[0];
    const start = await api().post('/api/teachback', { examRef: { examId: exam._id, topicId: topic._id } });
    expect(start.status).toBe(201);
    expect(start.body).toMatchObject({ concept: 'ER modelling', focus: 'Entities and relationships', examRef: { examId: exam._id, topicId: topic._id } });
    complete.mockResolvedValueOnce('{"reply": "Why?", "ready": false}');
    await api().post(`/api/teachback/${start.body._id}/turns`, { message: 'Entities are things, relationships link them.' });
    complete.mockResolvedValueOnce(JSON.stringify({ score: 80, verdict: 'Good', flow: [{ step: 'Entities', status: 'good', feedback: 'ok' }], corrections: [], strengths: [], nextStep: '' }));
    expect((await api().post(`/api/teachback/${start.body._id}/finish`, { today: TODAY })).status).toBe(200);

    const after = (await api().get(`/api/exams/${exam._id}${q}`)).body;
    expect(after.topics[0]).toMatchObject({ evidenceCount: 1, learned: true });
    expect(after.planLog[0].trigger).toBe('Teach-back on ER modelling: 80/100');

    expect((await api(BOB).post('/api/teachback', { examRef: { examId: exam._id, topicId: topic._id } })).status).toBe(404);
  });

  it('reminds once a day in the bell, even when the bell loads twice at once', async () => {
    await activeExam();
    await Promise.all([exams.sweepExamReminders(ALICE.email, TODAY), exams.sweepExamReminders(ALICE.email, TODAY)]);
    const bell = await Notification.find({ userId: ALICE.email, kind: 'exam_today' }).lean();
    expect(bell).toHaveLength(1);
    expect(bell[0].title).toMatch(/^DBMS finals: \d+ tasks? · \d+ min today$/);
    expect(bell[0].body).toMatch(/Readiness \d+% now/);
    expect(bell[0].link).toMatch(/^\/exams\?open=/);

    await exams.sweepExamReminders(ALICE.email, addDays(EXAM, -7));
    const week = await Notification.findOne({ userId: ALICE.email, kind: 'exam_today' }).sort({ createdAt: -1 }).lean();
    expect(week.title).toMatch(/7 days to go/);
    expect((await api().get(`/api/notifications${q}`)).status).toBe(200);
  });

  it('keeps each student to their own exams and validates input', async () => {
    const exam = await activeExam();
    expect((await api(BOB).get(`/api/exams/${exam._id}${q}`)).status).toBe(404);
    expect((await api(BOB).patch(`/api/exams/${exam._id}${q}`, { dailyMinutes: 30 })).status).toBe(404);
    expect((await api(BOB).patch(`/api/exams/${exam._id}/tasks/${exam.today.tasks[0]._id}${q}`, { status: 'done' })).status).toBe(404);
    expect((await api(BOB).del(`/api/exams/${exam._id}`)).status).toBe(404);
    expect((await api(BOB).get(`/api/exams${q}`)).body.exams).toEqual([]);
    expect((await request(app).get('/api/exams')).status).toBe(401);

    expect((await api().post(`/api/exams/draft${q}`, {})).status).toBe(400);
    expect((await api().post(`/api/exams/draft${q}`, { syllabus: 'too short' })).status).toBe(400);
    expect((await api().post(`/api/exams/draft${q}`, { syllabus: SYLLABUS, examDate: TODAY })).status).toBe(400);
    expect((await api().get('/api/exams?today=2026-02-30')).status).toBe(400);
    expect((await api().patch(`/api/exams/${exam._id}/tasks/${exam.today.tasks[0]._id}${q}`, { status: 'eaten' })).status).toBe(400);
    expect((await api().patch(`/api/exams/${exam._id}/tasks/${exam.today.tasks[0]._id}?today=${addDays(TODAY, 1)}`, { status: 'done' })).status).toBe(409);

    const d = await draft();
    expect((await api().post(`/api/exams/${d._id}/activate${q}`, { title: 'X', examDate: TODAY, dailyMinutes: 60 })).status).toBe(400);
    expect((await api().post(`/api/exams/${d._id}/activate${q}`, { title: 'X', examDate: EXAM, dailyMinutes: 5 })).status).toBe(400);
    expect((await api().post(`/api/exams/${d._id}/activate${q}`, { title: 'X', examDate: EXAM, dailyMinutes: 60, topics: [{ key: 'a', name: 'Only' }] })).status).toBe(400);

    expect((await api().del(`/api/exams/${exam._id}`)).status).toBe(200);
  });

  it('has its own tutor that knows the exam, the plan and the material', async () => {
    const exam = await activeExam();
    // Stand-in for the model: store the turn the way the real conversation engine does.
    converse.mockImplementation(async ({ Model, filter, field, input }) => {
      const reply = `Tutor reply to: ${input}`;
      await Model.updateOne(filter, { $push: { [field]: { $each: [{ role: 'user', content: input, at: new Date() }, { role: 'assistant', content: reply, at: new Date(Date.now() + 1) }] } } });
      return reply;
    });
    const topic = exam.topics.find((t) => t.name === 'SQL');
    const res = await api().post(`/api/exams/${exam._id}/tutor${q}`, { message: 'Teach me SQL joins', topicId: topic._id });
    expect(res.status).toBe(200);
    expect(res.body.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(res.body.messages.every((m) => m.topicId === topic._id)).toBe(true);

    const call = converse.mock.calls[0][0];
    expect(call).toMatchObject({ field: 'tutor', input: 'Teach me SQL joins' });
    expect(call.system).toContain('"DBMS finals" exam, 14 days away');
    expect(call.system).toMatch(/- SQL \(\d+% of the exam\): mastery \d+%, not started/);
    expect(call.system).toContain('The student is working on: SQL');
    expect(call.system).toContain('Unit 3: SQL'); // the syllabus passage
    expect(call.system).toMatch(/Today's plan:\n- learn: ER modelling/);

    // It comes back with the exam, and can be started afresh.
    expect((await api().get(`/api/exams/${exam._id}${q}`)).body.tutor).toHaveLength(2);
    expect((await api().del(`/api/exams/${exam._id}/tutor`)).body.messages).toEqual([]);
    expect((await api().get(`/api/exams/${exam._id}${q}`)).body.tutor).toEqual([]);

    expect((await api(BOB).post(`/api/exams/${exam._id}/tutor${q}`, { message: 'hi' })).status).toBe(404);
    expect((await api().post(`/api/exams/${exam._id}/tutor${q}`, { message: '' })).status).toBe(400);
    expect((await api().post(`/api/exams/${exam._id}/tutor${q}`, { message: 'hi', topicId: exam._id })).status).toBe(404);
    converse.mockReset();
  });

  it('handles the AI: off-topic text, unreadable answers and the admin switch', async () => {
    complete.mockResolvedValueOnce('{"declined": "I can only help with study material."}');
    const off = await api().post(`/api/exams/draft${q}`, { syllabus: 'Who will win the cricket match tomorrow? Tell me all about the players.' });
    expect(off.status).toBe(400);
    expect(off.body.error).toBe('I can only help with study material.');

    complete.mockResolvedValueOnce('not json');
    expect((await api().post(`/api/exams/draft${q}`, { syllabus: SYLLABUS })).status).toBe(502);

    const exam = await activeExam();
    complete.mockResolvedValueOnce('[]');
    expect((await api().post(`/api/exams/${exam._id}/mock${q}`, { kind: 'mock' })).status).toBe(502);

    await settings.set('features.examAutopilot', { enabled: false, message: 'Back soon.', notice: '' }, { actor: { email: 'root@example.com', role: 'superadmin' } });
    const blocked = await api().post(`/api/exams/draft${q}`, { syllabus: SYLLABUS });
    expect(blocked.status).toBe(503);
    expect(blocked.body.error).toContain('Back soon.');
    // The plan itself keeps working.
    expect((await api().get(`/api/exams/${exam._id}${q}`)).status).toBe(200);
    expect((await api().patch(`/api/exams/${exam._id}/tasks/${exam.today.tasks[0]._id}${q}`, { status: 'skipped' })).status).toBe(200);
  });
});
