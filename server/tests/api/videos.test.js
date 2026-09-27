const request = require('supertest');

jest.mock('../../ai/groqClient', () => ({ complete: jest.fn() }));
jest.mock('../../ai/conversation', () => ({ ...jest.requireActual('../../ai/conversation'), converse: jest.fn() }));
jest.mock('../../services/youtubeService', () => ({
  ...jest.requireActual('../../services/youtubeService'),
  fetchVideoDetails: jest.fn(async () => ({ title: 'Docker in 100 seconds', description: 'Containers', transcript: 'docker '.repeat(10) })),
  searchVideos: jest.fn(),
}));
jest.mock('youtube-search-api', () => ({ GetListByKeyword: jest.fn() }));

const youtubeSearch = require('youtube-search-api');
const { complete } = require('../../ai/groqClient');
const { converse } = require('../../ai/conversation');
const { createApp } = require('../../app');
const YouTubeVideo = require('../../models/youtubeVideo');
const Video = require('../../models/video');
const { useTestDatabase } = require('../helpers/db');
const { ALICE, BOB, bearer } = require('../helpers/auth');
const { quizJson } = require('../helpers/fixtures');

useTestDatabase();
const app = createApp();
afterEach(() => {
  jest.clearAllMocks();
  complete.mockReset(); // also drops queued mockResolvedValueOnce values
});

const addVideo = (user = ALICE, videoUrl = 'https://www.youtube.com/watch?v=Gjnup-PuquQ') => request(app)
  .post('/youtube-videos').set('Authorization', bearer(user)).send({ title: 'Docker', videoUrl, userId: user.email });

