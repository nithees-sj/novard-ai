// Embeddings are faked: deterministic vectors, and switchable failure.
const mockEmbed = jest.fn();
let mockEnabled = true;
jest.mock('../../ai/embeddings', () => ({
  embedTexts: (...args) => mockEmbed(...args),
  embeddingsEnabled: async () => mockEnabled,
}));

const Report = require('../../models/report');
const ReportEmbedding = require('../../models/reportEmbedding');
const ReportTopic = require('../../models/reportTopic');
const { searchReports, vectorPipeline, embedPending, embedReportSoon, _internal } = require('../../services/reportEmbeddings');
const { reclusterArea } = require('../../services/reportTopics');
const { greedyCluster } = require('../../services/earlyWarning/clustering');
const { useTestDatabase } = require('../helpers/db');

useTestDatabase();

afterEach(() => {
  mockEmbed.mockReset();
  mockEnabled = true;
  _internal.vectorState.unavailableUntil = 0;
  jest.restoreAllMocks();
});

const DAY = 24 * 3600 * 1000;
const now = new Date('2026-09-30T12:00:00Z');
let n = 0;
const report = (fields) => {
  n += 1;
  return Report.create({
    ref: `NV-${String(n).padStart(8, '0')}`, userId: `s${n}@example.com`, area: 'video-summarizer', text: 'placeholder text', quotaSlot: 0,
    createdAt: new Date(now.getTime() - DAY), ...fields,
  });
};

// Two directions in 3-d space: "captions" reports and "quiz" reports.
const CAPTIONS = [1, 0.05, 0];
const QUIZ = [0, 1, 0.1];
const wobble = (v, i) => v.map((x, d) => x + (d === 2 ? 0.01 * (i % 3) : 0));

describe('semantic search', () => {
  it('without enough vectors, uses $text search and still finds matches', async () => {
    await report({ text: 'The video captions are missing and the summary is empty.' });
    await report({ text: 'Quiz answer key is wrong.' });
    const out = await searchReports({ area: 'video-summarizer', from: new Date(now - 7 * DAY), to: now, query: 'missing captions summary' });
    expect(out.mode).toBe('full-text');
    expect(out.matches.map((m) => m.text)).toEqual(['The video captions are missing and the summary is empty.']);
  });

  it('builds the $vectorSearch pipeline filtered by area and time', () => {
    const from = new Date('2026-09-23');
    const to = new Date('2026-09-30');
    const [stage, project] = vectorPipeline({ area: 'notes', from, to, vector: [0.1, 0.2], k: 5 });
    expect(stage.$vectorSearch).toEqual({
      index: 'report_vec', path: 'vec', queryVector: [0.1, 0.2], numCandidates: 100, limit: 5,
      filter: { area: { $eq: 'notes' }, createdAt: { $gte: from, $lte: to } },
    });
    expect(project.$project.score).toEqual({ $meta: 'vectorSearchScore' });
  });

  it('uses vector search when the area has enough vectors, and falls back on error', async () => {
    const reports = await Promise.all(Array.from({ length: 3 }, (_, i) => report({ text: `Captions broken ${i}` })));
    await ReportEmbedding.insertMany(reports.map((r) => ({ reportId: r._id, area: r.area, createdAt: r.createdAt, vec: CAPTIONS })));
    const spy = jest.spyOn(ReportEmbedding, 'aggregate').mockResolvedValue([{ reportId: reports[1]._id, score: 0.93 }]);

    const out = await searchReports({ area: 'video-summarizer', from: new Date(now - 7 * DAY), to: now, vector: CAPTIONS, minVectors: 3 });
    expect(out).toMatchObject({ mode: 'semantic', matches: [{ ref: reports[1].ref, score: 0.93 }] });
    expect(spy.mock.calls[0][0][0].$vectorSearch.queryVector).toEqual(CAPTIONS);

    spy.mockRejectedValue(Object.assign(new Error('$vectorSearch is not allowed or the syntax is incorrect'), { code: 6047401 }));
    const fallback = await searchReports({ area: 'video-summarizer', from: new Date(now - 7 * DAY), to: now, vector: CAPTIONS, query: 'captions broken', minVectors: 3 });
    expect(fallback.mode).toBe('full-text');
    expect(fallback.matches.length).toBe(3);
  });
});

