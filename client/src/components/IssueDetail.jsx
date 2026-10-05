import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MarkdownView from './MarkdownView';
import { categoryMeta, statusMeta, isOwner, currentUserEmail } from '../lib/forum';
import { apiJson } from '../lib/api';
import logger from '../lib/logger';
import { ReportAction } from './learning/LearningUI';
import { useReportProblem } from '../context/ReportContext';
import Icon from './ui/Icon';
import Button from './ui/Button';
import Badge, { Status } from './ui/Badge';
import UIAvatar from './ui/Avatar';
import Spinner from './ui/Spinner';
import { inputClass } from './ui/Field';
import { ErrorState, Skeleton } from './ui/States';
import AgentAvatar from './agent/AgentAvatar';

const POLL_MS = 10000;
const POLL_WHILE_AI_PENDING_MS = 4000;
const AI_PENDING_WINDOW_MS = 2 * 60 * 1000;

const formatDate = (value) =>
  new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const sameEmail = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

/**
 * Group replies into threads: each top-level comment followed by the replies
 * that answer it. AI replies are generated in the background, so in plain time
 * order an answer to one comment could land under someone else's comment.
 */
function buildThreads(comments) {
  const byId = new Map(comments.map((c) => [String(c._id), c]));
  const children = new Map();
  const roots = [];
  comments.forEach((c) => {
    const parent = c.parentCommentId && byId.get(String(c.parentCommentId));
    if (parent) {
      const key = String(parent._id);
      if (!children.has(key)) children.set(key, []);
      children.get(key).push(c);
    } else {
      roots.push(c);
    }
  });
  return roots.map((root) => ({ root, replies: children.get(String(root._id)) || [] }));
}

const Person = ({ comment }) => (comment.isAI
  ? <AgentAvatar size="h-8 w-8" />
  : <UIAvatar name={comment.userName || '?'} size="md" />);

const CommentBody = ({ comment }) =>
  comment.isAI ? (
    // AI replies are Markdown (headings, lists, code); render them as such.
    <MarkdownView content={comment.content} className="mt-1.5" />
  ) : (
    <p className="mt-1.5 whitespace-pre-wrap break-words text-body leading-relaxed text-fg">{comment.content}</p>
  );

const Comment = ({ comment, issueOwnerEmail, footer = null }) => {
  const openReport = useReportProblem();
  const byAuthor = !comment.isAI && sameEmail(comment.userEmail, issueOwnerEmail);
  const byMe = !comment.isAI && sameEmail(comment.userEmail, currentUserEmail());
  return (
    <article className="flex min-w-0 gap-3">
      <Person comment={comment} />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-body font-medium text-fg">{comment.isAI ? 'AI assistant' : comment.userName}</span>
          {comment.isAI && <Badge tone="accent">AI</Badge>}
          {byAuthor && <Badge>Author</Badge>}
          {byMe && !byAuthor && <span className="text-caption text-fg-subtle">(you)</span>}
          <time className="text-caption text-fg-subtle" dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
        </header>
        {!comment.isAI && comment.userEmail && <div className="truncate text-caption text-fg-subtle">{comment.userEmail}</div>}
        <CommentBody comment={comment} />
        {comment.isAI && (
          <div className="mt-1 -ml-1.5">
            <ReportAction onClick={() => openReport({ area: 'forum', source: { tool: 'forumAi', itemType: 'forum_comment', itemId: comment._id, excerpt: comment.content } })} />
          </div>
        )}
        {footer}
      </div>
    </article>
  );
};

