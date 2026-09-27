const forum = require('../services/forumService');
const { currentUserId } = require('../middleware/auth');

/**
 * The author of a post or reply is always the signed-in student: the email
 * comes from the session, never from the request body.
 */
const author = (req) => ({
  userEmail: currentUserId(req, req.body?.userEmail),
  userName: req.user.name || String(req.body?.userName || '').trim() || 'Student',
});

exports.createIssue = async (req, res) => {
  const { title, description, tags, category } = req.body;
  const issue = await forum.openIssue({ title, description, tags, category, ...author(req) });
  res.status(201).json({ ...issue.toObject(), commentsCount: 0, netVotes: 0 });
};

exports.getAllIssues = async (req, res) => {
  res.json(await forum.listIssues(req.query));
};

exports.getIssueById = async (req, res) => {
  res.json(await forum.getIssue(req.params.issueId));
};

exports.updateIssueStatus = async (req, res) => {
  res.json(await forum.updateIssueStatus({
    issueId: req.params.issueId,
    status: req.body.status,
    userEmail: currentUserId(req, req.body.userEmail),
  }));
};

exports.deleteIssue = async (req, res) => {
  res.json(await forum.deleteIssue({
    issueId: req.params.issueId,
    userEmail: currentUserId(req, req.body?.userEmail || req.query.userEmail),
  }));
};

exports.getIssueComments = async (req, res) => {
  res.json(await forum.listComments(req.params.issueId, { limit: req.query.limit }));
};

exports.addComment = async (req, res) => {
  const { issueId, content, parentCommentId } = req.body;
  res.status(201).json(await forum.addComment({ issueId, content, parentCommentId, ...author(req) }));
};

exports.generateAIResponseForComment = async (req, res) => {
  res.status(201).json(await forum.aiReplyToComment(req.params.commentId));
};
