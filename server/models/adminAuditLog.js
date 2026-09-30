const mongoose = require('mongoose');

/**
 * One row per admin mutation: who did what to which target, with the value
 * before and after. Append-only; the console shows it read-only.
 */
const adminAuditLogSchema = new mongoose.Schema({
  adminId: { type: String, required: true }, // email, or "cli" / "system"
  adminRole: String,
  action: { type: String, required: true }, // e.g. setting.update, report.resolve, user.suspend
  target: {
    type: { type: String },
    id: String,
  },
  before: mongoose.Schema.Types.Mixed,
  after: mongoose.Schema.Types.Mixed,
  ip: String,
  createdAt: { type: Date, default: Date.now },
}, { minimize: false });

adminAuditLogSchema.index({ createdAt: -1 });
adminAuditLogSchema.index({ adminId: 1, createdAt: -1 });
adminAuditLogSchema.index({ action: 1, createdAt: -1 });
adminAuditLogSchema.index({ 'target.type': 1, 'target.id': 1, createdAt: -1 });

module.exports = mongoose.model('AdminAuditLog', adminAuditLogSchema);
