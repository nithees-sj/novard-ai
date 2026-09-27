const request = require('supertest');

jest.mock('../../ai/groqClient', () => ({ complete: jest.fn() }));
jest.mock('../../ai/conversation', () => ({
  ...jest.requireActual('../../ai/conversation'),
  converse: jest.fn(async ({ Model, filter, field, input }) => {
    // Behave like the real memory: store both messages.
    const now = Date.now();
    await Model.updateOne(filter, { $push: { [field]: { $each: [
      { role: 'user', content: input, createdAt: new Date(now) },
      { role: 'assistant', content: 'Start with Docker.', createdAt: new Date(now + 1) },
    ] } } });
    return 'Start with Docker.';
  }),
}));

const { complete } = require('../../ai/groqClient');
const { createApp } = require('../../app');
const Roadmap = require('../../models/roadmap');
const SkillGapSession = require('../../models/skillGapSession');
const { useTestDatabase } = require('../helpers/db');
const { ALICE, BOB, bearer } = require('../helpers/auth');

useTestDatabase();
const app = createApp();
afterEach(() => {
  jest.clearAllMocks();
  complete.mockReset();
});

const roadmapJson = JSON.stringify({
  summary: 'From basics to deployment.',
  stages: ['Foundations', 'Containers', 'CI/CD', 'Cloud'].map((title, i) => ({
    title,
    weeks: 4,
    objective: `Objective ${i}`,
    topics: [{ name: `${title} A`, type: 'core' }, { name: `${title} B`, type: 'optional' }, { name: 'Linux', type: 'core' }],
    project: { title: `${title} project`, description: 'Build it.', skills: ['bash'] },
    milestone: 'Done.',
  })),
  careerTips: ['Build a portfolio.'],
});

const analysisJson = JSON.stringify({
  summary: 'You have the basics.',
  skills: ['Linux', 'Git', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD'].map((skill, i) => ({
    skill, importance: i < 4 ? 'core' : 'nice', have: i < 2, why: 'Needed.', priority: 'high', effortWeeks: 3, firstStep: 'Start.',
  })),
  nextSteps: ['Install Docker'],
});

describe('Smart Roadmap', () => {
  const generate = (user = ALICE) => {
    complete.mockResolvedValueOnce(roadmapJson);
    return request(app).post('/api/roadmaps/generate').set('Authorization', bearer(user))
      .send({ role: 'DevOps Engineer', level: 'beginner', knownSkills: ['Linux'], timelineMonths: 4, hoursPerWeek: 10 });
  };

  it('generates, lists, opens and deletes a roadmap', async () => {
    const created = await generate();
    expect(created.status).toBe(201);
    expect(created.body.stages).toHaveLength(4);
    expect(created.body.mermaid).toMatch(/^%%\{init/);
    expect(created.body.stages[0].topics.find((t) => t.name === 'Linux').known).toBe(true);

    const list = await request(app).get(`/api/roadmaps/user/${ALICE.email}`).set('Authorization', bearer());
    expect(list.body).toEqual([expect.objectContaining({ role: 'DevOps Engineer', stageCount: 4 })]);

    const one = await request(app).get(`/api/roadmaps/${created.body._id}`).set('Authorization', bearer());
    expect(one.body.mermaid).toBeTruthy();

    const del = await request(app).delete(`/api/roadmaps/${created.body._id}`).set('Authorization', bearer());
    expect(del.body).toEqual({ success: true });
    expect(await Roadmap.countDocuments()).toBe(0);
  });

  it('requires a role, and keeps roadmaps private', async () => {
    const noRole = await request(app).post('/api/roadmaps/generate').set('Authorization', bearer()).send({ role: '' });
    expect(noRole.status).toBe(400);
    const { body } = await generate(ALICE);
    expect((await request(app).get(`/api/roadmaps/${body._id}`).set('Authorization', bearer(BOB))).status).toBe(404);
    expect((await request(app).delete(`/api/roadmaps/${body._id}`).set('Authorization', bearer(BOB))).status).toBe(404);
  });

  it('reports a model that never returns a usable roadmap as a 502', async () => {
    complete.mockResolvedValue('{"stages": []}');
    const res = await request(app).post('/api/roadmaps/generate').set('Authorization', bearer()).send({ role: 'DevOps Engineer' });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/could not be generated/);
  });
});

describe('Skill Gap coach', () => {
  const start = (user = ALICE) => {
    complete.mockResolvedValueOnce(analysisJson);
    return request(app).post('/api/skill-gap/sessions').set('Authorization', bearer(user))
      .send({ targetRole: 'DevOps Engineer', currentSkills: 'Linux, Git', experience: 'junior' });
  };

  it('analyses a profile with computed readiness, then coaches in a chat', async () => {
    const session = await start();
    expect(session.status).toBe(201);
    // core skills count double: have Linux+Git (2+2) of 4 core (8) + 2 nice (2) = 4/10
    expect(session.body.analysis.readiness).toBe(40);
    expect(session.body.messages).toHaveLength(1);

    const reply = await request(app).post(`/api/skill-gap/sessions/${session.body._id}/messages`).set('Authorization', bearer())
      .send({ message: 'What first?' });
    expect(reply.status).toBe(200);
    expect(reply.body.userMessage.content).toBe('What first?');
    expect(reply.body.assistantMessage.content).toBe('Start with Docker.');

    const list = await request(app).get(`/api/skill-gap/sessions/user/${ALICE.email}`).set('Authorization', bearer());
    expect(list.body[0]).toMatchObject({ targetRole: 'DevOps Engineer', readiness: 40, messageCount: 3 });
  });

  it('keeps sessions private and validates messages', async () => {
    const { body } = await start(ALICE);
    expect((await request(app).get(`/api/skill-gap/sessions/${body._id}`).set('Authorization', bearer(BOB))).status).toBe(404);
    const empty = await request(app).post(`/api/skill-gap/sessions/${body._id}/messages`).set('Authorization', bearer()).send({ message: '  ' });
    expect(empty.status).toBe(400);
    expect((await request(app).delete(`/api/skill-gap/sessions/${body._id}`).set('Authorization', bearer(BOB))).status).toBe(404);
    expect((await request(app).delete(`/api/skill-gap/sessions/${body._id}`).set('Authorization', bearer())).status).toBe(200);
    expect(await SkillGapSession.countDocuments()).toBe(0);
  });
});
