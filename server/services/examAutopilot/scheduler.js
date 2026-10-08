const { addDays, daysBetween, daysFrom, weekday } = require('./dates');
const { WEIGHT, clamp01, topicState, nextStage, readiness } = require('./mastery');
const { passed } = require('../../config/learning');

/**
 * The plan: from today to the day before the exam, which topic to work on and
 * how, within the minutes the student has each day.
 *
 *   coverage   new topics are paced evenly through the learning phase, so
 *              every topic is started in time
 *   phases     learn and practise first; from ~65% of the way, consolidate;
 *              two days before: a full mock exam; the day before: light review
 *   priority   the expected gain in exam-day readiness per minute (simulated,
 *              forgetting included), so heavy weak topics come first; a topic
 *              waits until its prerequisites are learned, and a foundation
 *              counts part of what it unlocks
 *   reviews    once a topic's retention falls below the review threshold
 *   focus      at most three topics a day
 *
 * Each task is applied to a simulated copy of the student as soon as it is
 * placed, so later days build on earlier ones, and the same simulation yields
 * the readiness forecast. Every decision carries a plain-English reason.
 * Deterministic: the same inputs always give the same plan.
 */

const MINUTES = { learn: 25, practice: 15, teach: 15, review: 10, mock: 45 };
// How much of the remaining gap one task closes, and what its result weighs.
const LIFT = { learn: 0.45, practice: 0.2, teach: 0.25, review: 0.1, mock: 0.05 };
const SIM_WEIGHT = { learn: WEIGHT.learn, practice: 5, teach: WEIGHT.teachback, review: 4, mock: 2 };
const MAX_TOPICS_PER_DAY = 3;
const PREREQ_READY = 0.3;
const CONSOLIDATE_FROM = 0.65;
const TEACH_GAP_DAYS = 5;
const START_LEVEL = 0.15;

const pct = (x) => `${Math.round(x * 100)}%`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const listNames = (names) => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

// ── the simulated student ──────────────────────────────────────────────────

const LEVEL_PRIOR = 3; // a few answers move the starting level, one answer does not decide it

/** The level a student would score at now: their average result, pulled towards a modest start while evidence is thin. */
function startLevel(topic, day) {
  const evidence = (topic.evidence || []).filter((e) => e.at <= day && e.weight > 0);
  const base = topic.learnedAt ? 0.35 : START_LEVEL;
  const weight = evidence.reduce((n, e) => n + e.weight, 0);
  return (evidence.reduce((n, e) => n + e.weight * clamp01(e.score), 0) + LEVEL_PRIOR * base) / (weight + LEVEL_PRIOR);
}

/**
 * Is the topic completed? Only by passing: a graded result on it (quiz,
 * teach-back, diagnostic or mock) at the pass mark or above. A failed attempt
 * is evidence for mastery, but the topic stays to be learned.
 */
const studied = (t) => Boolean(t.learnedAt) || (t.evidence || []).some((e) => e.kind !== 'self' && e.weight > 0 && passed(e.score));

function simulateFrom(topics, day) {
  return topics.map((t) => ({
    ...t,
    evidence: [...(t.evidence || [])],
    reviewStage: t.reviewStage || 0,
    learned: studied(t),
    level: startLevel(t, day),
    lastTeach: (t.evidence || []).filter((e) => e.kind === 'teachback').map((e) => e.at).sort().at(-1) || null,
  }));
}

/** Apply one task to one simulated topic on `day`. `scale` makes the student learn faster or slower (forecast band). */
function applyToTopic(t, type, day, scale = 1) {
  const before = topicState(t, day);
  t.level = clamp01(t.level + (1 - t.level) * LIFT[type] * scale);
  if (type !== 'learn') t.reviewStage = nextStage(t.reviewStage, t.level, before.daysSince);
  if (type === 'teach') t.lastTeach = day;
  if (type !== 'mock') t.learned = true; // a mock question on an unstudied topic is not studying it
  t.evidence.push({ at: day, kind: `sim-${type}`, score: t.level, weight: SIM_WEIGHT[type] });
}

