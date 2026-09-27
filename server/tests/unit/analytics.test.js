const {
  computeStreak, computeSkillScore, weightedAccuracy, makeDayKey, DAY_MS, _internal,
} = require('../../services/analyticsService');

const { classifyDomain, collectActivity } = _internal;
const dayKey = makeDayKey(0);
const now = new Date('2026-06-15T12:00:00Z');
const daysAgo = (n) => new Date(now.getTime() - n * DAY_MS);

describe('classifyDomain', () => {
  it.each([
    ['React hooks explained', 'Web Dev'],
    ['Docker volumes and Kubernetes pods', 'DevOps & Cloud'],
    ['How to maintain and explain things', 'General'], // "ai" inside words must not match
    ['C++ templates', 'Programming'],
    ['', 'General'],
  ])('%p -> %p', (text, domain) => expect(classifyDomain(text)).toBe(domain));
});

describe('makeDayKey', () => {
  it('buckets by the student’s local day', () => {
    const lateEveningInIndia = new Date('2026-06-15T20:00:00Z'); // 01:30 on the 16th in IST (UTC+5:30)
    expect(makeDayKey(-330)(lateEveningInIndia)).toBe('2026-06-16');
    expect(makeDayKey(0)(lateEveningInIndia)).toBe('2026-06-15');
  });
});

describe('weightedAccuracy', () => {
  it('weighs by questions and recency', () => {
    expect(weightedAccuracy([], now)).toBeNull();
    const equalAge = [{ at: now, questions: 10, percentage: 100 }, { at: now, questions: 30, percentage: 0 }];
    expect(weightedAccuracy(equalAge, now)).toBeCloseTo(25);
    const aged = [{ at: now, questions: 10, percentage: 100 }, { at: daysAgo(30), questions: 10, percentage: 0 }];
    expect(weightedAccuracy(aged, now)).toBeCloseTo(66.67, 1); // a 30-day-old result weighs half
  });
});

describe('computeStreak', () => {
  const keys = (...ago) => new Set(ago.map((n) => dayKey(daysAgo(n))));

  it('counts consecutive days ending today', () => {
    expect(computeStreak(keys(0, 1, 2, 5), now, dayKey)).toMatchObject({ days: 3, longest: 3, status: 'active', activeToday: true });
  });

  it('keeps yesterday’s streak alive but at risk', () => {
    expect(computeStreak(keys(1, 2), now, dayKey)).toMatchObject({ days: 2, status: 'at-risk' });
  });

  it('reports the best run when inactive', () => {
    expect(computeStreak(keys(5, 6, 7, 8), now, dayKey)).toMatchObject({ days: 0, longest: 4, status: 'inactive', message: 'Best so far: 4 days' });
  });
});

describe('collectActivity and computeSkillScore', () => {
  const data = collectActivity({
    notes: [{
      _id: 'n1', title: 'React hooks', uploadedAt: daysAgo(3),
      chatHistory: [{ role: 'user', timestamp: daysAgo(2) }, { role: 'assistant', timestamp: daysAgo(2) }],
      quizzes: [
        { score: { correct: 8, total: 10 }, attemptedAt: daysAgo(1) },
        { score: undefined, createdAt: daysAgo(1) }, // generated, never taken
      ],
    }],
    ytVideos: [],
    doubts: [{ _id: 'd1', title: 'Docker', createdAt: daysAgo(1), quizzes: [{ score: null, totalQuestions: 5 }] }],
    plans: [{ _id: 'p1', skillName: 'SQL', createdAt: daysAgo(4), dailyPlan: [{ completed: true, completedAt: daysAgo(1) }, { completed: false }] }],
    forumIssues: [],
    forumComments: [],
  });

  it('counts only submitted quizzes', () => {
    expect(data.attempts).toHaveLength(1);
    expect(data.attempts[0]).toMatchObject({ questions: 10, correct: 8, percentage: 80, domain: 'Web Dev' });
    expect(data.plan).toMatchObject({ totalDays: 2, completedDays: 1, activePlans: 1 });
  });

  it('scores deterministically, and never above 1000', () => {
    const a = computeSkillScore(data, now, dayKey);
    const b = computeSkillScore(data, now, dayKey);
    expect(a).toEqual(b);
    expect(a.total).toBeGreaterThan(0);
    expect(a.total).toBeLessThanOrEqual(1000);
    expect(a.total).toBe(a.breakdown.mastery + a.breakdown.progress + a.breakdown.consistency + a.breakdown.breadth);
  });

  it('evaluates "as of" a past date', () => {
    expect(computeSkillScore(data, daysAgo(10), dayKey).total).toBe(0);
  });
});
