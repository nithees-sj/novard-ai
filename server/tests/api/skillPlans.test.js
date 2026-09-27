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

    const toggled = await request(app).post('/api/skill-unlocker/toggle-day-completion').set('Authorization', bearer()).send({ planId: plan.planId, dayNumber: 1 });
    expect(toggled.body.completed).toBe(true);

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