const IssueDetail = ({ issue, onBack, onDeleted }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [issueStatus, setIssueStatus] = useState(issue?.status || 'open');

  const owner = isOwner(issue);
  const category = categoryMeta(issue?.category);
  const status = statusMeta(issueStatus);
  const isClosed = issueStatus === 'closed';

  useEffect(() => {
    setIssueStatus(issue?.status || 'open');
    setConfirmingDelete(false);
    setActionError(null);
  }, [issue]);

  const fetchComments = useCallback(async (isRefresh = false) => {
    if (!issue) return;
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const data = await apiJson(`/api/forum/issues/${encodeURIComponent(issue.issueId)}/comments`);
      setComments(data.comments || []);
      setError(null);
    } catch (err) {
      logger.error('Error fetching comments', err);
      setError('Failed to load replies');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [issue]);

  const threads = useMemo(() => buildThreads(comments), [comments]);

  // A human comment still waiting for its automatic AI reply.
  const aiPendingFor = useMemo(() => {
    const now = Date.now();
    const pending = new Set();
    threads.forEach(({ root, replies }) => {
      const fresh = now - new Date(root.createdAt).getTime() < AI_PENDING_WINDOW_MS;
      if (!root.isAI && fresh && !replies.some((r) => r.isAI)) pending.add(String(root._id));
    });
    return pending;
  }, [threads]);

  // The discussion's own first AI answer is also generated in the background.
  const issueAnswerPending =
    Date.now() - new Date(issue?.createdAt).getTime() < AI_PENDING_WINDOW_MS &&
    !threads.some(({ root }) => root.isAI);

  useEffect(() => {
    if (!issue) return undefined;
    fetchComments();
    return undefined;
  }, [issue, fetchComments]);

  // Poll silently; faster while an AI reply is on its way so it shows up promptly.
  useEffect(() => {
    if (!issue) return undefined;
    const waiting = aiPendingFor.size > 0 || issueAnswerPending;
    const t = setInterval(() => fetchComments(true), waiting ? POLL_WHILE_AI_PENDING_MS : POLL_MS);
    return () => clearInterval(t);
  }, [issue, fetchComments, aiPendingFor, issueAnswerPending]);

  const handleGenerateAIResponse = async (commentId) => {
    setGeneratingAI(commentId);
    setActionError(null);
    try {
      const aiComment = await apiJson(`/api/forum/comments/${commentId}/ai-response`, { method: 'POST' });
      setComments((prev) => [...prev, aiComment]);
    } catch (err) {
      logger.error('Error generating AI response', err);
      setActionError(err.message || 'Failed to generate an AI response.');
    } finally {
      setGeneratingAI(null);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    setUpdatingStatus(true);
    setActionError(null);
    try {
      await apiJson(`/api/forum/issues/${encodeURIComponent(issue.issueId)}/status`, { method: 'PUT', body: { status: newStatus } });
      setIssueStatus(newStatus);
    } catch (err) {
      logger.error('Error updating issue status', err);
      setActionError(err.message || 'Failed to update the status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setActionError(null);
    try {
      await apiJson(`/api/forum/issues/${encodeURIComponent(issue.issueId)}`, { method: 'DELETE' });
      onDeleted?.(issue);
    } catch (err) {
      logger.error('Error deleting issue', err);
      setActionError(err.message || 'Failed to delete the discussion.');
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || isClosed) return;
    setSubmittingComment(true);
    setActionError(null);
    try {
      // The author is the signed-in student; the server takes that from the session.
      const saved = await apiJson('/api/forum/comments', { method: 'POST', body: { issueId: issue.issueId, content: newComment } });
      setComments((prev) => [...prev, saved]);
      setNewComment('');
    } catch (err) {
      logger.error('Error submitting comment', err);
      setActionError(err.message || 'Failed to post your reply.');
    } finally {
      setSubmittingComment(false);
    }
  };

  if (!issue) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <h2 className="mb-1 text-title font-semibold text-fg">Forum</h2>
          <p className="text-sm text-fg-muted">Select a discussion to view it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-raised ring-1 ring-line-subtle">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8 sm:py-8">
          <button type="button" onClick={onBack} className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-small text-fg-subtle hover:bg-sunken hover:text-fg">
            <Icon name="arrowLeft" className="h-3.5 w-3.5" /> All discussions
          </button>

          {/* Title and state */}
          <header className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Status tone={status.tone}>{status.label}</Status>
              <Badge tone={category.tone}><Icon name={category.icon} className="h-3 w-3" />{category.label}</Badge>
            </div>
            <h1 className="mt-2 break-words text-display font-semibold text-fg">{issue.title}</h1>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-small text-fg-subtle">
                Opened by <span className="font-medium text-fg-muted">{owner ? 'you' : issue.userName}</span> · {formatDate(issue.createdAt)}
              </p>
              {/* Only the person who started the discussion can change its state or delete it. */}
              {owner ? (
                confirmingDelete ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-danger-soft px-3 py-1.5">
                    <span className="text-small text-danger-fg">
                      Delete this discussion and its {comments.length} {comments.length === 1 ? 'reply' : 'replies'}?
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={deleting}>Cancel</Button>
                    <Button size="sm" variant="danger-solid" onClick={handleDelete} loading={deleting} loadingLabel="Deleting…">Delete</Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {issueStatus === 'open' ? (
                      <>
                        <Button size="sm" variant="secondary" icon="check" onClick={() => handleStatusUpdate('resolved')} loading={updatingStatus} loadingLabel="Updating…">Mark solved</Button>
                        <Button size="sm" variant="ghost" onClick={() => handleStatusUpdate('closed')} disabled={updatingStatus}>Close</Button>
                      </>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => handleStatusUpdate('open')} loading={updatingStatus} loadingLabel="Updating…">Reopen</Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-danger-fg hover:bg-danger-soft hover:text-danger-fg" onClick={() => setConfirmingDelete(true)}>Delete</Button>
                  </div>
                )
              ) : (
                <span className="text-caption text-fg-subtle">Only {issue.userName} can mark this solved or close it</span>
              )}
            </div>
          </header>

          {actionError && (
            <div role="alert" className="mt-4 flex items-start gap-3 rounded-lg bg-danger-soft px-4 py-2.5 text-body text-danger-fg">
              <span className="flex-1">{actionError}</span>
              <button type="button" onClick={() => setActionError(null)} aria-label="Dismiss" className="rounded p-0.5 hover:bg-danger/10"><Icon name="x" className="h-4 w-4" /></button>
            </div>
          )}

          {/* The opening post */}
          <article className="mt-6 border-t border-line-subtle pt-6">
            <div className="flex items-center gap-3">
              <UIAvatar name={issue.userName || '?'} size="md" />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-body font-medium text-fg">{issue.userName}</span>
                  <Badge>Author</Badge>
                </div>
                {issue.userEmail && <div className="truncate text-caption text-fg-subtle">{issue.userEmail}</div>}
              </div>
            </div>
            <p className="mt-4 whitespace-pre-wrap break-words text-lead leading-relaxed text-fg">{issue.description}</p>
            {issue.tags?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {issue.tags.map((tag) => <Badge key={tag}>#{tag}</Badge>)}
              </div>
            )}
          </article>

          {/* Replies */}
          <div className="mt-8 flex items-center justify-between border-t border-line-subtle pt-5">
            <h2 className="text-body font-semibold text-fg"><span className="tabular">{comments.length}</span> {comments.length === 1 ? 'reply' : 'replies'}</h2>
            <Button size="sm" variant="ghost" icon="refresh" onClick={() => fetchComments(true)} loading={refreshing} loadingLabel="Refreshing…">Refresh</Button>
          </div>

          {loading ? (
            <div className="mt-5 space-y-6" role="status" aria-label="Loading replies">
              {[0, 1].map((i) => (
                <div key={i} className="flex gap-3"><Skeleton className="h-8 w-8" rounded="rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-4/5" /></div></div>
              ))}
            </div>
          ) : error ? (
            <ErrorState title="Replies didn’t load" text={error} onRetry={() => fetchComments(true)} />
          ) : (
            <div className="mt-2">
              {issueAnswerPending && (
                <p className="mt-3 flex items-center gap-2 rounded-lg bg-accent-soft px-4 py-3 text-body text-accent-fg">
                  <Spinner className="h-3.5 w-3.5" />
                  The AI assistant is writing a first answer…
                </p>
              )}

              {threads.length === 0 && !issueAnswerPending && (
                <p className="py-8 text-center text-body text-fg-subtle">No replies yet. Be the first to answer.</p>
              )}

              <ol className="divide-y divide-line-subtle">
                {threads.map(({ root, replies }) => {
                  const hasAIReply = replies.some((r) => r.isAI);
                  const pending = aiPendingFor.has(String(root._id));
                  // Only render a footer row when it has something in it.
                  const showFooter = !root.isAI && !isClosed && (pending || !hasAIReply);
                  const footer = showFooter && (
                    <div className="mt-2">
                      {pending ? (
                        <span className="flex items-center gap-2 text-small text-accent-fg">
                          <Spinner className="h-3 w-3" />
                          AI is writing a reply…
                        </span>
                      ) : !hasAIReply && (
                        <Button size="xs" variant="ghost" icon="sparkles" className="-ml-2 text-accent-fg" onClick={() => handleGenerateAIResponse(root._id)} loading={generatingAI === root._id} loadingLabel="Generating…">
                          Get an AI answer
                        </Button>
                      )}
                    </div>
                  );

                  return (
                    <li key={root._id} className="py-5">
                      <Comment comment={root} issueOwnerEmail={issue.userEmail} footer={footer} />
                      {replies.length > 0 && (
                        <div className="ml-4 mt-4 space-y-5 border-l border-line pl-6">
                          {replies.map((reply) => (
                            <Comment key={reply._id} comment={reply} issueOwnerEmail={issue.userEmail} />
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Reply box */}
      <div className="shrink-0 border-t border-line-subtle bg-raised px-5 py-3 sm:px-8">
        <div className="mx-auto max-w-3xl">
          {isClosed ? (
            <p className="py-1 text-center text-body text-fg-subtle">
              This discussion is closed{owner ? '. Reopen it to accept replies.' : ' to new replies.'}
            </p>
          ) : (
            <form onSubmit={handleSubmitComment} className="flex items-end gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmitComment(e);
                }}
                placeholder="Write a reply… (Ctrl+Enter to post)"
                aria-label="Write a reply"
                rows={2}
                className={`${inputClass} max-h-40 min-h-[2.75rem] flex-1 resize-none`}
                required
              />
              <Button type="submit" size="lg" disabled={!newComment.trim()} loading={submittingComment} loadingLabel="Posting…">
                Post reply
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default IssueDetail;
