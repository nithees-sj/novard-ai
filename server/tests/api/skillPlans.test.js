const request = require('supertest');

jest.mock('../../ai/groqClient', () => ({ complete: jest.fn() }));
jest.mock('../../services/youtubeService', () => ({
  ...jest.requireActual('../../services/youtubeService'),
  searchVideos: jest.fn(async (query) => [
    { videoId: 'vid00000001', title: `Video for ${query}`, thumbnailUrl: 't.jpg', url: 'https://www.youtube.com/watch?v=vid00000001' },
    { videoId: 'vid00000002', title: 'Second', thumbnailUrl: 't2.jpg', url: 'https://www.youtube.com/watch?v=vid00000002' },
  ]),
}));

const { complete } = require('../../ai/groqClient');
const { searchVideos } = require('../../services/youtubeService');
const { createApp } = require('../../app');
const SkillPlan = require('../../models/skillPlan');
const { useTestDatabase } = require('../helpers/db');
const { ALICE, BOB, bearer } = require('../helpers/auth');
const { quizJson } = require('../helpers/fixtures');

useTestDatabase();
const app = createApp();
afterEach(() => {
  jest.clearAllMocks();
  complete.mockReset(); // also drops queued mockResolvedValueOnce values
});

const planJson = (days) => JSON.stringify(Array.from({ length: days }, (_, i) => ({
  day: i + 1, topic: `Topic ${i + 1}`, objective: `Objective ${i + 1}`, videoTitle: `SQL lesson ${i + 1}`,
})));

async function generatePlan(user = ALICE, body = {}) {
  complete.mockResolvedValueOnce(planJson(body.duration || 10));
  return request(app).post('/api/skill-unlocker/generate-plan').set('Authorization', bearer(user)).send({
    skillName: 'SQL', duration: 10, description: 'Query databases', preferences: { level: 'beginner', focusAreas: ['joins'] }, userId: user.email, ...body,
  });
}

/** Complete a day the only way there is: pass its quiz. */
async function passDay(planId, dayNumber) {
  complete.mockResolvedValueOnce(quizJson(5));
  await request(app).post('/api/skill-unlocker/day-quiz').set('Authorization', bearer()).send({ planId, dayNumber });
  const day = (await SkillPlan.findById(planId)).dailyPlan.find((d) => d.day === dayNumber);
  const res = await request(app).post('/api/skill-unlocker/day-quiz/submit').set('Authorization', bearer())
    .send({ planId, dayNumber, answers: day.quiz.questions.map((q) => q.correctAnswer) });
  expect(res.body.completed).toBe(true);
}

