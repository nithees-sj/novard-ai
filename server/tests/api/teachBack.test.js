const fs = require('fs');
const request = require('supertest');

jest.mock('../../ai/groqClient', () => ({ complete: jest.fn() }));
jest.mock('../../ai/conversation', () => ({
  ...jest.requireActual('../../ai/conversation'),
  converse: jest.fn(),
}));
jest.mock('../../ai/transcribe', () => ({ transcribe: jest.fn(), voiceEnabled: jest.fn(async () => true) }));
jest.mock('../../services/ocrService', () => ({ recognizePage: jest.fn(), terminateOcr: jest.fn() }));

const { complete } = require('../../ai/groqClient');
const { converse } = require('../../ai/conversation');
const { transcribe } = require('../../ai/transcribe');
const { createApp } = require('../../app');
const TeachBack = require('../../models/teachBack');
const Notes = require('../../models/notes');
const settings = require('../../services/settingsService');
const { env } = require('../../config/env');
const { _internal } = require('../../services/teachBackService');
const { useTestDatabase } = require('../helpers/db');
const { ALICE, BOB, bearer } = require('../helpers/auth');
const { makePdf } = require('../helpers/pdf');

useTestDatabase();
const app = createApp();
afterEach(() => {
  jest.clearAllMocks();
  complete.mockReset();
});
afterAll(() => fs.rmSync(env.uploadDir, { recursive: true, force: true }));

const api = (user = ALICE) => ({
  get: (path) => request(app).get(path).set('Authorization', bearer(user)),
  post: (path, body = {}) => request(app).post(path).set('Authorization', bearer(user)).send(body),
  del: (path) => request(app).delete(path).set('Authorization', bearer(user)),
});

const MARKS = {
  score: 55,
  verdict: 'A solid start.',
  flow: [
    { step: 'Light is absorbed', status: 'good', feedback: 'You explained this well.' },
    { step: 'Water is split', status: 'wrong', feedback: 'You said CO2 is split.' },
    { step: 'Glucose is made', status: 'missed', feedback: 'You never mentioned it.' },
  ],
  corrections: [{ youSaid: 'CO2 gets split for oxygen', actually: 'Water is split; that oxygen is released.', why: 'Photolysis.' }],
  strengths: ['Clear start'],
  nextStep: 'Learn where the oxygen comes from.',
};

async function startTopic(user = ALICE, concept = 'Photosynthesis') {
  const res = await api(user).post('/api/teachback', { concept });
  expect(res.status).toBe(201);
  return res.body;
}

