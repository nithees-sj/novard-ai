const mockCreate = jest.fn();
const mockTranscribe = jest.fn();
jest.mock('groq-sdk', () => {
  const Groq = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
    audio: { transcriptions: { create: mockTranscribe } },
  }));
  Groq.default = Groq;
  return Groq;
});

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../../app');
const Report = require('../../models/report');
const Notification = require('../../models/notification');
const Notes = require('../../models/notes');
const AdminAuditLog = require('../../models/adminAuditLog');
const settings = require('../../services/settingsService');
const { resolveReports } = require('../../services/reportService');
const { enrichPending } = require('../../services/reportEnrichment');
const { env } = require('../../config/env');
const { useTestDatabase } = require('../helpers/db');
const { ALICE, BOB, bearer, adminBearer } = require('../helpers/auth');

useTestDatabase();
const app = createApp();
const system = { email: 'root@example.com', role: 'superadmin' };

const enrichReply = (fields = {}) => ({
  choices: [{ message: { content: JSON.stringify({ area: 'video-summarizer', urgency: 'high', sentiment: -0.7, intent: 'bug', topic: 'missing video captions', isRepeat: false, ...fields }) } }],
  usage: { prompt_tokens: 300, completion_tokens: 40 },
});

beforeEach(() => mockCreate.mockResolvedValue(enrichReply()));
afterEach(() => {
  mockCreate.mockReset();
  mockTranscribe.mockReset();
  settings._reset();
});
afterAll(() => fs.rmSync(env.uploadDir, { recursive: true, force: true }));

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(64, 2)]);
const reportsDir = () => path.join(env.uploadDir, 'reports');
const storedFiles = () => (fs.existsSync(reportsDir()) ? fs.readdirSync(reportsDir()) : []);

function submit({ user = ALICE, area = 'video-summarizer', text = 'The summary of my video is empty and captions are missing.', source, files = {} } = {}) {
  const req = request(app).post(`/api/reports?area=${area}`).set('Authorization', bearer(user)).field('text', text);
  if (source) req.field('source', JSON.stringify(source));
  Object.entries(files).forEach(([field, { buffer, name, type }]) => req.attach(field, buffer, { filename: name, contentType: type }));
  return req;
}


