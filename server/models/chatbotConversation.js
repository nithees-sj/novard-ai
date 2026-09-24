const mongoose = require('mongoose');

/**
 * Something the Novard Agent offered to do in the app (create a doubt, add a
 * video, generate a roadmap, ...). It is only carried out once the student
 * confirms it; see agent/actions.js.
 */
const actionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, required: true },
  status: { type: String, enum: ['proposed', 'running', 'done', 'dismissed', 'failed'], default: 'proposed' },
  args: { type: mongoose.Schema.Types.Mixed, default: {} },
  result: {
    itemId: String,
    route: String,
    label: String,
    note: String,
  },
  error: String,
  updatedAt: { type: Date, default: Date.now },
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