describe('Video Summarizer workflow', () => {
  it('adds a YouTube video without sending its transcript back', async () => {
    const res = await addVideo();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Docker', videoId: 'Gjnup-PuquQ', videoUrl: 'https://www.youtube.com/watch?v=Gjnup-PuquQ' });
    expect(res.body.transcript).toBeUndefined();
    expect((await YouTubeVideo.findById(res.body._id)).transcript).toMatch(/docker/);
  });

  it('uses the video’s own YouTube title when none is given', async () => {
    const res = await request(app).post('/youtube-videos').set('Authorization', bearer())
      .send({ videoUrl: 'https://youtu.be/Gjnup-PuquQ' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Docker in 100 seconds');
  });

  it('asks for a link when none is given', async () => {
    const res = await request(app).post('/youtube-videos').set('Authorization', bearer()).send({ title: 'Docker' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Paste a YouTube link to add a video.');
  });

  it('rejects duplicates and invalid URLs', async () => {
    await addVideo();
    expect((await addVideo()).body.error).toBe('This video has already been added');
    expect((await addVideo(ALICE, 'https://example.com/video')).status).toBe(400);
  });

  it('lists only the student’s own videos, without transcripts or server paths', async () => {
    await addVideo(ALICE);
    await addVideo(BOB);
    const res = await request(app).get(`/youtube-videos/${ALICE.email}`).set('Authorization', bearer());
    expect(res.body).toHaveLength(1);
    expect(res.body[0].transcript).toBeUndefined();
    expect(res.body[0].videoPath).toBeUndefined();
  });

  it('chats, summarises (once) and quizzes on a video', async () => {
    const { body: video } = await addVideo();
    converse.mockResolvedValue('Containers package apps.');
    const chat = await request(app).post('/chat-with-youtube-video').set('Authorization', bearer()).send({ videoId: video._id, message: 'What is Docker?' });
    expect(chat.body.response).toBe('Containers package apps.');

    complete.mockResolvedValueOnce('### Docker summary');
    const summary = await request(app).post('/summarize-youtube-video').set('Authorization', bearer()).send({ videoId: video._id });
    expect(summary.body.summary).toBe('### Docker summary');
    await request(app).post('/summarize-youtube-video').set('Authorization', bearer()).send({ videoId: video._id });
    expect(complete).toHaveBeenCalledTimes(1);

    complete.mockResolvedValueOnce(quizJson(5));
    const quiz = await request(app).post('/generate-youtube-quiz').set('Authorization', bearer()).send({ videoId: video._id, questionCount: 5 });
    expect(quiz.body.quizIndex).toBe(0);
    const saved = await request(app).post('/save-youtube-quiz-results').set('Authorization', bearer()).send({ videoId: video._id, quizIndex: 0, score: 3 });
    expect(saved.status).toBe(200);
    expect((await YouTubeVideo.findById(video._id)).quizzes[0].score).toBe(3);
  });

  it('keeps videos private to their owner', async () => {
    const { body: video } = await addVideo(ALICE);
    const asBob = (path, body = {}) => request(app).post(path).set('Authorization', bearer(BOB)).send({ videoId: video._id, ...body });
    expect((await asBob('/chat-with-youtube-video', { message: 'hi' })).status).toBe(404);
    expect((await asBob('/summarize-youtube-video')).status).toBe(404);
    expect((await request(app).delete(`/youtube-videos/${video._id}`).set('Authorization', bearer(BOB))).status).toBe(404);
  });

  it('deletes a video', async () => {
    const { body: video } = await addVideo();
    const res = await request(app).delete(`/youtube-videos/${video._id}`).set('Authorization', bearer()).send({ userId: ALICE.email });
    expect(res.body).toEqual({ success: true });
    expect(await YouTubeVideo.countDocuments()).toBe(0);
  });
});

describe('Video Library workflow', () => {
  const createRequest = (user = ALICE, body = {}) => request(app)
    .post('/educational-video-requests').set('Authorization', bearer(user))
    .send({ title: 'Learn SQL joins', description: 'Beginner, focus on inner vs left joins', platform: 'youtube', ...body });

  it('creates, lists and deletes learning requests', async () => {
    const created = await createRequest();
    expect(created.status).toBe(201);
    const list = await request(app).get(`/educational-video-requests/${ALICE.email}`).set('Authorization', bearer());
    expect(list.body).toHaveLength(1);
    const removed = await request(app).delete(`/educational-video-requests/${created.body._id}`).set('Authorization', bearer());
    expect(removed.status).toBe(200);
    expect(await Video.countDocuments()).toBe(0);
  });

  it('validates platform and lengths, and protects other students’ requests', async () => {
    expect((await createRequest(ALICE, { platform: 'myspace' })).status).toBe(400);
    expect((await createRequest(ALICE, { title: 'x'.repeat(201) })).status).toBe(400);
    const { body } = await createRequest(ALICE);
    expect((await request(app).delete(`/educational-video-requests/${body._id}`).set('Authorization', bearer(BOB))).status).toBe(404);
  });

  it('recommends YouTube videos, most viewed first', async () => {
    complete.mockResolvedValue('["sql joins", "left join"]');
    youtubeSearch.GetListByKeyword.mockImplementation(async (keyword) => ({
      items: [
        { type: 'video', id: `${keyword.replace(/\W/g, '')}1`.padEnd(11, 'x'), title: `${keyword} basics`, viewCount: keyword.length, length: { seconds: 125 } },
        { type: 'video', id: 'live-stream', isLive: true, title: 'live' },
      ],
    }));
    const res = await request(app).post('/recommend-educational-videos').set('Authorization', bearer())
      .send({ title: 'Learn SQL joins', description: 'inner vs left', platform: 'youtube' });
    expect(res.status).toBe(200);
    expect(res.body.videos).toHaveLength(2);
    expect(res.body.videos[0]).toMatchObject({ title: 'sql joins basics', duration: '2:05', platform: 'youtube' });
    expect(res.body.videos.some((v) => v.title === 'live')).toBe(false);
  });

  it('falls back to known courses (with safe links only) for older course requests', async () => {
    complete.mockResolvedValue('["python"]');
    const res = await request(app).post('/recommend-educational-videos').set('Authorization', bearer())
      .send({ title: 'Python', description: 'basics', platform: 'coursera' });
    expect(res.status).toBe(200);
    expect(res.body.videos.length).toBeGreaterThan(0);
    res.body.videos.forEach((v) => expect(v.url).toMatch(/^https:\/\//));
  });
});
