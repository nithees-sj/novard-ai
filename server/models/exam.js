const mongoose = require('mongoose');

/**
 * Exam Autopilot: one exam a student is preparing for - its syllabus as
 * weighted topics, the evidence of what they know, and a day-by-day plan that
 * re-plans itself. The engine lives in services/examAutopilot/; this is only
 * what is stored. Days are "YYYY-MM-DD" in the student's own time zone.
 *
 * Saved with optimistic concurrency: a result recorded while another request
 * re-plans is retried on fresh data instead of overwriting it.
 */

const { ObjectId } = mongoose.Schema.Types;

const evidenceSchema = new mongoose.Schema({
  at: { type: String, required: true },
  kind: { type: String, enum: ['quiz', 'mock', 'diagnostic', 'teachback', 'self'], required: true },
  score: { type: Number, min: 0, max: 1, required: true },
  weight: { type: Number, min: 0, required: true },
  ref: { type: String, default: '' },
}, { _id: false });

const topicSchema = new mongoose.Schema({
  name: { type: String, required: true },
  summary: { type: String, default: '' },
  importance: { type: Number, default: 5 },
  weight: { type: Number, default: 0 },
  difficulty: { type: Number, enum: [1, 2, 3], default: 2 },
  order: { type: Number, default: 0 },
  prerequisites: [ObjectId],
  evidence: [evidenceSchema],
  reviewStage: { type: Number, default: 0 },
  learnedAt: { type: String, default: null },
});

const taskSchema = new mongoose.Schema({
  topicId: { type: ObjectId, default: null },
  type: { type: String, enum: ['learn', 'practice', 'teach', 'review', 'mock'], required: true },
  minutes: { type: Number, required: true },
  gain: { type: Number, default: 0 }, // expected exam-day readiness points
  reason: { type: String, default: '' },
  status: { type: String, enum: ['todo', 'done', 'skipped', 'missed'], default: 'todo' },
  doneAt: Date,
  quizId: { type: ObjectId, default: null },
});

const daySchema = new mongoose.Schema({
  date: { type: String, required: true },
  phase: { type: String, enum: ['learn', 'consolidate', 'mock', 'light', 'rest'], default: 'learn' },
  rest: { type: Boolean, default: false },
  tasks: [taskSchema],
}, { _id: false });

const quizSchema = new mongoose.Schema({
  kind: { type: String, enum: ['check', 'practice', 'review', 'diagnostic', 'mock'], required: true },
  taskId: { type: ObjectId, default: null },
  topicIds: [ObjectId],
  questions: [{
    _id: false,
    question: String,
    options: [String],
    correctAnswer: Number,
    explanation: String,
    topicId: ObjectId,
  }],
  answers: [Number],
  correct: Number,
  total: Number,
  createdAt: { type: Date, default: Date.now },
  submittedAt: Date,
});

const examSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft' },
  title: { type: String, required: true },
  examDate: { type: String, default: null },
  dailyMinutes: { type: Number, default: 60 },
  restDays: { type: [Number], default: [] },
  targetReadiness: { type: Number, default: 70 },
  source: {
    kind: { type: String, enum: ['pdf', 'note', 'text'], default: 'text' },
    noteId: { type: ObjectId, default: null },
    label: { type: String, default: '' },
  },
  // The syllabus as read (condensed when long). Never sent to the client.
  syllabus: { type: String, default: '', select: false },
  topics: [topicSchema],
  plan: [daySchema],
  plannedFor: { type: String, default: null },
  forecast: {
    now: Number,
    projected: Number,
    low: Number,
    high: Number,
    reached: String,
    series: [{ _id: false, date: String, readiness: Number }],
    advice: { onTrack: Boolean, minutes: Number, projected: Number },
  },
  planLog: [{ _id: false, at: String, trigger: String, summary: String }],
  snapshots: [{ _id: false, date: String, readiness: Number, projected: Number }],
  quizzes: [quizSchema],
  remindedFor: { type: String, default: null },
  // The exam's own tutor chat (services/examService.js tutorChat), and its LangChain memory (ai/conversation.js).
  tutor: [{
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    topicId: { type: ObjectId, default: null },
    at: { type: Date, default: Date.now },
  }],
  memory: {
    summary: { type: String, default: '' },
    summarizedCount: { type: Number, default: 0 },
  },
}, { timestamps: true, optimisticConcurrency: true });

examSchema.index({ userId: 1, status: 1, examDate: 1 });

module.exports = mongoose.model('Exam', examSchema);