describe('Skill Unlocker workflow', () => {
  it('generates a plan with a video for every day', async () => {
    const res = await generatePlan();
    expect(res.status).toBe(201);
    expect(res.body.dailyPlan).toHaveLength(10);
    expect(res.body.dailyPlan[0]).toMatchObject({ day: 1, topic: 'Topic 1', completed: false, youtubeVideo: { videoId: 'vid00000001' } });
    expect(searchVideos).toHaveBeenCalledTimes(10);
  });

  it('bounds the duration', async () => {
    expect((await generatePlan(ALICE, { duration: 5 })).status).toBe(400);
    const huge = await request(app).post('/api/skill-unlocker/generate-plan').set('Authorization', bearer())
      .send({ skillName: 'SQL', duration: 100000, description: 'x' });
    expect(huge.status).toBe(400);
    expect(complete).not.toHaveBeenCalled();
  });

  it('reports an unusable plan from the model as a 502', async () => {
    complete.mockResolvedValueOnce('I cannot help with that.');
    const res = await request(app).post('/api/skill-unlocker/generate-plan').set('Authorization', bearer())
      .send({ skillName: 'SQL', duration: 10, description: 'x' });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('Failed to parse learning plan from AI');
  });

  it('tracks progress, quizzes on completed days and records the result', async () => {
    const { body: plan } = await generatePlan();
    const blocked = await request(app).post('/api/skill-unlocker/generate-quiz').set('Authorization', bearer()).send({ planId: plan.planId, skillName: 'SQL' });
    expect(blocked.status).toBe(400);

    await passDay(plan.planId, 1);

    const list = await request(app).get(`/api/skill-unlocker/plans/${ALICE.email}`).set('Authorization', bearer());
    expect(list.body.plans[0].progress).toBe(10);

    complete.mockResolvedValueOnce(quizJson(5));
    const quiz = await request(app).post('/api/skill-unlocker/generate-quiz').set('Authorization', bearer())
      .send({ planId: plan.planId, skillName: 'SQL', questionCount: 5 });
    expect(quiz.status).toBe(200);
    expect(quiz.body.configuration).toMatchObject({ completedDays: 1, totalDays: 10 });

    const saved = await request(app).post('/api/skill-unlocker/save-quiz-result').set('Authorization', bearer())
      .send({ quizId: quiz.body.quizId, planId: plan.planId, score: 80, totalQuestions: 5, difficulty: 'beginner' });
    expect(saved.status).toBe(200);
    const stored = await SkillPlan.findById(plan.planId);
    expect(stored.quizResults[0]).toMatchObject({ score: 80, correctAnswers: 4, totalQuestions: 5, completedDaysAtQuiz: 1 });
    expect(stored.quizScore).toBe(80);
  });

  it('completes a day only by passing its quiz, graded on the server', async () => {
    const { body: plan } = await generatePlan();
    const post = (path, body) => request(app).post(path).set('Authorization', bearer()).send({ planId: plan.planId, dayNumber: 1, ...body });

    // No ticking by hand.
    const manual = await post('/api/skill-unlocker/toggle-day-completion');
    expect(manual.status).toBe(409);
    expect(manual.body).toMatchObject({ code: 'QUIZ_REQUIRED', error: expect.stringContaining('50%') });
    expect((await post('/api/skill-unlocker/day-quiz/submit', { answers: [] })).status).toBe(409); // no quiz yet

    const callsBefore = complete.mock.calls.length;
    complete.mockResolvedValueOnce(quizJson(5));
    const quiz = await post('/api/skill-unlocker/day-quiz');
    expect(quiz.status).toBe(201);
    expect(quiz.body).toMatchObject({ day: 1, passPercent: 50 });
    expect(quiz.body.questions).toHaveLength(5);
    quiz.body.questions.forEach((q) => expect(q.correctAnswer).toBeUndefined());
    expect(complete.mock.calls.at(-1)[0].messages[1].content).toContain("Today's topic (ONLY test this)");
    // Asking again returns the same quiz, and the list never shows its answers.
    expect((await post('/api/skill-unlocker/day-quiz')).body.questions).toEqual(quiz.body.questions);
    expect(complete.mock.calls.length).toBe(callsBefore + 1);
    const listed = (await request(app).get(`/api/skill-unlocker/plans/${ALICE.email}`).set('Authorization', bearer())).body.plans[0];
    expect(listed.passPercent).toBe(50);
    expect(listed.dailyPlan[0]).toMatchObject({ completed: false, quizInProgress: true });
    expect(JSON.stringify(listed)).not.toContain('correctAnswer');

    const key = (await SkillPlan.findById(plan.planId)).dailyPlan[0].quiz.questions.map((q) => q.correctAnswer);
    const wrong = (k) => (k + 1) % 4;
    expect((await post('/api/skill-unlocker/day-quiz/submit', { answers: [0] })).status).toBe(400);

    // 2 of 5 (40%) fails: the attempt counts, the day stays open, a new quiz is needed.
    const fail = await post('/api/skill-unlocker/day-quiz/submit', { answers: key.map((k, i) => (i < 2 ? k : wrong(k))) });
    expect(fail.body).toMatchObject({ percentage: 40, passed: false, completed: false, completedDays: 0 });
    expect(fail.body.questions[0].correctAnswer).toBe(key[0]);
    expect((await post('/api/skill-unlocker/day-quiz/submit', { answers: key })).status).toBe(409); // that quiz is gone

    // 3 of 5 (60%) passes and completes the day.
    complete.mockResolvedValueOnce(quizJson(5));
    await post('/api/skill-unlocker/day-quiz');
    const key2 = (await SkillPlan.findById(plan.planId)).dailyPlan[0].quiz.questions.map((q) => q.correctAnswer);
    const pass = await post('/api/skill-unlocker/day-quiz/submit', { answers: key2.map((k, i) => (i < 3 ? k : wrong(k))) });
    expect(pass.body).toMatchObject({ percentage: 60, passed: true, completed: true, completedDays: 1, progress: 10 });
    expect(pass.body.dayState).toMatchObject({ completed: true, attempts: 2, bestScore: 60, lastScore: 60 });
    expect((await post('/api/skill-unlocker/day-quiz')).status).toBe(409); // already completed

    // Both attempts count on the profile.
    const profile = await request(app).get(`/api/profile/${encodeURIComponent(ALICE.email)}/overview`).set('Authorization', bearer());
    expect(JSON.stringify(profile.body)).toContain('Skill plans');

    // Another student cannot see or answer it.
    const asBob = (path, body) => request(app).post(path).set('Authorization', bearer(BOB)).send({ planId: plan.planId, dayNumber: 2, ...body });
    expect((await asBob('/api/skill-unlocker/day-quiz')).status).toBe(404);
    expect((await asBob('/api/skill-unlocker/day-quiz/submit', { answers: [] })).status).toBe(404);
  });

  it('refreshes one day’s video', async () => {
    const { body: plan } = await generatePlan();
    const res = await request(app).post('/api/skill-unlocker/refresh-video').set('Authorization', bearer()).send({ planId: plan.planId, dayNumber: 2 });
    expect(res.body.youtubeVideo.videoId).toBe('vid00000002');
    expect((await SkillPlan.findById(plan.planId)).dailyPlan[1].youtubeVideo.videoId).toBe('vid00000002');
  });

  it('keeps plans private to their owner', async () => {
    const { body: plan } = await generatePlan(ALICE);
    const asBob = (path, body) => request(app).post(path).set('Authorization', bearer(BOB)).send({ planId: plan.planId, ...body });
    expect((await asBob('/api/skill-unlocker/toggle-day-completion', { dayNumber: 1 })).status).toBe(404);
    expect((await asBob('/api/skill-unlocker/refresh-video', { dayNumber: 1 })).status).toBe(404);
    expect((await asBob('/api/skill-unlocker/save-quiz-result', { quizId: 'q', score: 100, totalQuestions: 5 })).status).toBe(404);
    expect((await request(app).delete(`/api/skill-unlocker/plans/${plan.planId}`).set('Authorization', bearer(BOB))).status).toBe(404);
    expect(await SkillPlan.countDocuments()).toBe(1);
  });

  it('deletes the owner’s plan', async () => {
    const { body: plan } = await generatePlan();
    const res = await request(app).delete(`/api/skill-unlocker/plans/${plan.planId}`).set('Authorization', bearer());
    expect(res.status).toBe(200);
    expect(await SkillPlan.countDocuments()).toBe(0);
  });
});