describe('POST /api/reports', () => {
  it('saves the report, triages it and returns its reference', async () => {
    const res = await submit();
    expect(res.status).toBe(201);
    expect(res.body.ref).toMatch(/^NV-[0-9A-F]{8}$/);
    expect(res.body).toMatchObject({ area: 'video-summarizer', areaLabel: 'Video Summarizer', status: 'open', channel: 'text' });

    const saved = await Report.findOne({ ref: res.body.ref }).lean();
    expect(saved.enrichment).toMatchObject({ status: 'done', urgency: 'high', intent: 'bug', topic: 'missing video captions', sentiment: -0.7 });
    expect(saved.userId).toBe(ALICE.email);
    // The model is told the allowed values in words; Groq JSON mode, no strict schema.
    expect(mockCreate.mock.calls[0][0].response_format).toEqual({ type: 'json_object' });
  });

  it('is saved even when the model is down, and the batch pass enriches it later', async () => {
    mockCreate.mockRejectedValue(Object.assign(new Error('503 Service Unavailable'), { status: 503 }));
    const res = await submit();
    expect(res.status).toBe(201);
    expect((await Report.findOne({ ref: res.body.ref })).enrichment.status).toBe('failed');

    mockCreate.mockReset().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ items: [{ i: 0, area: 'video-summarizer', urgency: 'medium', sentiment: -0.4, intent: 'bug', topic: 'empty summary', isRepeat: false }] }) } }],
      usage: { prompt_tokens: 100, completion_tokens: 30 },
    });
    expect(await enrichPending()).toMatchObject({ done: 1, failed: 0 });
    expect((await Report.findOne({ ref: res.body.ref })).enrichment).toMatchObject({ status: 'done', topic: 'empty summary' });
  });

  it('enforces the open-report quota BEFORE the upload is parsed or a model is called', async () => {
    expect((await submit()).status).toBe(201);
    expect((await submit()).status).toBe(201);
    mockCreate.mockClear();
    const before = storedFiles().length;

    const res = await submit({ files: { screenshot: { buffer: PNG, name: 'shot.png', type: 'image/png' } } });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('REPORT_QUOTA');
    expect(res.body.error).toMatch(/add to your existing report \(NV-[0-9A-F]{8}\) instead/);
    expect(storedFiles().length).toBe(before); // multer never ran
    expect(mockCreate).not.toHaveBeenCalled();

    // Other areas are unaffected.
    expect((await submit({ area: 'notes', text: 'My PDF upload keeps failing.' })).status).toBe(201);
  });

  it('frees a quota slot when a report is resolved', async () => {
    const first = await submit();
    await submit();
    await resolveReports({ refs: [first.body.ref], actor: system });
    expect((await submit()).status).toBe(201);
  });

  it('never lets two simultaneous reports take the last slot', async () => {
    await submit();
    const [a, b] = await Promise.all([submit(), submit()]);
    expect([a.status, b.status].sort()).toEqual([201, 429]);
    expect(await Report.countDocuments({ userId: ALICE.email, open: true })).toBe(2);
  });

  it('routes a report filed under Other by its words', async () => {
    const res = await submit({ area: 'other', text: 'The answer key of my quiz marks the wrong option as correct.' });
    expect(res.body.area).toBe('quizzes');
    expect((await Report.findOne({ ref: res.body.ref })).routedBy).toBe('rules');
  });

  it('copies the AI message it is about from the database, for the student\'s own item only', async () => {
    const note = await Notes.create({
      userId: ALICE.email, title: 'Bio', fileName: 'b.pdf', filePath: 'notes/b.pdf', extractedText: 'x',
      chatHistory: [{ role: 'user', content: 'what is ATP?' }, { role: 'assistant', content: 'ATP is a kind of sugar.' }],
    });
    const res = await submit({ area: 'notes', text: 'This answer about ATP is wrong.', source: { itemType: 'note_chat', itemId: String(note._id), messageIndex: 1, excerpt: 'forged text' } });
    const saved = await Report.findOne({ ref: res.body.ref }).lean();
    expect(saved.source).toMatchObject({ itemType: 'note_chat', excerpt: 'ATP is a kind of sugar.', excerptVerified: true });

    const bob = await submit({ user: BOB, area: 'notes', text: 'Pretending to report Alice\'s answer.', source: { itemType: 'note_chat', itemId: String(note._id), messageIndex: 1 } });
    expect((await Report.findOne({ ref: bob.body.ref }).lean()).source.excerpt).toBeUndefined();
  });

  it('checks attachments by their bytes, not their claimed type', async () => {
    const before = storedFiles().length;
    const fake = await submit({ files: { screenshot: { buffer: Buffer.from('not really a png at all'), name: 'x.png', type: 'image/png' } } });
    expect(fake.status).toBe(415);
    expect(await Report.countDocuments()).toBe(0);
    expect(storedFiles()).toHaveLength(before); // the rejected file is removed

    const real = await submit({ files: { screenshot: { buffer: PNG, name: 'shot.png', type: 'image/png' } } });
    expect(real.status).toBe(201);
    expect(real.body).toMatchObject({ channel: 'screenshot', attachments: [{ n: 0, kind: 'screenshot', mime: 'image/png' }] });
    const file = await request(app).get(`/api/reports/${real.body.ref}/attachments/0`).set('Authorization', bearer());
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('image/png');
    expect((await request(app).get(`/api/reports/${real.body.ref}/attachments/0`).set('Authorization', bearer(BOB))).status).toBe(404);
  });

  it('transcribes a voice note with Whisper', async () => {
    mockTranscribe.mockResolvedValue({ text: 'The video summary is blank again.', duration: 12 });
    const res = await submit({ files: { voice: { buffer: WEBM, name: 'voice.webm', type: 'audio/webm' } } });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ channel: 'voice', transcript: 'The video summary is blank again.' });
    expect(mockTranscribe.mock.calls[0][0].model).toBe('whisper-large-v3-turbo');
  });

  it('refuses voice cleanly when voice notes are switched off', async () => {
    await settings.set('features.voiceReports', { enabled: false }, { actor: system });
    expect((await request(app).get('/api/app-status')).body.reports.voiceEnabled).toBe(false);
    const before = storedFiles().length;
    const res = await submit({ files: { voice: { buffer: WEBM, name: 'voice.webm', type: 'audio/webm' } } });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VOICE_DISABLED');
    expect(await Report.countDocuments()).toBe(0);
    expect(storedFiles()).toHaveLength(before);
    expect(mockTranscribe).not.toHaveBeenCalled();
  });

  it('keeps the report when transcription fails', async () => {
    mockTranscribe.mockRejectedValue(Object.assign(new Error('503'), { status: 503 }));
    const res = await submit({ files: { voice: { buffer: WEBM, name: 'voice.webm', type: 'audio/webm' } } });
    expect(res.status).toBe(201);
    expect(res.body.transcript).toBe('');
  });

  it('validates the description, area and switch', async () => {
    expect((await submit({ text: 'short' })).status).toBe(400);
    expect((await submit({ area: 'nowhere' })).status).toBe(400);
    await settings.set('features.reports', { enabled: false, message: 'Reporting is paused.' }, { actor: system });
    expect((await submit()).body).toEqual({ error: 'Reporting is paused.', code: 'FEATURE_UNAVAILABLE' });
  });
});