describe('Teach-Back Arena', () => {
  it('runs a whole session: explain, follow-up, marks as a flow, then coaching', async () => {
    const session = await startTopic();
    expect(session).toMatchObject({ concept: 'Photosynthesis', status: 'active', canFinish: false, result: null, source: { kind: 'topic' } });
    expect(session.turns).toHaveLength(1);
    expect(session.turns[0].role).toBe('novard');
    expect(complete).not.toHaveBeenCalled(); // the opener is a template
    expect(session.reference).toBeUndefined();

    complete.mockResolvedValueOnce('{"reply": "But where does the oxygen come from?", "ready": false}');
    const turn = await api().post(`/api/teachback/${session._id}/turns`, { message: 'Plants use light to split CO2 for oxygen.' });
    expect(turn.status).toBe(200);
    expect(turn.body).toMatchObject({ canFinish: true, ready: false, followUpsLeft: 2 });
    expect(turn.body.turns.map((t) => t.role)).toEqual(['novard', 'student', 'novard']);
    expect(turn.body.turns[2].text).toBe('But where does the oxygen come from?');

    complete.mockResolvedValueOnce(JSON.stringify(MARKS));
    const marks = await api().post(`/api/teachback/${session._id}/finish`);
    expect(marks.status).toBe(200);
    expect(marks.body.status).toBe('graded');
    expect(marks.body.result).toMatchObject({ score: 55, corrections: [{ actually: 'Water is split; that oxygen is released.' }] });
    expect(marks.body.result.flow.map((s) => s.status)).toEqual(['good', 'wrong', 'missed']);
    expect(marks.body.flowChart).toMatch(/^flowchart TD/);
    expect(marks.body.flowChart).toContain(':::wrong');
    // The grader is told to ignore language.
    expect(complete.mock.calls[1][0].messages[0].content).toMatch(/NEVER mark down grammar/);

    // Asking again keeps the same marks, without another model call.
    expect((await api().post(`/api/teachback/${session._id}/finish`)).body.result.score).toBe(55);
    expect(complete).toHaveBeenCalledTimes(2);
    expect((await api().post(`/api/teachback/${session._id}/turns`, { message: 'more' })).status).toBe(409);

    converse.mockResolvedValueOnce('### Water is split\nThe oxygen comes from water.');
    const lesson = await api().post(`/api/teachback/${session._id}/coach`);
    expect(lesson.status).toBe(200);
    expect(lesson.body.reply).toContain('Water is split');
    const call = converse.mock.calls[0][0];
    expect(call.input).toMatch(/weak spots/);
    expect(call.field).toBe('coaching');
    expect(call.system).toContain('"Water is split"');
    expect(call.system).not.toContain('"Light is absorbed",');

    converse.mockResolvedValueOnce('Sure - here is an example.');
    expect((await api().post(`/api/teachback/${session._id}/coach`, { message: 'Give me an example' })).body.reply).toMatch(/example/);
    expect(converse.mock.calls[1][0].input).toBe('Give me an example');

    // A retry on the same concept remembers the last score.
    const again = await startTopic(ALICE, 'photosynthesis');
    expect(again.previousScore).toBe(55);

    const list = await api().get('/api/teachback');
    expect(list.body.sessions).toHaveLength(2);
    expect(list.body.sessions[1]).toMatchObject({ concept: 'Photosynthesis', score: 55 });
  });

  it('counts the marks on the dashboard and profile', async () => {
    const session = await startTopic();
    complete.mockResolvedValueOnce('{"reply": "Why?", "ready": false}');
    await api().post(`/api/teachback/${session._id}/turns`, { message: 'Explaining.' });
    complete.mockResolvedValueOnce(JSON.stringify(MARKS));
    await api().post(`/api/teachback/${session._id}/finish`);
    const profile = await api().get(`/api/profile/${encodeURIComponent(ALICE.email)}/overview`);
    expect(profile.status).toBe(200);
    expect(JSON.stringify(profile.body)).toContain('Teach-Back');
  });

  it('teaches from an uploaded PDF, saved as a note too', async () => {
    const res = await request(app).post('/api/teachback').set('Authorization', bearer(ALICE))
      .field('focus', 'how chlorophyll absorbs light')
      .attach('pdf', makePdf('Chlorophyll absorbs red and blue light and reflects green light.'), { filename: 'bio.pdf', contentType: 'application/pdf' });
    expect(res.body.error).toBeUndefined();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ concept: 'how chlorophyll absorbs light', source: { kind: 'pdf' } });
    expect(await Notes.countDocuments({ userId: ALICE.email })).toBe(1);
    const stored = await TeachBack.findById(res.body._id).lean();
    expect(stored.reference).toContain('Chlorophyll absorbs red and blue light');

    // Grading is grounded in the PDF.
    complete.mockResolvedValueOnce('{"reply": "Why green?", "ready": false}');
    await api().post(`/api/teachback/${res.body._id}/turns`, { message: 'It takes in light.' });
    complete.mockResolvedValueOnce(JSON.stringify(MARKS));
    await api().post(`/api/teachback/${res.body._id}/finish`);
    expect(complete.mock.calls[1][0].messages[0].content).toContain('Chlorophyll absorbs red and blue light');

    // An existing note works too.
    const fromNote = await api().post('/api/teachback', { noteId: String(stored.source.noteId), concept: 'Chlorophyll' });
    expect(fromNote.status).toBe(201);
    expect(fromNote.body.source.label).toBeTruthy();
  });

  it('transcribes a recorded explanation', async () => {
    const session = await startTopic();
    transcribe.mockResolvedValueOnce('Plants make food from light.');
    complete.mockResolvedValueOnce('{"reply": "What food?", "ready": false}');
    const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(64)]);
    const res = await request(app).post(`/api/teachback/${session._id}/turns`).set('Authorization', bearer(ALICE))
      .attach('voice', webm, { filename: 'take.webm', contentType: 'audio/webm' });
    expect(res.status).toBe(200);
    expect(res.body.turns[1]).toMatchObject({ role: 'student', text: 'Plants make food from light.', via: 'voice' });
    expect(transcribe.mock.calls[0][0]).toMatch(/\.webm$/);

    // A file that is not really audio is refused.
    const fake = await request(app).post(`/api/teachback/${session._id}/turns`).set('Authorization', bearer(ALICE))
      .attach('voice', Buffer.from('not audio at all'), { filename: 'x.webm', contentType: 'audio/webm' });
    expect(fake.status).toBe(415);
  });

  it('stops asking after three follow-ups', async () => {
    const session = await startTopic();
    for (let i = 0; i < 3; i += 1) {
      complete.mockResolvedValueOnce(`{"reply": "Question ${i}?", "ready": false}`);
      // eslint-disable-next-line no-await-in-loop
      await api().post(`/api/teachback/${session._id}/turns`, { message: `Answer ${i}` });
    }
    const last = await api().post(`/api/teachback/${session._id}/turns`, { message: 'Final answer' });
    expect(last.body).toMatchObject({ ready: true, followUpsLeft: 0 });
    expect(complete).toHaveBeenCalledTimes(3);
  });

  it('keeps each student to their own sessions and checks input', async () => {
    const session = await startTopic();
    expect((await api(BOB).get(`/api/teachback/${session._id}`)).status).toBe(404);
    expect((await api(BOB).post(`/api/teachback/${session._id}/turns`, { message: 'hi' })).status).toBe(404);
    expect((await api(BOB).post(`/api/teachback/${session._id}/finish`)).status).toBe(404);
    expect((await api(BOB).del(`/api/teachback/${session._id}`)).status).toBe(404);
    expect((await api(BOB).get('/api/teachback')).body.sessions).toEqual([]);
    expect((await request(app).get('/api/teachback')).status).toBe(401);

    expect((await api().post('/api/teachback', {})).status).toBe(400);
    expect((await api().post('/api/teachback', { concept: { $ne: 1 } })).status).toBe(400);
    expect((await api().post(`/api/teachback/${session._id}/finish`)).status).toBe(400); // nothing explained yet
    expect((await api().post(`/api/teachback/${session._id}/coach`)).status).toBe(409); // no marks yet

    expect((await api().del(`/api/teachback/${session._id}`)).status).toBe(200);
    expect(await TeachBack.countDocuments()).toBe(0);
  });

  it('reports unusable marks and honours the admin switch', async () => {
    const session = await startTopic();
    complete.mockResolvedValueOnce('{"reply": "Why?", "ready": false}');
    await api().post(`/api/teachback/${session._id}/turns`, { message: 'Explaining.' });
    complete.mockResolvedValueOnce('not json at all');
    expect((await api().post(`/api/teachback/${session._id}/finish`)).status).toBe(502);
    expect((await TeachBack.findById(session._id).lean()).status).toBe('active');

    await settings.set('features.teachBack', { enabled: false, message: 'Back soon.', notice: '' }, { actor: { email: 'root@example.com', role: 'superadmin' } });
    const off = await api().post('/api/teachback', { concept: 'Gravity' });
    expect(off.status).toBe(503);
    expect(off.body.error).toContain('Back soon.');
    expect((await api().get('/api/teachback')).status).toBe(200); // reading still works
  });
});

describe('teach-back marks', () => {
  it('tidies what the model returns', () => {
    const r = _internal.normaliseResult({ score: 140, flow: [{ step: 'A', status: 'GOOD' }, { step: 'B', status: 'weird' }, { step: '' }] });
    expect(r.score).toBe(100);
    expect(r.flow.map((s) => s.status)).toEqual(['good', 'missed']);
    expect(_internal.normaliseResult({ flow: [{ step: 'A', status: 'good' }, { step: 'B', status: 'partial' }] }).score).toBe(75);
    expect(_internal.normaliseResult({ flow: [] })).toBeNull();
  });

  it('draws a safe flowchart', () => {
    const chart = _internal.flowChart([{ step: 'Say "hi" <b>#1;', status: 'good' }, { step: 'Next', status: 'wrong' }]);
    expect(chart).toContain('s0 --> s1');
    expect(chart).not.toMatch(/<b>|#1;|"hi"/);
  });
});
