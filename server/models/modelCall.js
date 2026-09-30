const mongoose = require('mongoose');

/** Days a model-call row is kept (TTL). Features need 28 days; the gateway pages show 30. */
const RETENTION_DAYS = Number(process.env.MODEL_CALL_RETENTION_DAYS) || 45;

/**
 * One row per AI model call, from every feature in the app: what it cost, how
 * long it took and whether it worked. Feeds the gateway pages, the cost views
 * and the investigation's telemetry lane. Cited in investigations as MC-<id>.
 */
const modelCallSchema = new mongoose.Schema({
  feature: { type: String, default: 'unknown' }, // config/admin.js AI_FEATURES
  area: String,
  task: String, // config/ai.js TASKS, for the early-warning calls
  provider: { type: String, enum: ['groq', 'gemini'], required: true },
  model: { type: String, required: true },
  tokensIn: { type: Number, default: 0 },
  tokensOut: { type: Number, default: 0 },
  usd: { type: Number, default: 0 },
  latencyMs: { type: Number, default: 0 },
  attempt: { type: Number, default: 1 },
  // ok | 429 (per-minute limit) | 429_daily (quota used up) | 5xx | invalid_json | blocked (switched off / capped) | error
  outcome: { type: String, required: true },
  error: String,
  routedBy: String,
  runId: String,
  stepSeq: Number,
  conversationId: String,
  userId: String,
  demo: Boolean, // npm run risk:seed-demo
  createdAt: { type: Date, default: Date.now },
});

modelCallSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 3600 });
modelCallSchema.index({ feature: 1, createdAt: -1 });
modelCallSchema.index({ area: 1, createdAt: -1 });
modelCallSchema.index({ model: 1, createdAt: -1 });
modelCallSchema.index({ outcome: 1, createdAt: -1 });
modelCallSchema.index({ runId: 1, createdAt: 1 });
modelCallSchema.index({ userId: 1, createdAt: -1 });
modelCallSchema.index({ conversationId: 1 });
modelCallSchema.index({ demo: 1 });

module.exports = mongoose.model('ModelCall', modelCallSchema);
module.exports.RETENTION_DAYS = RETENTION_DAYS;
