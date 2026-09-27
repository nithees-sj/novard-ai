const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
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
    maxlength: 1000
  },
  platform: {
    type: String,
    required: true,
    enum: ['youtube', 'udemy', 'coursera', 'edureka'],
    default: 'youtube'
  },
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
videoSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

videoSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Video', videoSchema);
