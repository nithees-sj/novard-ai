const { addDays, daysBetween, isDay, weekday, daysFrom } = require('../../services/examAutopilot/dates');
const { topicState, nextStage, readiness, retentionAfter, reviewInterval } = require('../../services/examAutopilot/mastery');
const { buildPlan, forecast, MINUTES } = require('../../services/examAutopilot/scheduler');
const { replan } = require('../../services/examAutopilot/replan');
const { normaliseTopics, removeCycles } = require('../../services/examAutopilot/topics');

const TODAY = '2026-10-08'; // a Thursday
const EXAM = '2026-10-22';

/** A DBMS syllabus: ER → relational → SQL → transactions; relational → FDs → normalisation. */
function syllabus(evidence = {}) {
  const raw = [
    { name: 'ER modelling', importance: 6, difficulty: 1 },
    { name: 'Relational model', importance: 7, difficulty: 1, prerequisites: [0] },
    { name: 'SQL queries', importance: 10, difficulty: 2, prerequisites: [1] },
    { name: 'Functional dependencies', importance: 6, difficulty: 3, prerequisites: [1] },
    { name: 'Normalisation', importance: 8, difficulty: 3, prerequisites: [3] },
    { name: 'Transactions', importance: 7, difficulty: 2, prerequisites: [2] },
  ];
  return normaliseTopics(raw).map((t, i) => ({
    id: `t${i}`, order: i, ...t, prerequisites: t.prereqIdx.map((p) => `t${p}`), evidence: evidence[i] || [], reviewStage: 0,
  }));
}
const settings = (over = {}) => ({ examDate: EXAM, dailyMinutes: 60, restDays: [0], target: 0.7, ...over });
const quiz = (at, score, weight = 5) => ({ at, kind: 'quiz', score, weight });

describe('dates', () => {
  it('does calendar arithmetic in whole days', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(daysBetween('2026-10-08', '2026-10-22')).toBe(14);
    expect(weekday('2026-10-11')).toBe(0);
    expect(isDay('2026-02-30')).toBe(false);
    expect(daysFrom('2026-10-08', '2026-10-11')).toEqual(['2026-10-08', '2026-10-09', '2026-10-10']);
  });
});

describe('mastery', () => {
  it('shrinks thin evidence: one lucky answer is not mastery', () => {
    const one = topicState({ evidence: [quiz(TODAY, 1, 1)] }, TODAY);
    const many = topicState({ evidence: [quiz(TODAY, 1, 20)] }, TODAY);
    expect(one.mastery).toBeLessThan(0.4);
    expect(many.mastery).toBeGreaterThan(0.85);
    expect(many.confidence).toBeGreaterThan(one.confidence);
  });

  it('forgets over time, slower after successful reviews and for easier topics', () => {
    expect(retentionAfter(7, 0, 2)).toBeLessThan(retentionAfter(7, 3, 2));
    expect(retentionAfter(7, 1, 3)).toBeLessThan(retentionAfter(7, 1, 1));
    expect(retentionAfter(1000, 0, 2)).toBeGreaterThan(0.3); // fades towards a floor, not to zero
    const t = { evidence: [quiz('2026-10-01', 0.9, 10)], reviewStage: 0, difficulty: 2 };
    expect(topicState(t, '2026-10-02').mastery).toBeGreaterThan(topicState(t, '2026-10-10').mastery);
  });

  it('makes a review due on a widening schedule', () => {
    const gaps = [0, 1, 2, 3, 4].map((stage) => reviewInterval(stage, 2));
    expect(gaps).toEqual([...gaps].sort((a, b) => a - b));
    expect(gaps[0]).toBeGreaterThanOrEqual(1);
    const t = { evidence: [quiz('2026-10-01', 0.9, 10)], reviewStage: 0, difficulty: 2 };
    expect(topicState(t, '2026-10-01').reviewDue).toBe(false);
    expect(topicState(t, '2026-10-05').reviewDue).toBe(true);
  });

  it('moves the review stage on results', () => {
    expect(nextStage(1, 0.9, 3)).toBe(2);
    expect(nextStage(1, 0.9, 0)).toBe(1); // cramming the same day does not count
    expect(nextStage(2, 0.3, 3)).toBe(1);
    expect(nextStage(4, 1, 30)).toBe(4);
  });

  it('weighs readiness by each topic’s share of the exam', () => {
    const topics = syllabus({ 2: [quiz(TODAY, 1, 30)] });
    expect(readiness(topics, TODAY)).toBeCloseTo(topics[2].weight * topicState(topics[2], TODAY).mastery, 6);
    expect(topics.reduce((s, t) => s + t.weight, 0)).toBeCloseTo(1, 6);
  });
});

