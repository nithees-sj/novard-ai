const mongoose = require('mongoose');

const forumIssueSchema = new mongoose.Schema({
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
  userEmail: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  issueId: {
    type: String,
    unique: true,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['open', 'closed', 'resolved'],
    default: 'open'
  },
  // What kind of post this is. Separate from status: a tutorial can be open or
  // resolved. Posts created before this field existed read as 'general'.
  category: {
    type: String,
    enum: ['general', 'tutorial', 'urgent', 'ideation', 'showcase'],
    default: 'general',
    index: true
  },
  tags: [{
    type: String
  }],
  upvotes: {
    type: Number,
    default: 0
  },
  downvotes: {
    type: Number,
    default: 0
  }
});

// Update the updatedAt field before saving
forumIssueSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ForumIssue', forumIssueSchema);
