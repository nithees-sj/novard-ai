const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const quizSchema = new mongoose.Schema({
  quizId: {
    type: String,
    required: true
  },
  questions: [{
    question: String,
    options: [String],
    // Index 0-3 for quizzes generated now; older quizzes stored a letter ("C").
    correctAnswer: mongoose.Schema.Types.Mixed,
    explanation: String
  }],
  settings: { // what the student asked for when generating this quiz
    difficulty: String,
    questionCount: Number,
    style: String,
    focus: String
  },
  userAnswers: {
    type: Map,
    of: String
  },
  score: {
    correct: Number,
    total: Number,
    percentage: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  attemptedAt: { type: Date, default: null }, // set when the student submits; analytics counts only these
});

const notesSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  extractedText: {
    type: String,
    required: true
  },
  summary: {
    type: String,
    default: ''
  },
  chatHistory: [chatMessageSchema],
  quizzes: [quizSchema],
  // LangChain conversation memory (see ai/conversation.js)
  memory: {
    summary: { type: String, default: '' },
    summarizedCount: { type: Number, default: 0 }
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  lastAccessed: {
    type: Date,
    default: Date.now
  }
});

const Notes = mongoose.model('Notes', notesSchema);

module.exports = Notes;