describe('topics', () => {
  it('cleans a draft: names, weights, difficulty, prerequisites', () => {
    const out = normaliseTopics([
      { name: ' Arrays ', importance: 4, difficulty: 9 },
      { name: 'arrays' },
      { name: 'Sorting', importance: 12, prerequisites: [0, 7, 'x'] },
    ]);
    expect(out.map((t) => t.name)).toEqual(['Arrays', 'Sorting']);
    expect(out[0].difficulty).toBe(2);
    expect(out[1].importance).toBe(10);
    expect(out[0].weight + out[1].weight).toBeCloseTo(1, 6);
    expect(out[1].prereqIdx).toEqual([0]);
    expect(normaliseTopics([{ name: 'Only one' }])).toBeNull();
  });

  it('breaks prerequisite loops, keeping the earlier topic as the foundation', () => {
    expect(removeCycles([[1], [0]])).toEqual([[], [0]]);
    expect(removeCycles([[], [0], [1], [2, 0]])).toEqual([[], [0], [1], [0, 2]]);
    expect(removeCycles([[2], [0], [1]])).toEqual([[], [0], [1]]);
    expect(removeCycles([[3], [], [], []])).toEqual([[3], [], [], []]); // a backward link without a loop stays
  });
});

describe('scheduler', () => {
  const plan = buildPlan(syllabus(), settings(), TODAY);
  const tasks = plan.days.flatMap((d) => d.tasks.map((t) => ({ ...t, date: d.date })));
  const firstLearn = (id) => tasks.find((t) => t.topicId === id && t.type === 'learn')?.date;

  it('plans every day up to the exam within the daily minutes', () => {
    expect(plan.days[0].date).toBe(TODAY);
    expect(plan.days.at(-1).date).toBe(addDays(EXAM, -1));
    plan.days.forEach((d) => expect(d.tasks.reduce((m, t) => m + t.minutes, 0)).toBeLessThanOrEqual(60));
    plan.days.forEach((d) => expect(new Set(d.tasks.map((t) => t.topicId)).size).toBeLessThanOrEqual(3));
  });

  it('keeps rest days free', () => {
    const sundays = plan.days.filter((d) => weekday(d.date) === 0);
    expect(sundays.length).toBe(2);
    sundays.forEach((d) => expect(d).toMatchObject({ rest: true, phase: 'rest', tasks: [] }));
  });

  it('teaches foundations before the topics that build on them', () => {
    const order = ['t0', 't1', 't2', 't3', 't4', 't5'].map(firstLearn);
    order.forEach((d) => expect(d).toBeTruthy());
    expect(order[0] <= order[1]).toBe(true);
    expect(order[1] <= order[2]).toBe(true);
    expect(order[3] <= order[4]).toBe(true);
    expect(tasks.find((t) => t.topicId === 't0').reason).toMatch(/Relational model builds on it/);
  });

  it('ends with a mock exam and a light review the day before', () => {
    const mock = plan.days.find((d) => d.date === addDays(EXAM, -2));
    expect(mock.phase).toBe('mock');
    expect(mock.tasks[0]).toMatchObject({ type: 'mock', topicId: null, minutes: MINUTES.mock });
    const light = plan.days.at(-1);
    expect(light.phase).toBe('light');
    expect(light.tasks.length).toBeGreaterThan(0);
    light.tasks.forEach((t) => expect(t.type).toBe('review'));
    expect(light.tasks.reduce((m, t) => m + t.minutes, 0)).toBeLessThanOrEqual(30);
  });

  it('explains every task', () => {
    tasks.forEach((t) => expect(t.reason.length).toBeGreaterThan(10));
    expect(tasks.some((t) => t.type === 'review' && /last practised \d+ days? ago/.test(t.reason))).toBe(true);
  });

  it('works on what is weak and leaves what is mastered', () => {
    const strong = Array.from({ length: 6 }, (_, i) => quiz(addDays(TODAY, -i), 1, 10));
    const p = buildPlan(syllabus({ 0: strong }), settings(), TODAY);
    expect(p.days[0].tasks.some((t) => t.topicId === 't0' && t.type !== 'review')).toBe(false);
  });

  it('is deterministic', () => {
    expect(buildPlan(syllabus(), settings(), TODAY)).toEqual(plan);
  });

  it('forecasts more readiness with more time, and a band around it', () => {
    const at = (over) => buildPlan(syllabus(), settings(over), TODAY).projected;
    expect(at({ dailyMinutes: 30 })).toBeLessThan(at({ dailyMinutes: 60 }));
    expect(at({ dailyMinutes: 60 })).toBeLessThan(at({ dailyMinutes: 120 }));
    expect(at({ examDate: '2026-10-13' })).toBeLessThan(at({}));
    const fc = forecast(syllabus(), settings(), TODAY, plan);
    expect(fc.low).toBeLessThan(fc.projected);
    expect(fc.high).toBeGreaterThan(fc.projected);
    expect(fc.series.at(-1)).toEqual({ date: EXAM, readiness: fc.projected });
  });

  it('says how many minutes a day would reach the target', () => {
    const fc = forecast(syllabus(), settings(), TODAY, plan);
    expect(fc.advice.onTrack).toBe(false);
    expect(fc.advice.minutes).toBeGreaterThan(60);
    const enough = buildPlan(syllabus(), settings({ dailyMinutes: fc.advice.minutes }), TODAY);
    expect(enough.projected).toBeGreaterThanOrEqual(0.7);
  });
});

