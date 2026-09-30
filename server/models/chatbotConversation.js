const mongoose = require('mongoose');

/**
 * Something the Novard Agent offers or prepares in the app (a doubt, video,
 * roadmap, ...); see agent/actions.js.
 *   proposed  a suggestion card ("Yes" continues in the chat -> accepted), or a
 *             "remember this?" card for the learner profile
 *   draft     a filled-in draft the student reviews, edits and creates
 *   running -> done | failed; or dismissed, or superseded by a newer draft
 */
const actionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, required: true },
  status: { type: String, enum: ['proposed', 'accepted', 'draft', 'running', 'done', 'dismissed', 'failed', 'superseded'], default: 'proposed' },
  // 'suggested': the agent offered it; 'requested': the student asked for it (a draft).
  origin: { type: String, enum: ['suggested', 'requested'], default: 'suggested' },
  args: { type: mongoose.Schema.Types.Mixed, default: {} },
  // Where each draft field came from: 'chat' | 'profile' | 'assumed' | 'auto' | 'edited'.
  provenance: { type: mongoose.Schema.Types.Mixed, default: undefined },
  result: {
    itemId: String,
    route: String,
    label: String,
    note: String,
  },
  error: String,
  updatedAt: { type: Date, default: Date.now },
}, { _id: false });

/** Questions the agent asked, shown as tap-to-answer chips. */
const askSchema = new mongoose.Schema({
  intro: String,
  questions: [{
    _id: false,
    key: String,
    question: { type: String, required: true },
    options: [String],
    multiSelect: Boolean,
  }],
}, { _id: false });

/** A conversation with the Novard Agent (the floating assistant). */
const chatbotConversationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  title: { type: String, default: 'New chat', maxlength: 120 },
  messages: [{
    _id: false,
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, default: '' },
    actions: { type: [actionSchema], default: undefined },
    ask: { type: askSchema, default: undefined },
    createdAt: { type: Date, default: Date.now },
  }],
  // LangChain conversation memory (see ai/conversation.js)
  memory: {
    summary: { type: String, default: '' },
    summarizedCount: { type: Number, default: 0 },
  },
}, { timestamps: true });

chatbotConversationSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('ChatbotConversation', chatbotConversationSchema);
// The admin assistant's conversations reuse the card schema (models/adminConversation.js).
module.exports.actionSchema = actionSchema;
