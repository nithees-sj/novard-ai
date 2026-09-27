const fs = require('fs');
const path = require('path');
const request = require('supertest');

jest.mock('../../ai/groqClient', () => ({ complete: jest.fn() }));
jest.mock('../../ai/conversation', () => ({
  ...jest.requireActual('../../ai/conversation'),
  converse: jest.fn(),
}));

const { complete } = require('../../ai/groqClient');
const { converse } = require('../../ai/conversation');
const { createApp } = require('../../app');
const Notes = require('../../models/notes');
const { env } = require('../../config/env');
const { resolveStoredPath } = require('../../utils/uploads');
const { useTestDatabase } = require('../helpers/db');
const { ALICE, BOB, bearer } = require('../helpers/auth');
const { makePdf } = require('../helpers/pdf');
const { quizJson } = require('../helpers/fixtures');

useTestDatabase();
const app = createApp();

afterEach(() => {
  jest.clearAllMocks();
  complete.mockReset(); // also drops queued mockResolvedValueOnce values
});
afterAll(() => fs.rmSync(env.uploadDir, { recursive: true, force: true }));

const upload = (user = ALICE, file = makePdf('Photosynthesis converts light energy into chemical energy.'), name = 'biology.pdf') => request(app)
  .post('/upload-notes')
  .set('Authorization', bearer(user))
  .field('title', name)
  .field('userId', user.email)
  .attach('pdf', file, { filename: name, contentType: 'application/pdf' });

describe('Notes & Quiz workflow', () => {
  it('uploads a PDF, extracts its text and returns the note with its _id', async () => {
    const res = await upload();

    expect(res.status).toBe(201);
    // The page selects the returned note straight away, so it must carry _id.
    expect(res.body).toMatchObject({ title: 'biology.pdf', fileName: 'biology.pdf', summary: '', chatHistory: [], quizzes: [] });
    expect(res.body._id).toBeTruthy();
    expect(res.body.extractedText).toBeUndefined();

    const note = await Notes.findById(res.body._id);
    expect(note.userId).toBe(ALICE.email);
    expect(note.extractedText).toMatch(/Photosynthesis/);
    expect(fs.existsSync(resolveStoredPath(note.filePath))).toBe(true);
    expect(resolveStoredPath(note.filePath).startsWith(env.uploadDir)).toBe(true);
  });

  it('refuses a file that only claims to be a PDF, and deletes it', async () => {
    const before = fs.existsSync(path.join(env.uploadDir, 'notes')) ? fs.readdirSync(path.join(env.uploadDir, 'notes')).length : 0;
    const res = await upload(ALICE, Buffer.from('not really a pdf'), 'fake.pdf');
    expect(res.status).toBe(415);
    expect(fs.readdirSync(path.join(env.uploadDir, 'notes'))).toHaveLength(before);
    expect(await Notes.countDocuments()).toBe(0);
  });

  it('refuses non-PDF uploads', async () => {
    const res = await request(app).post('/upload-notes').set('Authorization', bearer())
      .attach('pdf', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(res.status).toBe(415);
    expect(res.body.error).toBe('Only PDF files are allowed');
  });

  it('requires sign-in to upload', async () => {
    const res = await request(app).post('/upload-notes').attach('pdf', makePdf('x'), 'a.pdf');
    expect(res.status).toBe(401);
  });

  it('lists only the student’s own notes, without the extracted text', async () => {
    await upload(ALICE);
    await upload(BOB);
    const res = await request(app).get(`/notes/${ALICE.email}`).set('Authorization', bearer(ALICE));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].extractedText).toBeUndefined();
    expect(res.body[0].memory).toBeUndefined();
  });

  it('refuses to list another student’s notes', async () => {
    const res = await request(app).get(`/notes/${BOB.email}`).set('Authorization', bearer(ALICE));
    expect(res.status).toBe(403);
  });

  it('chats with a note, grounded in its text', async () => {
    const { body: note } = await upload();
    converse.mockResolvedValue('It turns light into chemical energy.');

    const res = await request(app).post('/chat-with-notes').set('Authorization', bearer())
      .send({ noteId: note._id, message: 'What is photosynthesis?' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ response: 'It turns light into chemical energy.', noteId: note._id });
    const call = converse.mock.calls[0][0];
    expect(call.system).toMatch(/Photosynthesis converts light/);
    expect(call.filter).toEqual({ _id: expect.anything(), userId: ALICE.email });
  });

  it('does not let another student chat with, summarise, quiz or delete the note', async () => {
    const { body: note } = await upload(ALICE);
    const asBob = (req) => req.set('Authorization', bearer(BOB));

    expect((await asBob(request(app).post('/chat-with-notes')).send({ noteId: note._id, message: 'hi' })).status).toBe(404);
    expect((await asBob(request(app).post('/summarize-notes')).send({ noteId: note._id })).status).toBe(404);
    expect((await asBob(request(app).post('/generate-quiz')).send({ noteId: note._id })).status).toBe(404);
    expect((await asBob(request(app).delete(`/notes/${note._id}`))).status).toBe(404);
    expect(await Notes.countDocuments()).toBe(1);
    expect(converse).not.toHaveBeenCalled();
  });

  it('rejects an invalid note id with 400 instead of a server error', async () => {
    const res = await request(app).post('/chat-with-notes').set('Authorization', bearer()).send({ noteId: { $ne: null }, message: 'hi' });
    expect(res.status).toBe(400);
  });

  it('summarises a note and stores the summary', async () => {
    const { body: note } = await upload();
    complete.mockResolvedValue('### Photosynthesis\nLight to energy.');
    const res = await request(app).post('/summarize-notes').set('Authorization', bearer()).send({ noteId: note._id });
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatch(/Photosynthesis/);
    expect((await Notes.findById(note._id)).summary).toMatch(/Photosynthesis/);
  });

  it('generates a quiz, then saves the submitted score', async () => {
    const { body: note } = await upload();
    complete.mockResolvedValue(quizJson(5));

    const quiz = await request(app).post('/generate-quiz').set('Authorization', bearer())
      .send({ noteId: note._id, questionCount: 5, difficulty: 'beginner' });
    expect(quiz.status).toBe(200);
    expect(quiz.body.quiz).toHaveLength(5);
    expect(quiz.body.settings).toMatchObject({ questionCount: 5, difficulty: 'beginner' });

    const saved = await request(app).post('/save-quiz-results').set('Authorization', bearer())
      .send({ noteId: note._id, quizId: quiz.body.quizId, userAnswers: { 0: 1, 1: 2 }, score: { correct: 4, total: 5, percentage: 80 } });
    expect(saved.status).toBe(200);

    const stored = (await Notes.findById(note._id)).quizzes[0];
    expect(stored.score.toObject()).toEqual({ correct: 4, total: 5, percentage: 80 });
    expect(stored.attemptedAt).toBeInstanceOf(Date);
  });

  it('validates a submitted score', async () => {
    const { body: note } = await upload();
    const res = await request(app).post('/save-quiz-results').set('Authorization', bearer())
      .send({ noteId: note._id, quizId: '1', userAnswers: {}, score: { correct: 9, total: 5 } });
    expect(res.status).toBe(400);
  });

  it('deletes a note and its file', async () => {
    const { body: note } = await upload();
    const file = resolveStoredPath((await Notes.findById(note._id)).filePath);
    const res = await request(app).delete(`/notes/${note._id}`).set('Authorization', bearer());
    expect(res.status).toBe(200);
    expect(await Notes.countDocuments()).toBe(0);
    expect(fs.existsSync(file)).toBe(false);
  });
});
