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
    correctAnswer: String
  }],
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
  }
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
