/**
 * Calendar days as "YYYY-MM-DD" strings in the student's own time zone (the
 * client sends its `today`). Arithmetic is done in UTC, where every day has 24
 * hours, so daylight-saving changes never shift a day.
 */

const DAY_MS = 864e5;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const toMs = (day) => Date.parse(`${day}T00:00:00Z`);
const fromMs = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Is this a real calendar day ("2026-02-30" is not)? */
const isDay = (value) => typeof value === 'string' && DAY_RE.test(value) && fromMs(toMs(value)) === value;

const addDays = (day, n) => fromMs(toMs(day) + n * DAY_MS);

/** Whole days from `a` to `b` (positive when `b` is later). */
const daysBetween = (a, b) => Math.round((toMs(b) - toMs(a)) / DAY_MS);

/** 0 = Sunday … 6 = Saturday. */
const weekday = (day) => new Date(toMs(day)).getUTCDay();

/** Every day from `from` up to, but not including, `to`. */
function daysFrom(from, to) {
  const out = [];
  for (let d = from; d < to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The day part of a Date or a day string. */
const dayOf = (value) => (typeof value === 'string' ? value.slice(0, 10) : fromMs(new Date(value).getTime()));

module.exports = { isDay, addDays, daysBetween, weekday, daysFrom, dayOf };