describe('a student\'s own reports', () => {
  it('lists and opens only their own reports, without internal notes', async () => {
    const mine = await submit();
    await submit({ user: BOB });
    const admin = await adminBearer();
    await request(app).post(`/api/admin/reports/${mine.body.ref}/notes`).set('Authorization', admin).send({ body: 'Looks like the caption API.', internal: true });
    await request(app).post(`/api/admin/reports/${mine.body.ref}/notes`).set('Authorization', admin).send({ body: 'We are looking into it.' });

    const list = await request(app).get('/api/reports/mine').set('Authorization', bearer());
    expect(list.body.reports.map((r) => r.ref)).toEqual([mine.body.ref]);
    const detail = await request(app).get(`/api/reports/${mine.body.ref}`).set('Authorization', bearer());
    expect(detail.body.notes).toEqual([expect.objectContaining({ from: 'Novard team', body: 'We are looking into it.' })]);

    expect((await request(app).get(`/api/reports/${mine.body.ref}`).set('Authorization', bearer(BOB))).status).toBe(404);
    expect((await request(app).get('/api/reports/NV-bad').set('Authorization', bearer())).status).toBe(400);
  });

  it('a reply to a resolved report reopens it', async () => {
    const res = await submit();
    await resolveReports({ refs: [res.body.ref], actor: system });
    const reply = await request(app).post(`/api/reports/${res.body.ref}/notes`).set('Authorization', bearer()).send({ body: 'Still broken for me.' });
    expect(reply.body.status).toBe('open');
  });
});

describe('resolving reports and notifications', () => {
  it('notifies each student exactly once, and never again', async () => {
    const a1 = await submit();
    const a2 = await submit({ text: 'Another video has no summary at all today.' });
    await submit({ user: BOB });
    await submit({ area: 'notes', text: 'My PDF upload keeps failing.' });

    const admin = await adminBearer();
    const res = await request(app).post('/api/admin/areas/video-summarizer/resolve').set('Authorization', admin).send({ note: 'Fixed the caption download.' });
    expect(res.body).toMatchObject({ resolved: 3, students: 2 });

    const alice = await Notification.find({ userId: ALICE.email }).lean();
    expect(alice).toHaveLength(1);
    expect(alice[0]).toMatchObject({ kind: 'report_resolved', title: '2 of your reports have been resolved', body: 'What we did: Fixed the caption download.' });
    expect(alice[0].reportRefs.sort()).toEqual([a1.body.ref, a2.body.ref].sort());
    expect(await Notification.countDocuments({ userId: BOB.email })).toBe(1);

    // Already resolved: nothing changes, nobody is notified again.
    const again = await request(app).post('/api/admin/areas/video-summarizer/resolve').set('Authorization', admin).send({});
    expect(again.body.resolved).toBe(0);
    expect(await Notification.countDocuments()).toBe(2);
    // The notes area was not touched.
    expect(await Report.countDocuments({ area: 'notes', status: 'open' })).toBe(1);
    expect(await AdminAuditLog.countDocuments({ action: 'report.resolve' })).toBe(2);
  });

  it('two resolves racing on the same reports notify once', async () => {
    const r = await submit();
    const [x, y] = await Promise.all([
      resolveReports({ refs: [r.body.ref], actor: system }),
      resolveReports({ refs: [r.body.ref], actor: system }),
    ]);
    expect(x.resolved + y.resolved).toBe(1);
    expect(await Notification.countDocuments()).toBe(1);
  });

  it('the bell: list, unread count and mark read (own notifications only)', async () => {
    const r = await submit();
    await resolveReports({ refs: [r.body.ref], actor: system });
    const list = await request(app).get('/api/notifications').set('Authorization', bearer());
    expect(list.body.unread).toBe(1);
    expect(list.body.notifications[0]).toMatchObject({ kind: 'report_resolved', read: false, link: `/reports/${r.body.ref}` });

    expect((await request(app).get('/api/notifications').set('Authorization', bearer(BOB))).body.notifications).toHaveLength(0);
    expect((await request(app).post('/api/notifications/read').set('Authorization', bearer(BOB)).send({})).body.updated).toBe(0);
    expect((await request(app).post('/api/notifications/read').set('Authorization', bearer()).send({ ids: ['x'] })).status).toBe(400);
    expect((await request(app).post('/api/notifications/read').set('Authorization', bearer()).send({})).body.updated).toBe(1);
    expect((await request(app).get('/api/notifications').set('Authorization', bearer())).body.unread).toBe(0);
  });
});

