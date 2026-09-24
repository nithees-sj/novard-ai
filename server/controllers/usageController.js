const AppUsage = require('../models/appUsage');

/**
 * Heartbeat from the client's study-time tracker: "this student was active
 * in the app for N more seconds on local day D".
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

const recordUsage = async (req, res) => {
  try {
    // sendBeacon posts text/plain; accept both that and JSON.
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const userId = String(body.userId || '').trim();
    const day = String(body.day || '');
    const seconds = Math.round(Number(body.seconds));

    if (!userId || userId.length > 200) return res.status(400).json({ error: 'userId is required' });
    if (!DAY_RE.test(day)) return res.status(400).json({ error: 'day must be YYYY-MM-DD' });
    if (!Number.isFinite(seconds) || seconds <= 0) return res.status(400).json({ error: 'seconds must be positive' });

    // The day must be within a day of the server's clock (any timezone), so
    // time cannot be booked to arbitrary past or future dates.
    const dayStart = Date.parse(`${day}T00:00:00Z`);
    if (!Number.isFinite(dayStart) || Math.abs(dayStart - Date.now()) > 2 * DAY_MS) {
      return res.status(400).json({ error: 'day is out of range' });
    }

    const add = Math.min(seconds, MAX_SECONDS_PER_BEAT);
    const doc = await AppUsage.findOneAndUpdate(
      { userId, day },
      { $inc: { seconds: add }, $set: { lastSeenAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (doc.seconds > MAX_SECONDS_PER_DAY) {
      await AppUsage.updateOne({ _id: doc._id }, { $set: { seconds: MAX_SECONDS_PER_DAY } });
      doc.seconds = MAX_SECONDS_PER_DAY;
    }
    res.json({ day, seconds: doc.seconds });
  } catch (error) {
    if (error instanceof SyntaxError) return res.status(400).json({ error: 'Invalid body' });
    console.error('Error recording app usage:', error);
    res.status(500).json({ error: 'Failed to record usage' });
  }
};

/** Tracked minutes per local day, as a Map(day -> minutes). */
async function usageByDay(userId, sinceDay) {
  const query = { userId };
  if (sinceDay) query.day = { $gte: sinceDay };
  const rows = await AppUsage.find(query).select('day seconds').lean();
  return new Map(rows.map((r) => [r.day, r.seconds / 60]));
}

module.exports = { recordUsage, usageByDay };
