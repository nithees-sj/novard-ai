const mongoose = require('mongoose');

/** An area's risk for one window: anomaly z, score, level and what drove it. */
const riskScoreSchema = new mongoose.Schema({
  area: { type: String, required: true },
  windowEnd: { type: Date, required: true },
  anomalyZ: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  level: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true },
  attribution: { type: [mongoose.Schema.Types.Mixed], default: [] },
  // scored = normal; insufficient_baseline = too little history, fixed thresholds only
  status: { type: String, enum: ['scored', 'insufficient_baseline'], default: 'scored' },
  levelsFrom: { type: String, enum: ['percentile', 'fixed'], default: 'fixed' },
  // The complaint rule: its count, the level it calls for, and whether it set `level`.
  complaints: { type: mongoose.Schema.Types.Mixed, default: null },
  anomalyLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
  modelVersion: { type: String, default: 'anomaly-v1' },
  demo: Boolean,
}, { timestamps: true });

riskScoreSchema.index({ area: 1, windowEnd: 1 }, { unique: true });
riskScoreSchema.index({ windowEnd: -1, score: -1 });
riskScoreSchema.index({ level: 1, windowEnd: -1 });

module.exports = mongoose.model('RiskScore', riskScoreSchema);