describe('replan', () => {
  const exam = () => ({ topics: syllabus(), examDate: EXAM, dailyMinutes: 60, restDays: [0], targetReadiness: 70, plan: [] });

  it('marks unfinished past tasks missed, keeps today’s finished ones and plans the rest', () => {
    const first = replan(exam(), TODAY, 'Created');
    const plan = first.plan.map((d) => ({ ...d, tasks: d.tasks.map((t, i) => ({ ...t, _id: `${d.date}-${i}` })) }));
    plan[0].tasks[0].status = 'done';
    const next = { ...exam(), plan, forecast: first.forecast };

    const tomorrow = addDays(TODAY, 1);
    const out = replan(next, tomorrow, 'New day');
    expect(out.plan[0].date).toBe(TODAY);
    expect(out.plan[0].tasks[0].status).toBe('done');
    expect(out.plan[0].tasks.slice(1).every((t) => t.status === 'missed')).toBe(true);
    expect(out.missed).toBe(plan[0].tasks.length - 1);
    expect(out.plan[1].date).toBe(tomorrow);
    expect(out.plan[1].tasks.every((t) => t.status === 'todo')).toBe(true);
    expect(out.log.summary).toMatch(/rescheduled/);
    expect(out.snapshot.date).toBe(tomorrow);

    // Today's finished work stays; the rest of today is planned around it.
    const mid = { ...next, plan: out.plan };
    mid.plan[1].tasks[0] = { ...mid.plan[1].tasks[0], status: 'done' };
    const again = replan(mid, tomorrow, 'Quiz');
    expect(again.plan[1].tasks[0].status).toBe('done');
    expect(again.plan[1].tasks.reduce((m, t) => m + t.minutes, 0)).toBeLessThanOrEqual(60);
  });

  it('has nothing left to plan on exam day', () => {
    const out = replan(exam(), EXAM, 'New day');
    expect(out.plan).toEqual([]);
    expect(out.forecast.projected).toBe(out.forecast.now);
  });
});
