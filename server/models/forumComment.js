const mongoose = require('mongoose');

const forumCommentSchema = new mongoose.Schema({
  issueId: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  userEmail: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  isAI: {
    type: Boolean,
    default: false
  },
  parentCommentId: {
    type: String,
    default: null // For nested replies
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  upvotes: {
    type: Number,
    default: 0
  },
  downvotes: {
    type: Number,
    default: 0
  },
  isSolution: {
    type: Boolean,
    default: false
  }
});

// Update the updatedAt field before saving
forumCommentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for efficient querying
forumCommentSchema.index({ issueId: 1, createdAt: 1 });

module.exports = mongoose.model('ForumComment', forumCommentSchema);