function applyTask(sim, task, day, scale = 1) {
  (task.type === 'mock' ? sim : sim.filter((t) => t.id === task.topicId)).forEach((t) => applyToTopic(t, task.type, day, scale));
}

/** How much exam-day readiness one task on `day` is expected to add, forgetting included. */
function examDayGain(t, type, day, examDate) {
  const before = topicState(t, examDate).mastery;
  const copy = { ...t, evidence: [...t.evidence] };
  applyToTopic(copy, type, day);
  return t.weight * (topicState(copy, examDate).mastery - before);
}

// ── choosing tasks ─────────────────────────────────────────────────────────

// Learning a foundation also opens the topics built on it: part of their likely gain counts.
const UNLOCK_SHARE = 0.15;

/**
 * What each topic needs on `day`, best first. The type of task follows the
 * topic's state (new → learn, fading → review, weak → practice or teach);
 * the ranking is the expected gain in exam-day readiness per minute, so the
 * planner spends each minute where it is worth the most marks.
 */
function candidates(sim, day, target, examDate, { exclude, reviewsOnly = false }) {
  const states = new Map(sim.map((t) => [t.id, topicState(t, day)]));
  const byId = new Map(sim.map((t) => [t.id, t]));
  const prereqs = (t) => (t.prerequisites || []).map((id) => byId.get(id)).filter(Boolean);

  const out = [];
  sim.forEach((t) => {
    const s = states.get(t.id);
    const dependents = sim.filter((d) => (d.prerequisites || []).includes(t.id) && (!d.learned || s.mastery < PREREQ_READY));
    // An unlearned prerequisite blocks; a learned but still weak one only slows the topic down.
    const blockers = prereqs(t).filter((p) => !p.learned);
    const shaky = prereqs(t).filter((p) => p.learned && states.get(p.id).mastery < PREREQ_READY);
    const builds = dependents.length ? ` ${listNames(dependents.map((d) => d.name))} build${dependents.length === 1 ? 's' : ''} on it.` : '';
    let type;
    let reason;

    if (!t.learned) {
      if (reviewsOnly || blockers.length) return;
      type = 'learn';
      reason = dependents.length ? `Start here:${builds} ${pct(t.weight)} of the exam.` : `New topic, ${pct(t.weight)} of the exam.`;
    } else if (s.reviewDue) {
      type = 'review';
      reason = `Review: last practised ${plural(s.daysSince, 'day')} ago, memory down to ~${pct(s.retention)}.`;
    } else if (reviewsOnly || s.mastery >= target) {
      return;
    } else {
      const teach = s.skill >= 0.5 && (!t.lastTeach || daysBetween(t.lastTeach, day) >= TEACH_GAP_DAYS);
      type = teach ? 'teach' : 'practice';
      reason = teach
        ? `You know the basics: explaining it in your own words is the strongest way to lock it in.${builds}`
        : `Mastery ${pct(s.mastery)}, below your ${pct(target)} target. ${pct(t.weight)} of the exam.${builds}`;
    }
    if (exclude.has(`${t.id}:${type}`)) return;

    const gain = examDayGain(t, type, day, examDate);
    const unlock = dependents.reduce((n, d) => n + d.weight, 0) * UNLOCK_SHARE * (type === 'learn' ? 1 : 0.3);
    const priority = ((gain + unlock) * (shaky.length ? 0.6 : 1)) / MINUTES[type];
    out.push({ topicId: t.id, type, priority, gain, reason, order: t.order });
  });
  return out.sort((a, b) => b.priority - a.priority || a.order - b.order);
}

