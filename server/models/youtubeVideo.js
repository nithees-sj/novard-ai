const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const quizSchema = new mongoose.Schema({
  questions: [{
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: Number, required: true },
    explanation: { type: String, required: true }
  }],
  score: { type: Number, default: 0 },
  totalQuestions: { type: Number, default: 0 },
  settings: { // what the student asked for when generating this quiz
    difficulty: String,
    questionCount: Number,
    style: String,
    focus: String
  },
  completedAt: { type: Date, default: Date.now },
  attemptedAt: { type: Date, default: null }, // set when the student submits; analytics counts only these
});

const youtubeVideoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  videoUrl: { type: String, required: true },
  videoId: { type: String, required: true },
  description: { type: String, default: '' },
  transcript: { type: String, default: '' },
  summary: { type: String, default: '' },
  chatHistory: [chatMessageSchema],
  quizzes: [quizSchema],
  // LangChain conversation memory (see ai/conversation.js)
  memory: {
    summary: { type: String, default: '' },
    summarizedCount: { type: Number, default: 0 }
  },
  userId: { type: String, required: true },
  videoType: { type: String, enum: ['youtube', 'uploaded'], default: 'youtube' },
  videoPath: { type: String, default: '' }, // For uploaded videos
  originalFileName: { type: String, default: '' }, // For uploaded videos
  fileSize: { type: Number, default: 0 }, // For uploaded videos
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
youtubeVideoSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('YouTubeVideo', youtubeVideoSchema);