describe('admin report inbox', () => {
  it('filters, shows the student by name only and reveals the email with an audit entry', async () => {
    await submit();
    await submit({ area: 'notes', text: 'My PDF upload keeps failing.' });
    const admin = await adminBearer();

    const all = await request(app).get('/api/admin/reports').set('Authorization', admin);
    expect(all.body.total).toBe(2);
    expect(JSON.stringify(all.body)).not.toContain(ALICE.email);

    const notes = await request(app).get('/api/admin/reports?area=notes').set('Authorization', admin);
    expect(notes.body.reports.map((r) => r.area)).toEqual(['notes']);
    const urgent = await request(app).get('/api/admin/reports?urgency=high&q=summary').set('Authorization', admin);
    expect(urgent.body.total).toBe(1);

    const ref = urgent.body.reports[0].ref;
    const email = await request(app).post(`/api/admin/reports/${ref}/reporter-email`).set('Authorization', admin);
    expect(email.body.email).toBe(ALICE.email);
    expect(await AdminAuditLog.findOne({ action: 'report.reveal_email' })).toBeTruthy();
  });

  it('status, assignment and replies (the student is notified of replies)', async () => {
    const r = await submit();
    const admin = await adminBearer();
    const progress = await request(app).post(`/api/admin/reports/${r.body.ref}/status`).set('Authorization', admin).send({ status: 'in_progress' });
    expect(progress.body).toMatchObject({ status: 'in_progress' });
    expect(progress.body.firstResponseAt).toBeTruthy();

    expect((await request(app).post(`/api/admin/reports/${r.body.ref}/assign`).set('Authorization', admin).send({ assignee: 'nobody@example.com' })).status).toBe(400);
    const assigned = await request(app).post(`/api/admin/reports/${r.body.ref}/assign`).set('Authorization', admin).send({ assignee: 'ada@example.com' });
    expect(assigned.body.assignedTo).toBe('ada@example.com');

    await request(app).post(`/api/admin/reports/${r.body.ref}/notes`).set('Authorization', admin).send({ body: 'Could you share the video link?' });
    expect(await Notification.findOne({ userId: ALICE.email, kind: 'report_reply' })).toBeTruthy();

    const done = await request(app).post(`/api/admin/reports/${r.body.ref}/status`).set('Authorization', admin).send({ status: 'resolved', note: 'Fixed.' });
    expect(done.body.status).toBe('resolved');
    expect(await Notification.countDocuments({ userId: ALICE.email, kind: 'report_resolved' })).toBe(1);
    expect((await request(app).post(`/api/admin/reports/${r.body.ref}/status`).set('Authorization', admin).send({ status: 'closed' })).status).toBe(409);
    expect((await request(app).post(`/api/admin/reports/${r.body.ref}/status`).set('Authorization', admin).send({ status: 'wontfix' })).status).toBe(400);
  });
});