/** Fill one day's minutes: up to three topics (four on long days), more tasks for the same topics when time is left over. */
function fillDay(sim, day, cap, target, examDate, { kept = [], reviewsOnly = false, learnQuota = 0 } = {}) {
  const tasks = [];
  const topics = new Set(kept.map((k) => k.topicId).filter(Boolean));
  const exclude = new Set(kept.map((k) => `${k.topicId}:${k.type}`));
  let left = cap;

  const maxTopics = Math.max(cap >= 120 ? MAX_TOPICS_PER_DAY + 1 : MAX_TOPICS_PER_DAY, Math.min(learnQuota + 1, MAX_TOPICS_PER_DAY + 2));
  for (let pass = 0; pass < 3 && left >= MINUTES.review; pass += 1) {
    const ranked = candidates(sim, day, target, examDate, { exclude, reviewsOnly });
    // Coverage first: today's share of the topics not yet started, then the best value per minute.
    const learnFirst = pass === 0 ? ranked.filter((c) => c.type === 'learn').slice(0, learnQuota) : [];
    const list = [...learnFirst, ...ranked.filter((c) => !learnFirst.includes(c))];
    for (const c of list) {
      const minutes = MINUTES[c.type];
      const newTopic = !topics.has(c.topicId);
      const perTopic = tasks.filter((t) => t.topicId === c.topicId).length;
      if (minutes > left || perTopic >= 1 + pass || (newTopic && topics.size >= maxTopics)) continue;
      const task = {
        topicId: c.topicId,
        type: c.type,
        minutes,
        gain: Math.round(c.gain * 1000) / 10, // readiness points on exam day
        reason: !newTopic && c.type !== 'review' ? `${c.reason} Straight after, while it's fresh.` : c.reason,
      };
      tasks.push(task);
      topics.add(c.topicId);
      exclude.add(`${c.topicId}:${c.type}`);
      left -= minutes;
      applyTask(sim, task, day);
    }
  }
  return tasks;
}

/** The day before the exam with no review due: a quick pass over the heaviest, least secure topics. */
function lightReview(sim, day, cap, kept) {
  const done = new Set(kept.map((k) => k.topicId));
  const tasks = sim
    .filter((t) => t.learned && !done.has(t.id))
    .map((t) => ({ t, need: t.weight * (1 - topicState(t, day).mastery) }))
    .sort((a, b) => b.need - a.need || a.t.order - b.t.order)
    .slice(0, Math.min(2, Math.floor(cap / MINUTES.review)))
    .map(({ t }) => ({ topicId: t.id, type: 'review', minutes: MINUTES.review, reason: `${t.name} is ${pct(t.weight)} of the exam: one more look.` }));
  tasks.forEach((task) => applyTask(sim, task, day));
  return tasks;
}

// ── the plan ───────────────────────────────────────────────────────────────

/**
 * @param topics  [{ id, name, weight, difficulty, order, prerequisites: [id], evidence, reviewStage, learnedAt }]
 * @param settings { examDate, dailyMinutes, restDays: [0-6], target: 0-1 }
 * @param today   the student's day
 * @param keep    today's tasks already done or skipped ({ topicId, type, minutes })
 * @returns { days: [{ date, phase, rest, tasks }], series, projected, reached }
 */
