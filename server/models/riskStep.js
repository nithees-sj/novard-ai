const mongoose = require('mongoose');

/** One node of an investigation run, for the live view and the run history (EWDI steps). */
const riskStepSchema = new mongoose.Schema({
  runId: { type: String, required: true },
  seq: { type: Number, required: true },
  node: { type: String, required: true },
  lane: String,
  inputSummary: String,
  outputSummary: String,
  latencyMs: { type: Number, default: 0 },
  usd: { type: Number, default: 0 },
  tokens: { type: Number, default: 0 },
  error: String,
  createdAt: { type: Date, default: Date.now },
});

riskStepSchema.index({ runId: 1, seq: 1 });

module.exports = mongoose.model('RiskStep', riskStepSchema);
