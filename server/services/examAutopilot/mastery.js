const { daysBetween } = require('./dates');

/**
 * How well a student knows one topic, from evidence only.
 *
 * Evidence is { at: day, kind, score 0-1, weight }: a quiz weighs its question
 * count, a Teach-Back counts as several questions (explaining beats
 * recognising), a self-rating is a weak hint.
 *
 *   skill      recency-weighted average score (how they do now), shrunk
 *              towards 0 by the amount of evidence, so one lucky answer is not
 *              mastery
 *   retention  a forgetting curve since the topic was last practised; each
 *              successful review (reviewStage) makes the memory more stable
 *   mastery    skill x retention - what the student would score right now
 *
 * The same function scores real evidence and the simulated evidence of a
 * planned task, so the forecast and today's numbers can never disagree.
 */

const PRIOR_WEIGHT = 2;           // pseudo-questions answered at 0
const RECENCY_HALF_LIFE = 10;     // days: older evidence counts half as much
const RETENTION_FLOOR = 0.35;     // knowledge fades towards this, not to zero
const STABILITY_DAYS = [2, 5, 10, 20, 40]; // forgetting time constant per review stage
const REVIEW_AT = 0.7;            // a review is due once retention drops below this
const MAX_STAGE = STABILITY_DAYS.length - 1;
const DIFFICULTY_FACTOR = { 1: 1.25, 2: 1, 3: 0.8 }; // hard topics are forgotten faster

/** Evidence weights, in "questions". */
const WEIGHT = { teachback: 6, self: 1, learn: 3 };

const clamp01 = (x) => Math.min(1, Math.max(0, x));

function stability(stage = 0, difficulty = 2) {
  const s = STABILITY_DAYS[Math.min(MAX_STAGE, Math.max(0, stage))];
  return s * (DIFFICULTY_FACTOR[difficulty] || 1);
}

/** Share of what was known that is still remembered `days` later. */
const retentionAfter = (days, stage, difficulty) => RETENTION_FLOOR
  + (1 - RETENTION_FLOOR) * Math.exp(-Math.max(0, days) / stability(stage, difficulty));

/** Days after the last practice at which a review becomes due. */
const reviewInterval = (stage, difficulty) => Math.max(1, Math.round(
  -stability(stage, difficulty) * Math.log((REVIEW_AT - RETENTION_FLOOR) / (1 - RETENTION_FLOOR)),
));

/** Evidence that measures knowledge (a self-rating is a hint, not practice). */
const practised = (e) => e.kind !== 'self';

/**
 * The topic on `day`: { skill, mastery, retention, confidence, lastAt, reviewDue, evidenceCount }.
 * Evidence after `day` is ignored.
 */
function topicState(topic, day) {
  const evidence = (topic.evidence || []).filter((e) => e.at <= day && e.weight > 0);
  let num = 0;
  let den = 0;
  let amount = 0;
  let lastAt = null;
  evidence.forEach((e) => {
    const w = e.weight * 0.5 ** (daysBetween(e.at, day) / RECENCY_HALF_LIFE);
    num += w * clamp01(e.score);
    den += w;
    amount += e.weight;
    if (practised(e) && (!lastAt || e.at > lastAt)) lastAt = e.at;
  });
  // Recency decides the average (how they do now); the amount of evidence decides how far to trust it.
  const skill = den ? (num / den) * (amount / (amount + PRIOR_WEIGHT)) : 0;
  const since = lastAt ? daysBetween(lastAt, day) : null;
  const retention = lastAt ? retentionAfter(since, topic.reviewStage, topic.difficulty) : 1;
  const mastery = skill * retention;
  return {
    skill,
    mastery,
    retention,
    confidence: amount / (amount + PRIOR_WEIGHT * 3),
    lastAt,
    daysSince: since,
    reviewDue: Boolean(lastAt) && skill >= 0.3 && since >= reviewInterval(topic.reviewStage, topic.difficulty),
    evidenceCount: evidence.filter(practised).length,
  };
}

/**
 * The review stage after new evidence: a good result at least a day after the
 * last practice strengthens the memory; a poor one sets it back.
 */
function nextStage(stage = 0, score, daysSinceLast) {
  if (score >= 0.7 && (daysSinceLast === null || daysSinceLast >= 1)) return Math.min(MAX_STAGE, stage + 1);
  if (score < 0.5) return Math.max(0, stage - 1);
  return stage;
}

/** Exam readiness: each topic's mastery weighted by its share of the exam (weights sum to 1). */
function readiness(topics, day) {
  return topics.reduce((sum, t) => sum + (t.weight || 0) * topicState(t, day).mastery, 0);
}

module.exports = {
  PRIOR_WEIGHT,
  REVIEW_AT,
  WEIGHT,
  clamp01,
  stability,
  retentionAfter,
  reviewInterval,
  topicState,
  nextStage,
  readiness,
};
