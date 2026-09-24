const mongoose = require('mongoose');

/** A conversation with the general-purpose assistant (the floating chatbot). */
const chatbotConversationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  title: { type: String, default: 'New chat', maxlength: 120 },
  messages: [{
    _id: false,
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
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
