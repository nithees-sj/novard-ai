const AppUsage = require('../models/appUsage');
const { badRequest } = require('../utils/httpError');

/**
 * Time a student actually spends in the app.
 *
 * The client only counts time while the tab is visible and focused and the
 * student has interacted recently (or is watching an embedded video), and
 * flushes about once a minute. The server bounds every value, so a buggy or
 * replayed request can never inflate the total by much.
 */

const MAX_SECONDS_PER_BEAT = 5 * 60; // the client flushes every ~60 s; allow for a missed flush or two
const MAX_SECONDS_PER_DAY = 24 * 60 * 60;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "This student was active for N more seconds on local day D." Returns the day's new total. */
async function recordUsage(userId, { day, seconds }) {
  const dayKey = String(day || '');
  const secs = Math.round(Number(seconds));

  if (!DAY_RE.test(dayKey)) throw badRequest('day must be YYYY-MM-DD');
  if (!Number.isFinite(secs) || secs <= 0) throw badRequest('seconds must be positive');

  // The day must be within a day of the server's clock (any timezone), so
  // time cannot be booked to arbitrary past or future dates.
  const dayStart = Date.parse(`${dayKey}T00:00:00Z`);
  if (!Number.isFinite(dayStart) || Math.abs(dayStart - Date.now()) > 2 * DAY_MS) {
    throw badRequest('day is out of range');
  }

  const add = Math.min(secs, MAX_SECONDS_PER_BEAT);
  // $min caps the day in the same atomic update, so concurrent beats cannot overshoot.
  const doc = await AppUsage.findOneAndUpdate(
    { userId, day: dayKey },
    [{
      $set: {
        userId,
        day: dayKey,
        seconds: { $min: [MAX_SECONDS_PER_DAY, { $add: [{ $ifNull: ['$seconds', 0] }, add] }] },
        lastSeenAt: '$$NOW',
        createdAt: { $ifNull: ['$createdAt', '$$NOW'] },
        updatedAt: '$$NOW',
      },
    }],
    { upsert: true, new: true }
  ).lean();
  return { day: dayKey, seconds: doc.seconds };
}

/** Tracked minutes per local day, as a Map(day -> minutes). */
async function usageByDay(userId, sinceDay) {
  const query = { userId };
  if (sinceDay) query.day = { $gte: sinceDay };
  const rows = await AppUsage.find(query).select('day seconds').lean();
  return new Map(rows.map((r) => [r.day, r.seconds / 60]));
}

module.exports = { recordUsage, usageByDay, MAX_SECONDS_PER_BEAT, MAX_SECONDS_PER_DAY };
