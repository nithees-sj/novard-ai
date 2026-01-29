const mongoose = require('mongoose');

const skillPlanSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  skillName: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 10
  },
  description: {
    type: String,
    required: true
  },
  preferences: {
    level: {
      type: String,
      enum: ['beginner', 'intermediate'],
      default: 'beginner'
    },
    focusAreas: [String],
    language: {
      type: String,
      default: 'English'
    },
    teachingStyle: {
      type: String,
      default: 'Standard'
    }
  },
  dailyPlan: [{
    day: {
      type: Number,
      required: true
    },
    topic: {
      type: String,
      required: true
    },
    objective: {
      type: String,
      required: true
    },
    youtubeVideo: {
      videoId: String,
      title: String,
      url: String,
      thumbnailUrl: String
    },
    completed: {
      type: Boolean,
      default: false
    },
    completedAt: Date
  }],
  quizCompleted: {
    type: Boolean,
    default: false
  },
  quizScore: Number,
  quizId: String,
  quizConfiguration: {
    questionCount: {
      type: Number,
      min: 5,
      max: 20,
      default: 10
    },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate'
    },
    createdAt: Date
  },
  quizResults: [{
    score: Number,
    correctAnswers: Number,
    totalQuestions: Number,
    questionCount: Number,
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced']
    },
    completedDaysAtQuiz: Number,
    completedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Index for faster queries
skillPlanSchema.index({ userId: 1, createdAt: -1 });

const SkillPlan = mongoose.model('SkillPlan', skillPlanSchema);

module.exports = SkillPlan;
