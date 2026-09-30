const mongoose = require('mongoose');
const { RETENTION_DAYS } = require('./modelCall');

/**
 * Calls to the non-AI outside services: YouTube (search, captions, metadata),
 * Google sign-in and PDF reading. Success and failure rates on the gateway
 * pages, and the "is it YouTube?" evidence in investigations (GW-<id>).
 */
const gatewayEventSchema = new mongoose.Schema({
  gateway: { type: String, enum: ['youtube', 'oauth', 'pdf'], required: true },
  operation: { type: String, required: true }, // search | captions | metadata | session | tokeninfo | extract | ocr
  // rejected: the service answered but refused the input (an expired or fake sign-in token): not a failure of the service
  outcome: { type: String, enum: ['ok', 'fail', 'missing', 'disabled', 'rejected'], required: true },
  latencyMs: { type: Number, default: 0 },
  area: String,
  error: String,
  demo: Boolean,
  createdAt: { type: Date, default: Date.now },
});

gatewayEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 3600 });
gatewayEventSchema.index({ gateway: 1, createdAt: -1 });
gatewayEventSchema.index({ area: 1, createdAt: -1 });

module.exports = mongoose.model('GatewayEvent', gatewayEventSchema);
