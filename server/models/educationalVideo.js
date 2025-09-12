const mongoose = require('mongoose');

const educationalVideoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  videoUrl: {
    type: String,
    required: true,
    trim: true
  },
  videoId: {
    type: String,
    required: true
  },
  platform: {
    type: String,
    required: true,
    enum: ['youtube', 'udemy', 'coursera', 'edureka'],
    default: 'youtube'
  },
  description: {
    type: String,
    default: '',
    maxlength: 2000
  },
  transcript: {
    type: String,
    default: ''
  },
  summary: {
    type: String,
    default: ''
  },
  chatHistory: [{
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
  }],
  quizzes: [{
    questions: [{
      question: String,
      options: [String],
      correctAnswer: Number,
      explanation: String
    }],
    totalQuestions: Number,
    score: Number,
    completedAt: Date
  }],
  userId: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
educationalVideoSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('EducationalVideo', educationalVideoSchema);
