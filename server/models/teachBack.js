const mongoose = require('mongoose');

/**
 * Teach-Back Arena: a student explains a concept to Novard (playing a curious
 * classmate), gets marks and a flow of the concept showing where they lag,
 * then Novard teaches them the weak steps. See services/teachBackService.js.
 */

const turnSchema = new mongoose.Schema({
  role: { type: String, enum: ['student', 'novard'], required: true },
  text: { type: String, required: true },
  via: { type: String, enum: ['voice', 'text', null], default: null },
  at: { type: Date, default: Date.now },
}, { _id: false });

const coachMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  at: { type: Date, default: Date.now },
});

const teachBackSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  source: {
    kind: { type: String, enum: ['pdf', 'topic'], required: true },
    noteId: { type: mongoose.Schema.Types.ObjectId, default: null },
    label: { type: String, default: '' },
  },
  concept: { type: String, required: true },
  focus: { type: String, default: '' },
  // What the explanation is judged against (the PDF, condensed). Never sent to the client.
  reference: { type: String, default: '' },
  turns: [turnSchema],
  status: { type: String, enum: ['active', 'graded'], default: 'active' },
  result: {
    score: Number,
    verdict: String,
    flow: [{
      _id: false,
      step: String,
      status: { type: String, enum: ['good', 'partial', 'missed', 'wrong'] },
      feedback: String,
    }],
    corrections: [{ _id: false, youSaid: String, actually: String, why: String }],
    strengths: [String],
    nextStep: String,
  },
  previousScore: { type: Number, default: null },
  // Started from an Exam Autopilot task: the marks count as evidence for that topic.
  examRef: {
    examId: { type: mongoose.Schema.Types.ObjectId, default: null },
    topicId: { type: mongoose.Schema.Types.ObjectId, default: null },
    taskId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  gradedAt: Date,
  // "Teach me to get stronger": the tutor chat after grading.
  coaching: [coachMessageSchema],
  // LangChain conversation memory (see ai/conversation.js)
  memory: {
    summary: { type: String, default: '' },
    summarizedCount: { type: Number, default: 0 },
  },
}, { timestamps: true });

teachBackSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('TeachBack', teachBackSchema);
