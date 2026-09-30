const Report = require('../../models/report');
const forum = require('../forumService');
const audit = require('../auditService');
const { areaLabels } = require('../reportAreas');
const { isObjectId, integer } = require('../../utils/validate');
const { badRequest } = require('../../utils/httpError');

/**
 * Content moderation: the forum (through the forum's own service functions,
 * with the owner check lifted for admins) and AI messages students flagged.
 * Every change is audited.
 */

const objectIdOr400 = (id, label) => {
  if (!isObjectId(String(id))) throw badRequest(`A valid ${label} is required.`);
  return String(id);
};

const listIssues = (query) => forum.listIssues(query);

async function getIssue(issueId) {
  const [issue, { comments }] = await Promise.all([forum.getIssue(issueId), forum.listComments(issueId, { includeHidden: true })]);
  return { issue, comments };
}

async function setIssueStatus(actor, issueId, status, { ip } = {}) {
  const issue = await forum.updateIssueStatus({ issueId, status, asAdmin: true });
  await audit.record({ actor, action: 'forum.issue.status', target: { type: 'forum_issue', id: issueId }, after: { status }, ip });
  return issue;
}

async function deleteIssue(actor, issueId, { ip } = {}) {
  const issue = await forum.getIssue(issueId);
  const result = await forum.deleteIssue({ issueId, asAdmin: true });
  await audit.record({ actor, action: 'forum.issue.delete', target: { type: 'forum_issue', id: issueId }, before: { title: issue.title, author: issue.userName }, after: result, ip });
  return result;
}

async function deleteComment(actor, commentId, { ip } = {}) {
  const result = await forum.deleteComment(objectIdOr400(commentId, 'comment id'));
  await audit.record({ actor, action: 'forum.comment.delete', target: { type: 'forum_comment', id: commentId }, after: result, ip });
  return result;
}

async function setCommentHidden(actor, commentId, hidden, { ip } = {}) {
  if (typeof hidden !== 'boolean') throw badRequest('hidden must be true or false.');
  const comment = await forum.setCommentHidden(objectIdOr400(commentId, 'comment id'), hidden, actor.email);
  await audit.record({ actor, action: hidden ? 'forum.comment.hide' : 'forum.comment.show', target: { type: 'forum_comment', id: commentId }, after: { hidden, isAI: comment.isAI }, ip });
  return comment;
}

/** AI messages students reported (answers, summaries, quiz questions), newest first. */
async function flaggedAiMessages(query = {}) {
  const limit = integer(query.limit, 'Limit', { min: 1, max: 100, required: false, fallback: 30 });
  const [reports, labels] = await Promise.all([
    Report.find({ 'source.excerpt': { $exists: true, $ne: '' } }).sort({ createdAt: -1 }).limit(limit)
      .select('ref area status text source enrichment.intent createdAt').lean(),
    areaLabels(),
  ]);
  return {
    flagged: reports.map((r) => ({
      ref: r.ref, area: r.area, areaLabel: labels[r.area] || r.area, status: r.status, complaint: r.text, intent: r.enrichment?.intent || null,
      itemType: r.source?.itemType || null, itemId: r.source?.itemId || null, excerpt: r.source?.excerpt, verified: Boolean(r.source?.excerptVerified), createdAt: r.createdAt,
    })),
  };
}

module.exports = { listIssues, getIssue, setIssueStatus, deleteIssue, deleteComment, setCommentHidden, flaggedAiMessages };
