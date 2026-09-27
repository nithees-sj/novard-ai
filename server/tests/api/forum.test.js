const request = require('supertest');

jest.mock('../../services/forumAIService', () => ({
  generateAICommentForIssue: jest.fn(async () => 'AI first answer'),
  generateAIResponseToComment: jest.fn(async () => 'AI reply'),
}));

const { generateAIResponseToComment } = require('../../services/forumAIService');
const { createApp } = require('../../app');
const ForumIssue = require('../../models/forumIssue');
const ForumComment = require('../../models/forumComment');
const { useTestDatabase } = require('../helpers/db');
const { ALICE, BOB, bearer } = require('../helpers/auth');

useTestDatabase();
const app = createApp();
afterEach(() => jest.clearAllMocks());

/** The AI's background reply is fire-and-forget; wait until it has been written. */
const settle = () => new Promise((resolve) => { setTimeout(resolve, 50); });

const openIssue = (user = ALICE, body = {}) => request(app).post('/api/forum/issues').set('Authorization', bearer(user))
  .send({ title: 'Docker volume permissions', description: 'My container cannot write to the volume.', category: 'urgent', tags: ['Docker', 'docker', 'volumes'], ...body });

describe('AI Forum workflow', () => {
  it('opens a discussion as the signed-in student, whatever the body claims', async () => {
    const res = await openIssue(ALICE, { userEmail: ALICE.email, userName: 'Impostor' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ userEmail: ALICE.email, userName: ALICE.name, category: 'urgent', tags: ['docker', 'volumes'], commentsCount: 0 });
    await settle();
    expect(await ForumComment.countDocuments({ issueId: res.body.issueId, isAI: true })).toBe(1);
  });

  it('refuses to post as another student', async () => {
    const res = await openIssue(ALICE, { userEmail: BOB.email });
    expect(res.status).toBe(403);
  });

  it('validates category and length', async () => {
    expect((await openIssue(ALICE, { category: 'memes' })).status).toBe(400);
    expect((await openIssue(ALICE, { title: 'x'.repeat(201) })).status).toBe(400);
  });

  it('lists with filters, search (literal) and paging', async () => {
    await openIssue(ALICE, { title: 'C++ templates', category: 'tutorial' });
    await openIssue(BOB, { title: 'React hooks', category: 'general' });
    await settle();

    const all = await request(app).get('/api/forum/issues').set('Authorization', bearer());
    expect(all.body.total).toBe(2);
    expect(all.body.issues[0].commentsCount).toBe(1);

    const search = await request(app).get('/api/forum/issues').query({ q: 'C++' }).set('Authorization', bearer());
    expect(search.body.issues.map((i) => i.title)).toEqual(['C++ templates']);

    const tutorial = await request(app).get('/api/forum/issues').query({ category: 'tutorial', status: 'open' }).set('Authorization', bearer());
    expect(tutorial.body.total).toBe(1);

    const bad = await request(app).get('/api/forum/issues').query({ status: 'weird' }).set('Authorization', bearer());
    expect(bad.status).toBe(400);
  });

  it('threads replies and lets the AI answer', async () => {
    const { body: issue } = await openIssue();
    await settle();
    const reply = await request(app).post('/api/forum/comments').set('Authorization', bearer(BOB))
      .send({ issueId: issue.issueId, content: 'Check the UID of the volume.' });
    expect(reply.status).toBe(201);
    expect(reply.body).toMatchObject({ userEmail: BOB.email, userName: BOB.name });
    await settle();

    const thread = await request(app).get(`/api/forum/issues/${issue.issueId}/comments`).set('Authorization', bearer());
    expect(thread.body.total).toBe(3); // AI answer, Bob's reply, AI reply to Bob
    expect(thread.body.comments.find((c) => c.parentCommentId === reply.body._id)?.isAI).toBe(true);

    const onDemand = await request(app).post(`/api/forum/comments/${reply.body._id}/ai-response`).set('Authorization', bearer());
    expect(onDemand.status).toBe(201);
    expect(generateAIResponseToComment).toHaveBeenCalledTimes(2);
  });

  it('rejects a reply to a comment from another discussion', async () => {
    const { body: one } = await openIssue();
    const { body: two } = await openIssue(BOB, { title: 'Other' });
    await settle();
    const [aiInTwo] = await ForumComment.find({ issueId: two.issueId });
    const res = await request(app).post('/api/forum/comments').set('Authorization', bearer())
      .send({ issueId: one.issueId, content: 'hi', parentCommentId: String(aiInTwo._id) });
    expect(res.status).toBe(400);
  });

  it('lets only the author change the status, and blocks replies once closed', async () => {
    const { body: issue } = await openIssue();
    const byBob = await request(app).put(`/api/forum/issues/${issue.issueId}/status`).set('Authorization', bearer(BOB)).send({ status: 'closed' });
    expect(byBob.status).toBe(403);

    const byAlice = await request(app).put(`/api/forum/issues/${issue.issueId}/status`).set('Authorization', bearer()).send({ status: 'closed' });
    expect(byAlice.body.status).toBe('closed');

    const reply = await request(app).post('/api/forum/comments').set('Authorization', bearer(BOB)).send({ issueId: issue.issueId, content: 'late' });
    expect(reply.status).toBe(409);
  });

  it('lets only the author delete, removing every reply', async () => {
    const { body: issue } = await openIssue();
    await settle();
    expect((await request(app).delete(`/api/forum/issues/${issue.issueId}`).set('Authorization', bearer(BOB))).status).toBe(403);
    const res = await request(app).delete(`/api/forum/issues/${issue.issueId}`).set('Authorization', bearer());
    expect(res.body).toMatchObject({ success: true, deletedComments: 1 });
    expect(await ForumIssue.countDocuments()).toBe(0);
    expect(await ForumComment.countDocuments()).toBe(0);
  });

  it('returns 404 for a missing discussion', async () => {
    const res = await request(app).get('/api/forum/issues/ISSUE_nope').set('Authorization', bearer());
    expect(res.status).toBe(404);
  });
});
