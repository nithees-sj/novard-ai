const ForumIssue = require('../models/forumIssue');
const ForumComment = require('../models/forumComment');
const { 
  generateAICommentForIssue, 
  generateAIResponseToComment 
} = require('./forumAIController');

// Generate unique issue ID
const generateIssueId = () => {
  return 'ISSUE_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Create a new forum issue
const createIssue = async (req, res) => {
  try {
    const { title, description, userEmail, userName, tags = [] } = req.body;

    if (!title || !description || !userEmail || !userName) {
      return res.status(400).json({ error: 'Title, description, user email, and user name are required' });
    }

    const issueId = generateIssueId();
    
    const newIssue = new ForumIssue({
      title,
      description,
      userEmail,
      userName,
      issueId,
      tags
    });

    const savedIssue = await newIssue.save();

    // Generate AI comment for the new issue
    try {
      const aiResponse = await generateAICommentForIssue(savedIssue);
      const aiComment = new ForumComment({
        issueId: savedIssue.issueId,
        content: aiResponse,
        userEmail: 'ai@novard.com',
        userName: 'AI Assistant',
        isAI: true
      });
      await aiComment.save();
    } catch (aiError) {
      console.error('Error generating AI comment:', aiError);
      // Continue even if AI comment fails
    }

    res.status(201).json(savedIssue);
  } catch (error) {
    console.error('Error creating issue:', error);
    res.status(500).json({ error: 'Failed to create issue' });
  }
};

// Get all forum issues
const getAllIssues = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'open', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const query = status === 'all' ? {} : { status };
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const issues = await ForumIssue.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await ForumIssue.countDocuments(query);

    res.json({
      issues,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching issues:', error);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
};

// Get a specific issue by ID
const getIssueById = async (req, res) => {
  try {
    const { issueId } = req.params;
    
    const issue = await ForumIssue.findOne({ issueId });
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    res.json(issue);
  } catch (error) {
    console.error('Error fetching issue:', error);
    res.status(500).json({ error: 'Failed to fetch issue' });
  }
};

// Get comments for a specific issue
const getIssueComments = async (req, res) => {
  try {
    const { issueId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const comments = await ForumComment.find({ issueId })
      .sort({ createdAt: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await ForumComment.countDocuments({ issueId });

    res.json({
      comments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

// Add a comment to an issue
const addComment = async (req, res) => {
  try {
    const { issueId, content, userEmail, userName, parentCommentId = null } = req.body;

    if (!issueId || !content || !userEmail || !userName) {
      return res.status(400).json({ error: 'Issue ID, content, user email, and user name are required' });
    }

    // Check if issue exists
    const issue = await ForumIssue.findOne({ issueId });
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const newComment = new ForumComment({
      issueId,
      content,
      userEmail,
      userName,
      parentCommentId
    });

    const savedComment = await newComment.save();

    // Generate AI response to the comment
    try {
      const aiResponse = await generateAIResponseToComment(savedComment, issue);
      const aiComment = new ForumComment({
        issueId: issue.issueId,
        content: aiResponse,
        userEmail: 'ai@novard.com',
        userName: 'AI Assistant',
        isAI: true,
        parentCommentId: savedComment._id.toString()
      });
      await aiComment.save();
    } catch (aiError) {
      console.error('Error generating AI response:', aiError);
      // Continue even if AI response fails
    }

    res.status(201).json(savedComment);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
};


// Update issue status
const updateIssueStatus = async (req, res) => {
  try {
    const { issueId } = req.params;
    const { status } = req.body;

    if (!['open', 'closed', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be open, closed, or resolved' });
    }

    const issue = await ForumIssue.findOneAndUpdate(
      { issueId },
      { status, updatedAt: Date.now() },
      { new: true }
    );

    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    res.json(issue);
  } catch (error) {
    console.error('Error updating issue status:', error);
    res.status(500).json({ error: 'Failed to update issue status' });
  }
};

// Vote on an issue
const voteOnIssue = async (req, res) => {
  try {
    const { issueId } = req.params;
    const { voteType } = req.body; // 'upvote' or 'downvote'

    if (!['upvote', 'downvote'].includes(voteType)) {
      return res.status(400).json({ error: 'Invalid vote type' });
    }

    const updateField = voteType === 'upvote' ? 'upvotes' : 'downvotes';
    
    const issue = await ForumIssue.findOneAndUpdate(
      { issueId },
      { $inc: { [updateField]: 1 } },
      { new: true }
    );

    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    res.json(issue);
  } catch (error) {
    console.error('Error voting on issue:', error);
    res.status(500).json({ error: 'Failed to vote on issue' });
  }
};

// Vote on a comment
const voteOnComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { voteType } = req.body; // 'upvote' or 'downvote'

    if (!['upvote', 'downvote'].includes(voteType)) {
      return res.status(400).json({ error: 'Invalid vote type' });
    }

    const updateField = voteType === 'upvote' ? 'upvotes' : 'downvotes';
    
    const comment = await ForumComment.findByIdAndUpdate(
      commentId,
      { $inc: { [updateField]: 1 } },
      { new: true }
    );

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json(comment);
  } catch (error) {
    console.error('Error voting on comment:', error);
    res.status(500).json({ error: 'Failed to vote on comment' });
  }
};

// Search issues
const searchIssues = async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchRegex = new RegExp(q, 'i');
    
    const issues = await ForumIssue.find({
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { tags: { $in: [searchRegex] } }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

    const total = await ForumIssue.countDocuments({
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { tags: { $in: [searchRegex] } }
      ]
    });

    res.json({
      issues,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error searching issues:', error);
    res.status(500).json({ error: 'Failed to search issues' });
  }
};

// Generate AI response for a specific comment
const generateAIResponseForComment = async (req, res) => {
  try {
    const { commentId } = req.params;

    const comment = await ForumComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const issue = await ForumIssue.findOne({ issueId: comment.issueId });
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    // Generate AI response
    const aiResponse = await generateAIResponseToComment(comment, issue);
    
    // Create and save AI comment
    const aiComment = new ForumComment({
      issueId: issue.issueId,
      content: aiResponse,
      userEmail: 'ai@novard.com',
      userName: 'AI Assistant',
      isAI: true,
      parentCommentId: comment._id.toString()
    });

    const savedAIComment = await aiComment.save();
    res.json(savedAIComment);
  } catch (error) {
    console.error('Error generating AI response for comment:', error);
    res.status(500).json({ error: 'Failed to generate AI response' });
  }
};

module.exports = {
  createIssue,
  getAllIssues,
  getIssueById,
  getIssueComments,
  addComment,
  updateIssueStatus,
  voteOnIssue,
  voteOnComment,
  searchIssues,
  generateAIResponseForComment
};
