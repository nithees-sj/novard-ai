const UsageCounter = require('../models/usageCounter');

/**
 * A cross-instance lock in MongoDB (Cloud Run may run several instances):
 * the first caller runs `fn`; others get { skipped: true } until it finishes
 * or the lock expires.
 */
async function withLock(name, ttlMs, fn) {
  const key = `lock:${name}`;
  const now = new Date();
  try {
    await UsageCounter.updateOne(
      { key, expiresAt: { $lt: now } },
      { $set: { value: 1, expiresAt: new Date(now.getTime() + ttlMs) } },
      { upsert: true }
    );
  } catch (error) {
    if (error?.code === 11000) return { skipped: true };
    throw error;
  }
  try {
    return await fn();
  } finally {
    await UsageCounter.deleteOne({ key }).catch(() => {});
  }
}

module.exports = { withLock };
