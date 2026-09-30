const mongoose = require('mongoose');
const { actionSchema } = require('./chatbotConversation');

/**
 * A conversation with the admin assistant (the console's copy of the Novard
 * Agent). A separate collection rather than a `scope` on ChatbotConversation:
 * student queries (agent history, study analytics) read that collection by
 * userId, and admin chats hold other students' data. Kept apart, one missed
 * filter can never show them in a student's history. The message and card
 * shapes are shared.
 */
const toolTraceSchema = new mongoose.Schema({
  name: String,
  args: mongoose.Schema.Types.Mixed,
  ok: Boolean,
  ms: Number,
  preview: String, // the tool result as logged (trimmed to 2,000 characters)
}, { _id: false });

const adminConversationSchema = new mongoose.Schema({
  adminId: { type: String, required: true }, // email
  title: { type: String, default: 'New chat', maxlength: 120 },
  messages: [{
    _id: false,
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, default: '' },
    actions: { type: [actionSchema], default: undefined },
    tools: { type: [toolTraceSchema], default: undefined },
    flags: {
      forcedTool: Boolean, // the evidence guard made it look the answer up
      unverifiedNumbers: Boolean, // figures that could not be matched to tool results
      refused: Boolean, // asked for something only the console may do
      capped: Boolean, // stopped by the per-turn cost cap
    },
    usd: Number,
    createdAt: { type: Date, default: Date.now },
  }],
  memory: {
    summary: { type: String, default: '' },
    summarizedCount: { type: Number, default: 0 },
  },
}, { timestamps: true });

adminConversationSchema.index({ adminId: 1, updatedAt: -1 });

module.exports = mongoose.model('AdminConversation', adminConversationSchema);
