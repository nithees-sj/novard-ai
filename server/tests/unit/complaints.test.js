const { verdict, textVerdict, countWindow, complaintLevel, complaintDrivers } = require('../../services/earlyWarning/complaints');
const { COMPLAINTS } = require('../../config/earlyWarning');

const enriched = (fields) => ({ enrichment: { status: 'done', sentiment: 0, urgency: 'medium', intent: 'other', ...fields } });

describe('complaint rule: reading one report', () => {
  it('uses the AI triage: problems count, severe when urgent or very negative', () => {
    expect(verdict(enriched({ intent: 'bug', sentiment: -0.4 }))).toBe('complaint');
    expect(verdict(enriched({ intent: 'wrong_ai_answer', sentiment: -0.2 }))).toBe('complaint');
    expect(verdict(enriched({ intent: 'bug', sentiment: -0.8 }))).toBe('severe');
    expect(verdict(enriched({ intent: 'content_quality', sentiment: -0.1, urgency: 'high' }))).toBe('severe');
    expect(verdict(enriched({ intent: 'other', sentiment: -0.5 }))).toBe('complaint');
  });

  it('does not count wishes, praise, cosmetic notes or mild feedback', () => {
    expect(verdict(enriched({ intent: 'feature_request', sentiment: -0.4, urgency: 'low' }))).toBe('none');
    expect(verdict(enriched({ intent: 'other', sentiment: 0.6, urgency: 'low' }))).toBe('none');
    expect(verdict(enriched({ intent: 'bug', sentiment: -0.1, urgency: 'low' }))).toBe('none');
    expect(verdict(enriched({ intent: 'content_quality', sentiment: -0.2 }))).toBe('none');
  });

  it('reads the words itself until the AI triage has run', () => {
    expect(textVerdict('The PDF upload is not working at all, I lost my notes')).toBe('severe');
    expect(textVerdict('I cannot open the quiz, my exam is tomorrow')).toBe('severe');
    expect(textVerdict('The quiz shows the wrong answer for question 3')).toBe('complaint');
    expect(textVerdict('Please add a dark mode, it would be nice')).toBe('none');
    expect(textVerdict('Love this app, thanks!')).toBe('none');
    expect(verdict({ text: 'Notes chat gives an error every time', enrichment: { status: 'pending' } })).toBe('complaint');
    expect(verdict({ text: 'Summaries are great', enrichment: { status: 'failed' } })).toBe('none');
  });
});

describe('complaint rule: counting and levels', () => {
  const at = (iso) => new Date(iso);
  const r = (userId, createdAt, v, extra = {}) => ({ userId, createdAt: at(createdAt), ...enriched(v), ...extra });

  it('counts unresolved complaints made in the window', () => {
    const reports = [
      r('a', '2026-09-30T10:00:00Z', { intent: 'bug', sentiment: -0.8 }),
      r('b', '2026-09-28T10:00:00Z', { intent: 'bug', sentiment: -0.4 }),
      r('b', '2026-09-27T10:00:00Z', { intent: 'feature_request', sentiment: 0.2, urgency: 'low' }), // not a risk
      r('c', '2026-09-20T10:00:00Z', { intent: 'bug', sentiment: -0.9 }), // before the window
      r('d', '2026-09-29T10:00:00Z', { intent: 'bug', sentiment: -0.9 }, { open: false, resolvedAt: at('2026-09-29T12:00:00Z') }), // fixed
      r('e', '2026-09-29T10:00:00Z', { intent: 'bug', sentiment: -0.9 }, { resolvedAt: at('2026-10-01T09:00:00Z') }), // fixed later: still open then
    ];
    expect(countWindow(reports, '2026-09-30', 7)).toEqual({ complaints: 3, severe: 2, reporters: 3 });
  });

  it('3 complaints -> MEDIUM, 5 or 3 severe -> HIGH, 5 severe -> CRITICAL; one student alone never counts', () => {
    const level = (complaints, severe, reporters = 3) => complaintLevel({ complaints, severe, reporters }, COMPLAINTS);
    expect(level(2, 0)).toBe('LOW');
    expect(level(3, 0)).toBe('MEDIUM');
    expect(level(4, 2)).toBe('MEDIUM');
    expect(level(5, 0)).toBe('HIGH');
    expect(level(3, 3)).toBe('HIGH');
    expect(level(5, 5)).toBe('CRITICAL');
    expect(level(6, 6, 1)).toBe('LOW');
    expect(complaintLevel({ complaints: 9, severe: 9, reporters: 5 }, { ...COMPLAINTS, enabled: false })).toBe('LOW');
  });

  it('describes itself for the board and alerts', () => {
    expect(complaintDrivers({ complaints: 5, severe: 3, reporters: 4, windowDays: 7, level: 'HIGH' })[0].label).toBe('5 complaints in 7 days (3 severe)');
    expect(complaintDrivers({ complaints: 2, severe: 0, reporters: 2, windowDays: 7, level: 'LOW' })).toEqual([]);
  });
});
