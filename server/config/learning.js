/**
 * Rules shared by every place a module is completed by a quiz: a Skill Plan
 * day, an Exam Autopilot topic. A module is completed only by passing; there
 * is no manual "mark done".
 */
const PASS_PERCENT = 50;

module.exports = {
  PASS_PERCENT,
  PASS_FRACTION: PASS_PERCENT / 100,
  DAY_QUIZ_QUESTIONS: 5,
  /** Has a result (a fraction 0-1, or correct/total) reached the pass mark? */
  passed: (score) => score * 100 >= PASS_PERCENT - 1e-9,
};
