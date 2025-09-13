const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String, // Base64 encoded image or URL
    default: null
  },
  videos: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    contentSummary: {
      type: String,
      trim: true
    },
    driveLink: {
      type: String,
      required: true,
      trim: true
    },
    thumbnail: {
      type: String, // Base64 encoded image or URL
      default: null
    },
    quiz: {
      title: String,
      description: String,
      questions: [{
        question: String,
        options: [String],
        correctAnswer: Number,
        explanation: String
      }],
      createdAt: {
        type: Date,
        default: Date.now
      }
    },
    quizResults: [{
      userEmail: String,
      answers: [Number],
      score: Number,
      correctAnswers: Number,
      totalQuestions: Number,
      completedAt: {
        type: Date,
        default: Date.now
      }
    }],
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  teacherEmail: {
    type: String,
    required: true,
    trim: true
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
courseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Course', courseSchema);
