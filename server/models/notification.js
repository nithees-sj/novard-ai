const mongoose = require('mongoose');

/**
 * An update for a student, shown under the bell in the header: a report was
 * resolved or answered, or an announcement from the Novard team.
 */
const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // email
  kind: { type: String, enum: ['report_resolved', 'report_reply', 'announcement', 'ai_limit', 'todo_due'], required: true },
  title: { type: String, required: true, maxlength: 200 },
  body: { type: String, default: '', maxlength: 2000 },
  reportRefs: [String],
  link: String, // in-app path, e.g. /reports/NV-1A2B3C4D
  announcementId: String,
  readAt: Date,
  createdAt: { type: Date, default: Date.now },
});

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });
notificationSchema.index({ announcementId: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
