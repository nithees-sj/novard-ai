const mongoose = require('mongoose');

/**
 * Time a student actually spends in the app, one document per student per
 * local calendar day. The client adds active seconds with a heartbeat
 * (see controllers/usageController.js and client hooks/useStudyTimeTracker.js).
 */
const appUsageSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // student's local date
  seconds: { type: Number, default: 0, min: 0 },
  lastSeenAt: Date,
}, { timestamps: true });

appUsageSchema.index({ userId: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('AppUsage', appUsageSchema);