describe('embedding and topics', () => {
  it('an embedding failure never affects the report', async () => {
    const r = await report({ text: 'Summary missing' });
    mockEmbed.mockRejectedValue(new Error('429 quota'));
    embedReportSoon(r._id);
    await new Promise((resolve) => { setTimeout(resolve, 50); });
    const again = await Report.findById(r._id).lean();
    expect(again.text).toBe('Summary missing');
    expect(again.embedded).toBe(false);
    expect(await ReportEmbedding.countDocuments()).toBe(0);
  });

  it('embeds pending reports in batches, and skips cleanly when embeddings are off', async () => {
    await report({ text: 'a' });
    await report({ text: 'b' });
    mockEnabled = false;
    expect((await embedPending()).skipped).toMatch(/embeddings are off/);
    mockEnabled = true;
    mockEmbed.mockImplementation(async (texts) => texts.map(() => CAPTIONS));
    expect(await embedPending({ batchSize: 1 })).toMatchObject({ considered: 2, embedded: 2 });
    expect(mockEmbed).toHaveBeenCalledTimes(2);
    expect(await Report.countDocuments({ embedded: true })).toBe(2);
  });

  it('clusters an area into stable topics labelled by the reports\' own topics', async () => {
    const make = async (vec, topic, i) => {
      const r = await report({ text: topic, enrichment: { status: 'done', topic } });
      await ReportEmbedding.create({ reportId: r._id, area: 'video-summarizer', createdAt: r.createdAt, vec: wobble(vec, i) });
      return r;
    };
    for (let i = 0; i < 4; i += 1) await make(CAPTIONS, 'missing video captions', i); // eslint-disable-line no-await-in-loop
    for (let i = 0; i < 3; i += 1) await make(QUIZ, 'wrong quiz answer', i); // eslint-disable-line no-await-in-loop

    const first = await reclusterArea('video-summarizer', { now });
    expect(first).toMatchObject({ topics: 2, assigned: 7 });
    const topics = await ReportTopic.find().sort({ label: 1 }).lean();
    expect(topics.map((t) => [t.label, t.recordCount])).toEqual([['missing video captions', 4], ['wrong quiz answer', 3]]);

    // A new report joins; the topics keep their ids.
    await make(CAPTIONS, 'captions not loading', 9);
    await reclusterArea('video-summarizer', { now });
    const after = await ReportTopic.find().sort({ label: 1 }).lean();
    expect(after.map((t) => String(t._id))).toEqual(topics.map((t) => String(t._id)));
    expect(after[0].recordCount).toBe(5);
    expect(await Report.countDocuments({ topicId: topics[0]._id })).toBe(5);
  });
});

describe('greedyCluster (EWDI cluster())', () => {
  it('is deterministic for fixed vectors', () => {
    const vectors = [...Array.from({ length: 4 }, (_, i) => wobble(CAPTIONS, i)), ...Array.from({ length: 3 }, (_, i) => wobble(QUIZ, i))];
    const a = greedyCluster(vectors, { tau: 0.75, minCluster: 2 });
    const b = greedyCluster(vectors, { tau: 0.75, minCluster: 2 });
    expect(a).toEqual(b);
    expect(a.assign).toEqual([0, 0, 0, 0, 1, 1, 1]);
    expect(a.keep).toEqual([0, 1]);
  });

  it('keeps the largest cluster when none reaches the minimum', () => {
    const out = greedyCluster([CAPTIONS, QUIZ, wobble(QUIZ, 1)], { minCluster: 15 });
    expect(out.keep).toEqual([1]);
  });
});
