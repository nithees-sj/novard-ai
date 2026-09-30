const mongoose = require('mongoose');

const evidenceSchema = new mongoose.Schema({
  id: String, // E1, E2 ... (citable)
  lane: String, // temporal | peers | history | semantic | telemetry
  kind: String, // metric | peer | precedent | record | telemetry | error
  summary: String,
  citeIds: [String], // report refs (NV-...), model calls (MC-...), gateway events (GW-...)
  data: mongoose.Schema.Types.Mixed,
}, { _id: false });

const recommendationSchema = new mongoose.Schema({
  id: String,
  action: String, // what to do, in words
  actionType: String, // config/earlyWarning.js RECOMMENDATION_TYPES
  params: mongoose.Schema.Types.Mixed,
  kind: { type: String, enum: ['preventive', 'corrective'], default: 'corrective' },
  priority: { type: Number, default: 3 },
  rationale: String,
  evidenceIds: [String],
  expectedEffect: String,
  execution: { type: String, enum: ['auto', 'manual'], default: 'manual' },
  status: { type: String, enum: ['auto_executed', 'awaiting_approval', 'approved', 'dismissed', 'failed', 'advice'], default: 'awaiting_approval' },
  approvedBy: String,
  decidedAt: Date,
  result: mongoose.Schema.Types.Mixed,
  error: String,
}, { _id: false });

/**
 * One investigation run (EWDI runs + findings + verifications + predictions
 * + recommendations, embedded: they are always read together).
 */
const riskAssessmentSchema = new mongoose.Schema({
  runId: { type: String, required: true, unique: true },
  area: { type: String, required: true },
  windowEnd: Date,
  riskObjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'RiskObject' },
  riskState: String,
  trigger: { type: String, enum: ['schedule', 'admin', 'assistant'], default: 'admin' },
  triggeredBy: String,
  status: { type: String, enum: ['running', 'done', 'error'], default: 'running' },
  outcome: { type: String, enum: ['investigated', 'no_investigation_needed', 'investigation_incomplete', null], default: null },
  risk: mongoose.Schema.Types.Mixed, // { score, level, anomalyZ, attribution }
  budget: { usdMax: Number, usdUsed: { type: Number, default: 0 }, tokensMax: Number, tokensUsed: { type: Number, default: 0 } },
  lanesDone: [String],
  supervisorReason: String,
  evidence: [evidenceSchema],
  hypotheses: [mongoose.Schema.Types.Mixed], // { cause, confidence, evidenceIds, contradictingIds, degraded, uncited }
  verification: mongoose.Schema.Types.Mixed, // { verdict, unsupported, ignoredContradictions, overconfident, note, model }
  revisionCount: { type: Number, default: 0 },
  predictions: mongoose.Schema.Types.Mixed, // { horizonDays, pIncident, baseScore, whatif, method }
  recommendations: [recommendationSchema],
  degraded: { type: Boolean, default: false },
  runErrors: [String], // nodes that failed or degraded (not `errors`: reserved by Mongoose)
  startedAt: { type: Date, default: Date.now },
  endedAt: Date,
  demo: Boolean,
}, { minimize: false });

riskAssessmentSchema.index({ area: 1, startedAt: -1 });
riskAssessmentSchema.index({ status: 1, startedAt: -1 });
riskAssessmentSchema.index({ riskObjectId: 1, startedAt: -1 });
riskAssessmentSchema.index({ startedAt: -1 });

module.exports = mongoose.model('RiskAssessment', riskAssessmentSchema);
