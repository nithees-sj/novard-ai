const mongoose = require('mongoose');

/**
 * One ongoing risk: an area + topic that went HIGH or worse, tracked across
 * scoring cycles so the same problem is not re-raised every cycle (EWDI
 * risk_objects). States: new, ongoing, escalated, resolved, recurring.
 */
const riskObjectSchema = new mongoose.Schema({
  area: { type: String, required: true },
  topic: { type: String, required: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReportTopic' },
  dedupeKey: { type: String, required: true, unique: true }, // area:topic
  state: { type: String, enum: ['new', 'ongoing', 'escalated', 'resolved', 'recurring'], default: 'new' },
  peakScore: { type: Number, default: 0 },
  currentScore: { type: Number, default: 0 },
  lowStreak: { type: Number, default: 0 },
  riseStreak: { type: Number, default: 0 },
  lastWindowEnd: Date, // the last scoring cycle applied (cycles are applied once)
  flagged: { type: Boolean, default: false }, // an investigation's auto action: shown on the risk board
  flaggedReason: String,
  firstDetectedAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  demo: Boolean,
}, { timestamps: true });

riskObjectSchema.index({ area: 1, state: 1 });
riskObjectSchema.index({ state: 1, lastSeenAt: -1 });

module.exports = mongoose.model('RiskObject', riskObjectSchema);
