const { buildPlan, forecast } = require('./scheduler');

/**
 * Re-plan an exam on `today` after something changed (a result, a skipped
 * task, new settings, a new day):
 *   - days before today are history: their unfinished tasks become "missed"
 *   - today's finished or skipped tasks stay; the rest of today and every later
 *     day are planned again from what the student knows now
 *   - one line for the plan log says what triggered it and what changed
 *
 * Pure: takes the exam as plain data and returns the new plan, forecast, log
 * entry and today's readiness snapshot.
 */

const pct = (x) => `${Math.round(x * 100)}%`;
const TYPE_LABEL = { learn: 'learn', practice: 'practice', teach: 'teach-back', review: 'review', mock: 'mock exam' };

const describe = (task, names) => `${task.topicId ? `${names.get(String(task.topicId)) || 'topic'} ` : ''}${TYPE_LABEL[task.type]}`.trim();

function replan(exam, today, trigger) {
  const topics = exam.topics;
  const names = new Map(topics.map((t) => [String(t.id), t.name]));
  const settings = { examDate: exam.examDate, dailyMinutes: exam.dailyMinutes, restDays: exam.restDays || [], target: exam.targetReadiness / 100 };

  let missed = 0;
  const past = (exam.plan || []).filter((d) => d.date < today).map((d) => ({
    ...d,
    tasks: d.tasks.map((t) => {
      if (t.status !== 'todo') return t;
      missed += 1;
      return { ...t, status: 'missed' };
    }),
  }));
  const oldToday = (exam.plan || []).find((d) => d.date === today);
  const kept = (oldToday?.tasks || []).filter((t) => t.status === 'done' || t.status === 'skipped');

  const plan = buildPlan(topics, settings, today, kept);
  const days = plan.days.map((d) => (d.date === today
    ? { ...d, tasks: [...kept, ...d.tasks.map((t) => ({ ...t, status: 'todo' }))] }
    : { ...d, tasks: d.tasks.map((t) => ({ ...t, status: 'todo' })) }));
  const fc = forecast(topics, settings, today, plan, kept);

  // What the student will notice: today's list changing, and the forecast moving.
  const before = (oldToday?.tasks || []).filter((t) => t.status === 'todo').map((t) => describe(t, names));
  const after = (days.find((d) => d.date === today)?.tasks || []).filter((t) => t.status === 'todo').map((t) => describe(t, names));
  const added = after.filter((x) => !before.includes(x));
  const dropped = before.filter((x) => !after.includes(x));

  const parts = [];
  if (missed) parts.push(`${missed} unfinished task${missed === 1 ? '' : 's'} from earlier days rescheduled`);
  if (oldToday && (added.length || dropped.length)) {
    if (added.length) parts.push(`today: added ${added.join(', ')}`);
    if (dropped.length) parts.push(`dropped ${dropped.join(', ')}`);
  }
  const previous = exam.forecast?.projected;
  if (typeof previous === 'number' && Math.round(previous * 100) !== Math.round(fc.projected * 100)) {
    parts.push(`exam-day forecast ${pct(previous)} → ${pct(fc.projected)}`);
  }

  return {
    plan: [...past, ...days],
    forecast: { now: fc.now, projected: fc.projected, low: fc.low, high: fc.high, reached: fc.reached, series: fc.series, advice: fc.advice },
    log: { at: today, trigger, summary: parts.join('; ') || 'Plan checked: no changes needed.' },
    snapshot: { date: today, readiness: fc.now, projected: fc.projected },
    missed,
  };
}

module.exports = { replan };
