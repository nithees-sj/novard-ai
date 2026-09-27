const ForumIssue = require('../models/forumIssue');
const ForumComment = require('../models/forumComment');
const { generateAICommentForIssue, generateAIResponseToComment } = require('./forumAIService');
const { badRequest, forbidden, notFound, conflict } = require('../utils/httpError');
const { isObjectId, objectId, text } = require('../utils/validate');
const logger = require('../utils/logger');

/** AI Forum: discussions, threaded replies, and the AI participant's answers. */

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
const LIMITS = { title: 200, description: 10000, comment: 5000, tags: 8, tag: 30 };

const generateIssueId = () => `ISSUE_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

/** User input is matched literally. `new RegExp(q)` used to 500 on "C++" or "(". */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normaliseEmail = (e) => String(e || '').trim().toLowerCase();

/** Only the person who opened a discussion may change its status or delete it. */
function assertOwner(issue, requesterEmail) {
  if (normaliseEmail(issue.userEmail) !== normaliseEmail(requesterEmail)) {
    throw forbidden('Only the person who started this discussion can do that.');
  }
}

async function findIssue(issueId) {
  if (typeof issueId !== 'string' || !issueId) throw badRequest('A valid issue id is required.');
  const issue = await ForumIssue.findOne({ issueId });
  if (!issue) throw notFound('Issue not found');
  return issue;
}

/** Fire-and-forget AI reply: the request that triggered it has already been answered. */
function replyWithAI(issue, parentComment = null) {
  const generate = parentComment
    ? generateAIResponseToComment(parentComment, issue)
    : generateAICommentForIssue(issue);

  return generate
    .then((content) => ForumComment.create({
      ...AI_AUTHOR,
      issueId: issue.issueId,
      content,
      parentCommentId: parentComment ? parentComment._id.toString() : null,
    }))
    .catch((error) => logger.error('Could not post the AI forum reply', error));
}

// ── issues ────────────────────────────────────────────────────────────────

/** Validate and save a discussion, then let the AI post its first reply. Shared by the forum and the Novard Agent. */
async function openIssue({ title, description, userEmail, userName, tags = [], category = 'general' }) {
  if (!title?.trim?.() || !description?.trim?.() || !userEmail || !userName) {
    throw badRequest('Title, description, user email, and user name are required');
  }
  if (!CATEGORIES.includes(category)) throw badRequest(`Category must be one of: ${CATEGORIES.join(', ')}`);

  const cleanTags = [...new Set((Array.isArray(tags) ? tags : [])
    .map((t) => String(t).trim().toLowerCase().slice(0, LIMITS.tag))
    .filter(Boolean))].slice(0, LIMITS.tags);

  const issue = await ForumIssue.create({
    title: text(title, 'Title', { max: LIMITS.title }),
    description: text(description, 'Description', { max: LIMITS.description, collapse: false }),
    userEmail,
    userName: String(userName).slice(0, 100),
    category,
    tags: cleanTags,
    issueId: generateIssueId(),
  });

  // The AI's first reply is posted in the background and arrives via the thread's poll.
  replyWithAI(issue);
  return issue;
}

/**
 * List discussions. Category, status, search and sort all apply together.
 * Query: category=all|<category>  status=all|open|resolved|closed
 *        q=<text>  sort=newest|oldest|popular|discussed|title  page  limit
 */
async function listIssues(query = {}) {
  const category = String(query.category || 'all');
  const status = String(query.status || 'all');
  const q = String(query.q || '').trim().slice(0, 200);
  const sortKey = SORTS[query.sort] ? query.sort : LEGACY_SORTS[query.sortBy] || 'newest';
  const page = Math.min(10000, Math.max(1, parseInt(query.page, 10) || 1));
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 12));

  if (category !== 'all' && !CATEGORIES.includes(category)) throw badRequest(`Unknown category "${category}"`);
  if (status !== 'all' && !STATUSES.includes(status)) throw badRequest(`Unknown status "${status}"`);

  const conditions = [];
  if (status !== 'all') conditions.push({ status });
  if (category === 'general') {
    // Posts from before categories existed have no field; they are general.
    conditions.push({ $or: [{ category: 'general' }, { category: { $exists: false } }] });
  } else if (category !== 'all') {
    conditions.push({ category });
  }
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    conditions.push({ $or: [{ title: rx }, { description: rx }, { tags: rx }] });
  }
  const match = conditions.length ? { $and: conditions } : {};

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
  return {
    issues: result.issues,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasMore: page * limit < total,
    filters: { category, status, q, sort: sortKey },
  };
}

async function getIssue(issueId) {
  const issue = (await findIssue(issueId)).toObject();
  return { ...issue, category: issue.category || 'general' };
}

async function updateIssueStatus({ issueId, status, userEmail }) {
  if (!STATUSES.includes(status)) throw badRequest('Invalid status. Must be open, resolved, or closed');
  const issue = await findIssue(issueId);
  assertOwner(issue, userEmail);
  issue.status = status;
  await issue.save();
  return issue;
}

/** Owner-only. Removes the discussion and every reply in it. */
async function deleteIssue({ issueId, userEmail }) {
  const issue = await findIssue(issueId);
  assertOwner(issue, userEmail);
  // The issue goes first: if removing the replies then fails, they are orphans nobody can see,
  // rather than a discussion that lost its replies.
  await issue.deleteOne();
  const { deletedCount } = await ForumComment.deleteMany({ issueId });
  return { success: true, issueId, deletedComments: deletedCount };
}

// ── comments ──────────────────────────────────────────────────────────────

/** All replies in a thread, oldest first. */
async function listComments(issueId, { limit } = {}) {
  if (typeof issueId !== 'string' || !issueId) throw badRequest('A valid issue id is required.');
  const max = Math.min(1000, Math.max(1, parseInt(limit, 10) || 1000));
  const comments = await ForumComment.find({ issueId }).sort({ createdAt: 1 }).limit(max).lean();
  return { comments, total: comments.length };
}

async function addComment({ issueId, content, userEmail, userName, parentCommentId = null }) {
  if (!issueId || typeof content !== 'string' || !content.trim() || !userEmail || !userName) {
    throw badRequest('Issue ID, content, user email, and user name are required');
  }
  const issue = await findIssue(issueId);
  if (issue.status === 'closed') throw conflict('This discussion is closed. The author can reopen it.');

  let parent = null;
  if (parentCommentId) {
    if (!isObjectId(parentCommentId) || !(await ForumComment.exists({ _id: parentCommentId, issueId }))) {
      throw badRequest('The comment you are replying to does not exist in this discussion.');
    }
    parent = parentCommentId;
  }

  const saved = await ForumComment.create({
    issueId,
    content: text(content, 'Your reply', { max: LIMITS.comment, collapse: false }),
    userEmail,
    userName: String(userName).slice(0, 100),
    parentCommentId: parent,
  });

  // Answered now; the AI reply is threaded under this comment when it lands.
  replyWithAI(issue, saved);
  return saved;
}

/** On-demand AI reply to a specific comment (the "Get AI response" button). */
async function aiReplyToComment(commentId) {
  const comment = await ForumComment.findById(objectId(commentId, 'comment id'));
  if (!comment) throw notFound('Comment not found');
  const issue = await ForumIssue.findOne({ issueId: comment.issueId });
  if (!issue) throw notFound('Issue not found');

  const content = await generateAIResponseToComment(comment, issue);
  return ForumComment.create({
    ...AI_AUTHOR,
    issueId: issue.issueId,
    content,
    parentCommentId: comment._id.toString(),
  });
}

module.exports = {
  CATEGORIES,
  STATUSES,
  openIssue,
  listIssues,
  getIssue,
  updateIssueStatus,
  deleteIssue,
  listComments,
  addComment,
  aiReplyToComment,
  _internal: { replyWithAI, escapeRegex },
};
