const ForumIssue = require('../models/forumIssue');
const ForumComment = require('../models/forumComment');
const {
  generateAICommentForIssue,
  generateAIResponseToComment
} = require('./forumAIController');

const CATEGORIES = ['general', 'tutorial', 'urgent', 'ideation', 'showcase'];
const STATUSES = ['open', 'resolved', 'closed'];

/**
 * Sort options offered by the forum UI. Whitelisted: the old code passed
 * req.query.sortBy straight into Mongo's sort, and "Title" sorted Z to A.
 */
const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  popular: { netVotes: -1, commentsCount: -1, createdAt: -1 },
  discussed: { commentsCount: -1, createdAt: -1 },
  title: { titleLower: 1, createdAt: -1 },
};
// Values the previous client sent, so an old tab keeps working.
const LEGACY_SORTS = { createdAt: 'newest', upvotes: 'popular' };

const AI_AUTHOR = { userEmail: 'ai@novard.com', userName: 'AI Assistant', isAI: true };

const generateIssueId = () => 'ISSUE_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);

/** User input is matched literally. `new RegExp(q)` used to 500 on "C++" or "(". */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normaliseEmail = (e) => String(e || '').trim().toLowerCase();

/**
 * Only the person who opened a discussion may change its status or delete it.
 *
 * The app has no server-side session, so identity is the email the client
 * sends - the same trust model every other feature uses. This stops the
 * ordinary case (anyone clicking Resolve on anyone's post) but is not a
 * defence against a deliberately forged request; that needs real auth.
 */
function assertOwner(issue, requesterEmail, res) {
  if (!requesterEmail) {
    res.status(401).json({ error: 'Sign in to manage this discussion.' });
    return false;
  }
  if (normaliseEmail(issue.userEmail) !== normaliseEmail(requesterEmail)) {
    res.status(403).json({ error: 'Only the person who started this discussion can do that.' });
    return false;
  }
  return true;
}

/** Fire-and-forget AI reply: the request that triggered it has already been answered. */
function replyWithAI(issue, parentComment = null) {
  const generate = parentComment
    ? generateAIResponseToComment(parentComment, issue)
    : generateAICommentForIssue(issue);

  generate
    .then((content) =>
      new ForumComment({
        ...AI_AUTHOR,
        issueId: issue.issueId,
        content,
        parentCommentId: parentComment ? parentComment._id.toString() : null,
      }).save()
    )
    .catch((error) => console.error('Error generating AI reply:', error));
}

// ── issues ────────────────────────────────────────────────────────────────

/** Validate and save a discussion, then let the AI post its first reply. Shared by the forum and the Novard Agent. */
async function openIssue({ title, description, userEmail, userName, tags = [], category = 'general' }) {
  const bad = (message) => Object.assign(new Error(message), { status: 400 });
  if (!title?.trim() || !description?.trim() || !userEmail || !userName) {
    throw bad('Title, description, user email, and user name are required');
  }
  if (!CATEGORIES.includes(category)) throw bad(`Category must be one of: ${CATEGORIES.join(', ')}`);

  const cleanTags = [...new Set((Array.isArray(tags) ? tags : [])
    .map((t) => String(t).trim().toLowerCase())
    .filter(Boolean))].slice(0, 8);

  const savedIssue = await new ForumIssue({
    title: title.trim(),
    description: description.trim(),
    userEmail,
    userName,
    category,
    tags: cleanTags,
    issueId: generateIssueId(),
  }).save();

  // The AI's first reply is posted in the background and arrives via the thread's poll.
  replyWithAI(savedIssue);
  return savedIssue;
}

const createIssue = async (req, res) => {
  try {
    const savedIssue = await openIssue(req.body);
    res.status(201).json({ ...savedIssue.toObject(), commentsCount: 0, netVotes: 0 });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error creating issue:', error);
    res.status(500).json({ error: 'Failed to create issue' });
  }
};

