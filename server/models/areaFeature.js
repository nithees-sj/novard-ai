const mongoose = require('mongoose');

/**
 * One area's day: its raw daily metrics (`daily`) and the feature vector of
 * the 7-day window ending that day against its 21-day baseline (`f`).
 * Keeping the daily metrics here preserves history after model-call logs expire.
 */
const areaFeatureSchema = new mongoose.Schema({
  area: { type: String, required: true },
  windowEnd: { type: Date, required: true }, // UTC midnight of the window's last day
  windowDays: { type: Number, default: 7 },
  daily: { type: mongoose.Schema.Types.Mixed, default: {} },
  f: { type: mongoose.Schema.Types.Mixed, default: null },
  baselineActiveDays: { type: Number, default: 0 },
  demo: Boolean,
}, { timestamps: true, minimize: false });

areaFeatureSchema.index({ area: 1, windowEnd: 1 }, { unique: true });
areaFeatureSchema.index({ windowEnd: -1 });

module.exports = mongoose.model('AreaFeature', areaFeatureSchema);