function buildPlan(topics, settings, today, keep = []) {
  const { examDate, dailyMinutes, restDays = [], target } = settings;
  const dates = daysFrom(today, examDate);
  const sim = simulateFrom(topics, today);
  const n = dates.length;
  const mockDay = n >= 5 ? addDays(examDate, -2) : null;
  const lightDay = n >= 2 ? addDays(examDate, -1) : null;
  const consolidateFrom = Math.ceil(n * CONSOLIDATE_FROM);

  // Study days left in the learning phase, for pacing new topics evenly through it.
  const studyDay = dates.map((d) => !restDays.includes(weekday(d)));
  const learnDaysFrom = (i) => studyDay.slice(i, Math.max(i + 1, consolidateFrom)).filter(Boolean).length || 1;

  const days = dates.map((date, i) => {
    const rest = restDays.includes(weekday(date));
    const unlearned = sim.filter((t) => !t.learned).length;
    const learnQuota = unlearned ? Math.ceil(unlearned / (i < consolidateFrom ? learnDaysFrom(i) : 1)) : 0;
    const kept = date === today ? keep : [];
    const cap = rest ? 0 : Math.max(0, dailyMinutes - kept.reduce((m, k) => m + (k.minutes || 0), 0));
    let phase = i >= consolidateFrom ? 'consolidate' : 'learn';
    let tasks = [];

    if (date === lightDay) {
      phase = 'light';
      tasks = fillDay(sim, date, Math.min(cap, 30), target, examDate, { kept, reviewsOnly: true });
      if (!tasks.length && cap >= MINUTES.review) tasks = lightReview(sim, date, Math.min(cap, 30), kept);
      tasks = tasks.map((t) => ({ ...t, reason: `Day before the exam: a light review keeps it fresh without cramming. ${t.reason}` }));
    } else if (date === mockDay) {
      phase = 'mock';
      if (cap >= 20 && !kept.some((k) => k.type === 'mock')) {
        const task = { topicId: null, type: 'mock', minutes: Math.min(MINUTES.mock, cap), reason: 'Full mock exam: every topic, under exam conditions. Your results reshape the last two days.' };
        tasks.push(task);
        applyTask(sim, task, date);
      }
      const used = tasks.reduce((m, t) => m + t.minutes, 0);
      tasks.push(...fillDay(sim, date, cap - used, target, examDate, { kept, reviewsOnly: true }));
    } else if (cap > 0) {
      tasks = fillDay(sim, date, cap, target, examDate, { kept, learnQuota });
    }
    return { date, phase: rest ? 'rest' : phase, rest, tasks };
  });

  return { days, ...project(sim, dates, examDate, target) };
}

/** Readiness on every planned day and on exam day, from a simulation that has all its tasks applied. */
function project(sim, dates, examDate, target) {
  const series = [...dates, examDate].map((date) => ({ date, readiness: readiness(sim, date) }));
  const projected = series.at(-1).readiness;
  const hit = series.find((p) => p.readiness >= target);
  return { series, projected, reached: hit ? hit.date : null };
}

/** Replay a plan with a slower or faster learner, for the forecast band. */
function simulatePlan(topics, days, today, examDate, scale) {
  const sim = simulateFrom(topics, today);
  days.forEach((d) => d.tasks.forEach((t) => applyTask(sim, t, d.date, scale)));
  return readiness(sim, examDate);
}

const MAX_DAILY_MINUTES = 240;
const WHAT_IF_STEP = 15;

/**
 * When the plan falls short of the target: the fewest minutes a day that would
 * reach it (in steps of 15, up to 4 hours), or null when even that is not enough.
 */
function minutesToReach(topics, settings, today, keep) {
  for (let minutes = settings.dailyMinutes + WHAT_IF_STEP; minutes <= MAX_DAILY_MINUTES; minutes += WHAT_IF_STEP) {
    const plan = buildPlan(topics, { ...settings, dailyMinutes: minutes }, today, keep);
    if (plan.projected >= settings.target) return { minutes, projected: plan.projected };
  }
  return null;
}

/** The forecast: the projection, a band for slower and faster progress, when the target is reached, and what would fix a shortfall. */
function forecast(topics, settings, today, plan, keep = []) {
  const now = readiness(topics, today);
  if (today >= settings.examDate) return { now, projected: now, low: now, high: now, reached: null, series: [], advice: null };
  const short = plan.projected < settings.target;
  return {
    now,
    projected: plan.projected,
    low: simulatePlan(topics, plan.days, today, settings.examDate, 0.6),
    high: simulatePlan(topics, plan.days, today, settings.examDate, 1.4),
    reached: plan.reached,
    series: plan.series,
    advice: short ? { onTrack: false, ...(minutesToReach(topics, settings, today, keep) || { minutes: null }) } : { onTrack: true },
  };
}

module.exports = { MINUTES, MAX_DAILY_MINUTES, buildPlan, forecast, studied, _internal: { candidates, fillDay, simulateFrom, applyTask, startLevel } };
