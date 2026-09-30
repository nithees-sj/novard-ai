const mongoose = require('mongoose');

/**
 * An admin alert: an area's risk ROSE to HIGH or CRITICAL (EWDI admin_alerts).
 * Unique on (area, windowEnd, level): one alert per escalation episode, plus
 * one for each worsening within it, however often the scorer runs.
 */
const riskAlertSchema = new mongoose.Schema({
  area: { type: String, required: true },
  windowEnd: { type: Date, required: true },
  level: { type: String, enum: ['HIGH', 'CRITICAL'], required: true },
  prevLevel: String,
  score: Number,
  prevScore: Number,
  drivers: { type: [mongoose.Schema.Types.Mixed], default: [] },
  message: String,
  acknowledgedBy: String,
  acknowledgedAt: Date,
  demo: Boolean,
}, { timestamps: true });

riskAlertSchema.index({ area: 1, windowEnd: 1, level: 1 }, { unique: true });
riskAlertSchema.index({ acknowledgedAt: 1, createdAt: -1 });

module.exports = mongoose.model('RiskAlert', riskAlertSchema);
