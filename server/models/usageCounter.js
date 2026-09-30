const mongoose = require('mongoose');

/**
 * Small daily counters kept with a cheap $inc instead of aggregating on every
 * request: the day's AI spend (`spend:2026-09-30`) and each student's AI
 * requests that day (`ai:<email>:2026-09-30`). Rows expire after a few days.
 */
const usageCounterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

usageCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('UsageCounter', usageCounterSchema);
