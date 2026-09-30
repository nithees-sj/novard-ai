const mongoose = require('mongoose');

/** What caused a past risk and what fixed it: the history lane's evidence (EWDI precedents). */
const riskPrecedentSchema = new mongoose.Schema({
  riskObjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'RiskObject' },
  area: { type: String, required: true },
  cause: String,
  resolution: String,
  effective: { type: Boolean, default: true },
  closedAt: { type: Date, default: Date.now },
  demo: Boolean,
});

riskPrecedentSchema.index({ area: 1, closedAt: -1 });

module.exports = mongoose.model('RiskPrecedent', riskPrecedentSchema);
