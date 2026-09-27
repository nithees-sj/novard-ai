const request = require('supertest');
const { createApp } = require('../../app');
const AppUsage = require('../../models/appUsage');
const Notes = require('../../models/notes');
const SkillPlan = require('../../models/skillPlan');
const User = require('../../models/user');
const { issueSessionToken } = require('../../services/authService');
const { useTestDatabase } = require('../helpers/db');
const { ALICE, BOB, bearer } = require('../helpers/auth');

useTestDatabase();
const app = createApp();

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('study-time heartbeat', () => {
  it('accepts sendBeacon-style text/plain bodies carrying the token', async () => {
    const body = JSON.stringify({ token: issueSessionToken(ALICE), day: today(), seconds: 60 });
    const res = await request(app).post('/api/usage/heartbeat').set('Content-Type', 'text/plain').send(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ day: today(), seconds: 60 });
  });

  it('accepts a bearer header and adds up, capped per beat', async () => {
    await request(app).post('/api/usage/heartbeat').set('Authorization', bearer()).send({ day: today(), seconds: 60 });
    const res = await request(app).post('/api/usage/heartbeat').set('Authorization', bearer()).send({ day: today(), seconds: 99999 });
    expect(res.body.seconds).toBe(60 + 300);
    expect(await AppUsage.countDocuments({ userId: ALICE.email })).toBe(1);
  });

  it('never books more than a day', async () => {
    await AppUsage.create({ userId: ALICE.email, day: today(), seconds: 86350 });
    const res = await request(app).post('/api/usage/heartbeat').set('Authorization', bearer()).send({ day: today(), seconds: 200 });
    expect(res.body.seconds).toBe(86400);
  });

  it('rejects anonymous beats, bad days and bad bodies', async () => {
    expect((await request(app).post('/api/usage/heartbeat').send({ day: today(), seconds: 5 })).status).toBe(401);
    expect((await request(app).post('/api/usage/heartbeat').set('Authorization', bearer()).send({ day: '2001-01-01', seconds: 5 })).status).toBe(400);
    expect((await request(app).post('/api/usage/heartbeat').set('Authorization', bearer()).send({ day: today(), seconds: -1 })).status).toBe(400);
    expect((await request(app).post('/api/usage/heartbeat').set('Content-Type', 'text/plain').send('{not json')).status).toBe(400);
  });
});

describe('dashboard, profile and quiz history', () => {
  async function seed() {
    await User.create({ email: ALICE.email, name: ALICE.name });
    const note = await Notes.create({
      userId: ALICE.email,
      title: 'React hooks',
      fileName: 'hooks.pdf',
      filePath: 'uploads/notes/x.pdf',
      extractedText: 'useEffect',
      chatHistory: [{ role: 'user', content: 'q' }, { role: 'assistant', content: 'a' }],
      quizzes: [
        { quizId: '1', questions: [], score: { correct: 8, total: 10, percentage: 80 }, attemptedAt: new Date() },
        { quizId: '2', questions: [] }, // generated, never taken
      ],
    });
    await SkillPlan.create({
      userId: ALICE.email, skillName: 'SQL', duration: 10, description: 'd',
      dailyPlan: Array.from({ length: 10 }, (_, i) => ({ day: i + 1, topic: 't', objective: 'o', completed: i < 5, completedAt: i < 5 ? new Date() : undefined })),
    });
    return note;
  }

  it('builds the dashboard from the student’s own activity', async () => {
    await seed();
    const res = await request(app).get(`/api/analytics/${ALICE.email}`).query({ tzOffset: -330 }).set('Authorization', bearer());
    expect(res.status).toBe(200);
    expect(res.body.hasActivity).toBe(true);
    expect(res.body.quizPerformance).toMatchObject({ quizzesTaken: 1, questionsAnswered: 10, correctAnswers: 8, accuracy: 80 });
    expect(res.body.courseCompletion).toMatchObject({ completedDays: 5, totalDays: 10, percentage: 50 });
    expect(res.body.studyStreak.activeToday).toBe(true);
    expect(res.body.weeklyActivity.days).toHaveLength(7);
  });

  it('returns an empty dashboard for a new student, and refuses other students', async () => {
    const empty = await request(app).get(`/api/analytics/${BOB.email}`).set('Authorization', bearer(BOB));
    expect(empty.body).toMatchObject({ hasActivity: false, quizPerformance: { accuracy: null, quizzesTaken: 0 } });
    expect((await request(app).get(`/api/analytics/${ALICE.email}`).set('Authorization', bearer(BOB))).status).toBe(403);
  });

  it('builds the profile overview', async () => {
    await seed();
    const res = await request(app).get(`/api/profile/${encodeURIComponent(ALICE.email)}/overview`).set('Authorization', bearer());
    expect(res.status).toBe(200);
    expect(res.body.account).toMatchObject({ name: ALICE.name, email: ALICE.email });
    expect(res.body.overview.testsTaken).toBe(1);
    expect(res.body.learningPath.plans[0]).toMatchObject({ name: 'SQL', completedDays: 5, percentage: 50, status: 'in-progress' });
    expect(res.body.activity.heatmap.days.length).toBeGreaterThan(300);
  });

  it('returns previous marks for one item, counting only submitted quizzes', async () => {
    const note = await seed();
    const res = await request(app).get(`/api/quiz-history/notes/${note._id}`).query({ userId: ALICE.email }).set('Authorization', bearer());
    expect(res.status).toBe(200);
    expect(res.body.attempts).toHaveLength(1);
    expect(res.body.stats).toMatchObject({ count: 1, best: 80 });

    expect((await request(app).get(`/api/quiz-history/notes/${note._id}`).set('Authorization', bearer(BOB))).status).toBe(404);
    expect((await request(app).get(`/api/quiz-history/nope/${note._id}`).set('Authorization', bearer())).status).toBe(400);
  });
});
