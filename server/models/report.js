const mongoose = require('mongoose');

/**
 * A student's report of a problem with the app (EWDI's support ticket).
 *
 * Quota: a student may have a few OPEN reports per area. Each open report
 * holds one numbered slot (0..max-1) under a unique partial index, so two
 * reports submitted at the same moment can never both take the last slot.
 * Resolving a report frees its slot.
 */

const noteSchema = new mongoose.Schema({
  author: String, // email
  authorName: String,
  authorRole: { type: String, enum: ['student', 'admin', 'system'], required: true },
  body: { type: String, required: true, maxlength: 4000 },
  internal: { type: Boolean, default: false }, // admins only
  at: { type: Date, default: Date.now },
}, { _id: false });

const attachmentSchema = new mongoose.Schema({
  kind: { type: String, enum: ['screenshot', 'voice', 'pdf'], required: true },
  path: { type: String, required: true }, // relative to UPLOAD_DIR
  mime: String,
  size: Number,
  originalName: String,
}, { _id: false });

const reportSchema = new mongoose.Schema({
  ref: { type: String, required: true, unique: true }, // NV-XXXXXXXX
  userId: { type: String, required: true }, // email
  userName: String,
  area: { type: String, required: true },
  routedBy: { type: String, enum: ['context', 'student', 'rules', 'model'], default: 'student' },

  // Where it was reported from, and the AI message it is about.
  source: {
    page: String,
    tool: String,
    itemType: String,
    itemId: String,
    messageIndex: Number,
    messageId: String,
    excerpt: String, // the AI message / quiz question, copied from the DB when it could be found
    excerptVerified: Boolean,
  },

  text: { type: String, required: true },
  transcript: String,
  pdfText: String,
  attachments: [attachmentSchema],
  channel: { type: String, enum: ['text', 'voice', 'pdf', 'screenshot'], default: 'text' },

  enrichment: {
    status: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending' },
    intent: String,
    urgency: String,
    sentiment: Number,
    topic: String,
    isRepeat: Boolean,
    suggestedArea: String,
    model: String,
    promptVersion: String,
    at: Date,
    error: String,
    attempts: { type: Number, default: 0 },
  },

  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  open: { type: Boolean, default: true },
  quotaSlot: Number,
  assignedTo: String,
  firstResponseAt: Date,
  resolvedAt: Date,
  resolveBatchId: String,
  notes: [noteSchema],
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReportTopic' },
  embedded: { type: Boolean, default: false },
  demo: Boolean, // created by npm run risk:seed-demo
}, { timestamps: true });

reportSchema.index(
  { userId: 1, area: 1, quotaSlot: 1 },
  { unique: true, partialFilterExpression: { open: true }, name: 'open_report_quota' }
);
reportSchema.index({ area: 1, createdAt: -1 });
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ userId: 1, createdAt: -1 });
reportSchema.index({ 'enrichment.status': 1, createdAt: 1 });
reportSchema.index({ 'enrichment.urgency': 1, createdAt: -1 });
reportSchema.index({ embedded: 1, createdAt: 1 });
reportSchema.index({ resolveBatchId: 1 });
reportSchema.index({ assignedTo: 1, status: 1 });
reportSchema.index({ demo: 1 });
reportSchema.index({ text: 'text', transcript: 'text', 'source.excerpt': 'text' }, { weights: { text: 3, transcript: 2, 'source.excerpt': 1 }, name: 'report_text' });

module.exports = mongoose.model('Report', reportSchema);