/**
 * List discussions. Category, status, search and sort all apply together -
 * previously "All Categories" silently meant "open only", the category options
 * were sent as a *status* (so Tutorial/Urgent/Ideation/Showcase always came back
 * empty), and searching ignored every other filter.
 *
 * Query: category=all|<category>  status=all|open|resolved|closed
 *        q=<text>  sort=newest|oldest|popular|discussed|title  page  limit
 */
const getAllIssues = async (req, res) => {
  try {
    const category = String(req.query.category || 'all');
    const status = String(req.query.status || 'all');
    const q = String(req.query.q || '').trim();
    const sortKey = SORTS[req.query.sort] ? req.query.sort
      : LEGACY_SORTS[req.query.sortBy] || 'newest';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));

    if (category !== 'all' && !CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Unknown category "${category}"` });
    }
    if (status !== 'all' && !STATUSES.includes(status)) {
      return res.status(400).json({ error: `Unknown status "${status}"` });
    }

    const match = {};
    if (status !== 'all') match.status = status;
    if (category === 'general') {
      // Posts from before categories existed have no field; they are general.
      match.$or = [{ category: 'general' }, { category: { $exists: false } }];
    } else if (category !== 'all') {
      match.category = category;
    }
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      const text = { $or: [{ title: rx }, { description: rx }, { tags: rx }] };
      Object.assign(match, match.$or ? { $and: [{ $or: match.$or }, text] } : text);
      if (match.$and) delete match.$or;
    }

    const [result] = await ForumIssue.aggregate([
      { $match: match },
      {
        $lookup: {
          from: ForumComment.collection.name,
          localField: 'issueId',
          foreignField: 'issueId',
          as: 'replies',
          pipeline: [{ $project: { _id: 1 } }],
        },
      },
      {
        $addFields: {
          category: { $ifNull: ['$category', 'general'] },
          commentsCount: { $size: '$replies' },
          netVotes: { $subtract: [{ $ifNull: ['$upvotes', 0] }, { $ifNull: ['$downvotes', 0] }] },
          titleLower: { $toLower: '$title' },
        },
      },
      { $project: { replies: 0 } },
      {
        $facet: {
          issues: [{ $sort: SORTS[sortKey] }, { $skip: (page - 1) * limit }, { $limit: limit }, { $project: { titleLower: 0 } }],
          total: [{ $count: 'n' }],
        },
      },
    ]);

    const total = result.total[0]?.n || 0;
    res.json({
      issues: result.issues,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
      filters: { category, status, q, sort: sortKey },
    });
  } catch (error) {
    console.error('Error fetching issues:', error);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
};

/** Kept for existing callers; search is now just the list endpoint with q=. */
const searchIssues = (req, res) => getAllIssues(req, res);

const getIssueById = async (req, res) => {
  try {
    const issue = await ForumIssue.findOne({ issueId: req.params.issueId }).lean();
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    res.json({ ...issue, category: issue.category || 'general' });
  } catch (error) {
    console.error('Error fetching issue:', error);
    res.status(500).json({ error: 'Failed to fetch issue' });
  }
};

const updateIssueStatus = async (req, res) => {
  try {
    const { issueId } = req.params;
    const { status, userEmail } = req.body;

    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be open, resolved, or closed' });
    }

    const issue = await ForumIssue.findOne({ issueId });
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    if (!assertOwner(issue, userEmail, res)) return;

    issue.status = status;
    await issue.save();
    res.json(issue);
  } catch (error) {
    console.error('Error updating issue status:', error);
    res.status(500).json({ error: 'Failed to update issue status' });
  }
};

/** Owner-only. Removes the discussion and every reply in it. */
const deleteIssue = async (req, res) => {
  try {
    const { issueId } = req.params;
    const userEmail = req.body?.userEmail || req.query.userEmail;

    const issue = await ForumIssue.findOne({ issueId });
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    if (!assertOwner(issue, userEmail, res)) return;

    const { deletedCount } = await ForumComment.deleteMany({ issueId });
    await issue.deleteOne();
    res.json({ success: true, issueId, deletedComments: deletedCount });
  } catch (error) {
    console.error('Error deleting issue:', error);
    res.status(500).json({ error: 'Failed to delete issue' });
  }
};

const voteOnIssue = async (req, res) => {
  try {
    const { issueId } = req.params;
    const { voteType } = req.body;
    if (!['upvote', 'downvote'].includes(voteType)) {
      return res.status(400).json({ error: 'Invalid vote type' });
    }
    const field = voteType === 'upvote' ? 'upvotes' : 'downvotes';
    const issue = await ForumIssue.findOneAndUpdate({ issueId }, { $inc: { [field]: 1 } }, { new: true });
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    res.json(issue);
  } catch (error) {
    console.error('Error voting on issue:', error);
    res.status(500).json({ error: 'Failed to vote on issue' });
  }
};

// ── comments ──────────────────────────────────────────────────────────────

/**
 * All replies in a thread, oldest first. The old default page size of 20 was
 * never paged by the client, and since every comment also gets an AI reply,
 * threads lost their newest messages after about ten user comments.
 */
const getIssueComments = async (req, res) => {
  try {
    const { issueId } = req.params;
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 1000));
    const comments = await ForumComment.find({ issueId }).sort({ createdAt: 1 }).limit(limit).lean();
    res.json({ comments, total: comments.length });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

const addComment = async (req, res) => {
  try {
    const { issueId, content, userEmail, userName, parentCommentId = null } = req.body;
    if (!issueId || !content?.trim() || !userEmail || !userName) {
      return res.status(400).json({ error: 'Issue ID, content, user email, and user name are required' });
    }

    const issue = await ForumIssue.findOne({ issueId });
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    if (issue.status === 'closed') {
      return res.status(409).json({ error: 'This discussion is closed. The author can reopen it.' });
    }

    const saved = await new ForumComment({
      issueId,
      content: content.trim(),
      userEmail,
      userName,
      parentCommentId,
    }).save();

    // Respond now; the AI reply is threaded under this comment when it lands.
    res.status(201).json(saved);
    replyWithAI(issue, saved);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
};

const voteOnComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { voteType } = req.body;
    if (!['upvote', 'downvote'].includes(voteType)) {
      return res.status(400).json({ error: 'Invalid vote type' });
    }
    const field = voteType === 'upvote' ? 'upvotes' : 'downvotes';
    const comment = await ForumComment.findByIdAndUpdate(commentId, { $inc: { [field]: 1 } }, { new: true });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    res.json(comment);
  } catch (error) {
    console.error('Error voting on comment:', error);
    res.status(500).json({ error: 'Failed to vote on comment' });
  }
};

/** On-demand AI reply to a specific comment (the "Get AI response" button). */
const generateAIResponseForComment = async (req, res) => {
  try {
    const comment = await ForumComment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const issue = await ForumIssue.findOne({ issueId: comment.issueId });
    if (!issue) return res.status(404).json({ error: 'Issue not found' });

    const content = await generateAIResponseToComment(comment, issue);
    const saved = await new ForumComment({
      ...AI_AUTHOR,
      issueId: issue.issueId,
      content,
      parentCommentId: comment._id.toString(),
    }).save();
    res.json(saved);
  } catch (error) {
    console.error('Error generating AI response for comment:', error);
    res.status(500).json({ error: 'Failed to generate AI response' });
  }
};

module.exports = {
  CATEGORIES,
  openIssue,
  createIssue,
  getAllIssues,
  getIssueById,
  getIssueComments,
  addComment,
  updateIssueStatus,
  deleteIssue,
  voteOnIssue,
  voteOnComment,
  searchIssues,
  generateAIResponseForComment
};
