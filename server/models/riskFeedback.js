const mongoose = require('mongoose');

/** An admin's verdict on an investigation: accurate or not (EWDI feedback TP/FP). */
const riskFeedbackSchema = new mongoose.Schema({
  assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'RiskAssessment', required: true },
  adminId: { type: String, required: true },
  label: { type: String, enum: ['accurate', 'not_accurate'], required: true },
  note: String,
}, { timestamps: true });

riskFeedbackSchema.index({ assessmentId: 1, adminId: 1 }, { unique: true });

module.exports = mongoose.model('RiskFeedback', riskFeedbackSchema);
