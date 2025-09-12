const mongoose = require('mongoose');

const doubtClearanceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  imageUrl: {
    type: String,
    default: null
  },
  userId: {
    type: String,
    required: true
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
  summary: {
    type: String,
    default: ''
  },
  quizzes: [{
    questions: [{
      question: String,
      options: [String],
      correctAnswer: Number
    }],
    score: Number,
    totalQuestions: Number,
    completedAt: {
      type: Date,
      default: Date.now
    }
  }],
  youtubeRecommendations: [{
    title: String,
    description: String,
    thumbnail: String,
    url: String,
    duration: String,
    reason: String,
    suggestedAt: {
      type: Date,
      default: Date.now
    }
  }],
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
doubtClearanceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('DoubtClearance', doubtClearanceSchema);
