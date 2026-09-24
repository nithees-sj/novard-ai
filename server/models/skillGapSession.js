const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  skill: String,
  importance: { type: String, enum: ['core', 'nice'] },
  have: Boolean,
  why: String,
  priority: { type: String, enum: ['high', 'medium', 'low', null] },
  effortWeeks: Number,
  firstStep: String,
}, { _id: false });

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

/** One skill-gap coaching conversation: the learner's profile, the analysis, and the chat. */
const skillGapSessionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  profile: {
    targetRole: { type: String, required: true, maxlength: 80 },
    currentSkills: [String],
    experience: String,
    goal: String,
    hoursPerWeek: Number,
  },
  analysis: {
    summary: String,
    readiness: Number,
    strengths: [skillSchema],
    gaps: [skillSchema],
    nextSteps: [String],
  },
  messages: [messageSchema],
  // LangChain conversation memory (see ai/conversation.js)
  memory: {
    summary: { type: String, default: '' },
    summarizedCount: { type: Number, default: 0 }
  },
}, { timestamps: true });

skillGapSessionSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('SkillGapSession', skillGapSessionSchema);
