import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MarkdownView from './MarkdownView';
import { categoryMeta, statusMeta, isOwner, currentUserEmail } from '../lib/forum';

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

const Avatar = ({ comment }) => (
  <div
    className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold ${
      comment.isAI ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
    }`}
    aria-hidden="true"
  >
    {comment.isAI ? 'AI' : (comment.userName || '?').charAt(0).toUpperCase()}
  </div>
);

const CommentBody = ({ comment }) =>
  comment.isAI ? (
    // AI replies are Markdown (headings, lists, code); render them as such.
    <MarkdownView content={comment.content} className="mt-2" />
  ) : (
    <p className="mt-2 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">{comment.content}</p>
  );

const Comment = ({ comment, issueOwnerEmail, nested = false, footer = null }) => {
  const byAuthor = !comment.isAI && sameEmail(comment.userEmail, issueOwnerEmail);
  const byMe = !comment.isAI && sameEmail(comment.userEmail, currentUserEmail());
  return (
    <article
      className={`rounded-lg p-4 min-w-0 ${
        comment.isAI ? 'bg-blue-50 border border-blue-100' : 'bg-white border border-gray-200 shadow-sm'
      } ${nested ? '' : 'mb-3'}`}
    >
      <header className="flex justify-between items-start gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar comment={comment} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-gray-900">{comment.isAI ? 'AI Assistant' : comment.userName}</span>
              {comment.isAI && <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded">AI</span>}
              {byAuthor && <span className="px-1.5 py-0.5 bg-gray-900 text-white text-[10px] font-bold rounded">AUTHOR</span>}
              {byMe && !byAuthor && <span className="text-[11px] text-gray-400">(you)</span>}
            </div>
            {!comment.isAI && <div className="text-xs text-gray-500 truncate">{comment.userEmail}</div>}
          </div>
        </div>
        <time className="text-xs text-gray-500 whitespace-nowrap" dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
      </header>
      <CommentBody comment={comment} />
      {footer}
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

  const apiUrl = process.env.REACT_APP_API_ENDPOINT;
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
      const response = await fetch(`${apiUrl}/api/forum/issues/${issue.issueId}/comments`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      const data = await response.json();
      setComments(data.comments || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching comments:', err);
      setError('Failed to load replies');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [issue, apiUrl]);

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

  const readError = async (response, fallback) => {
    const data = await response.json().catch(() => ({}));
    return data.error || fallback;
  };

  const handleGenerateAIResponse = async (commentId) => {
    setGeneratingAI(commentId);
    setActionError(null);
    try {
      const response = await fetch(`${apiUrl}/api/forum/comments/${commentId}/ai-response`, { method: 'POST' });
      if (!response.ok) throw new Error(await readError(response, 'Failed to generate an AI response.'));
      const aiComment = await response.json();
      setComments((prev) => [...prev, aiComment]);
    } catch (err) {
      console.error('Error generating AI response:', err);
      setActionError(err.message);
    } finally {
      setGeneratingAI(null);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    setUpdatingStatus(true);
    setActionError(null);
    try {
      const response = await fetch(`${apiUrl}/api/forum/issues/${issue.issueId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, userEmail: localStorage.getItem('email') }),
      });
      if (!response.ok) throw new Error(await readError(response, 'Failed to update the status.'));
      setIssueStatus(newStatus);
      issue.status = newStatus;
    } catch (err) {
      console.error('Error updating issue status:', err);
      setActionError(err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setActionError(null);
    try {
      const response = await fetch(`${apiUrl}/api/forum/issues/${issue.issueId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: localStorage.getItem('email') }),
      });
      if (!response.ok) throw new Error(await readError(response, 'Failed to delete the discussion.'));
      onDeleted?.(issue);
    } catch (err) {
      console.error('Error deleting issue:', err);
      setActionError(err.message);
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
      const response = await fetch(`${apiUrl}/api/forum/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId: issue.issueId,
          content: newComment,
          userEmail: localStorage.getItem('email') || 'anonymous@example.com',
          userName: localStorage.getItem('name') || 'Anonymous User',
        }),
      });
      if (!response.ok) throw new Error(await readError(response, 'Failed to post your reply.'));
      const saved = await response.json();
      setComments((prev) => [...prev, saved]);
      setNewComment('');
    } catch (err) {
      console.error('Error submitting comment:', err);
      setActionError(err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  if (!issue) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to AI Forum</h2>
          <p className="text-sm text-gray-600">Select a discussion to view it.</p>
        </div>
      </div>
    );
  }

  const button = 'px-4 py-2 text-sm font-semibold rounded-md disabled:opacity-60 transition-colors';

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      <div className="px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <button onClick={onBack} className="text-sm text-blue-600 hover:underline flex items-center gap-2">
          ← Back to discussions
        </button>
      </div>

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 min-w-0">
            <span className={`px-3 py-1 rounded-md text-xs font-bold text-white uppercase ${status.pill}`}>{status.label}</span>
            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${category.badge}`}>{category.label}</span>
            <span className="text-gray-400" aria-hidden="true">•</span>
            <span>
              Opened by <span className="font-semibold text-gray-900">{owner ? 'you' : issue.userName}</span> · {formatDate(issue.createdAt)}
            </span>
          </div>

          {/* Only the person who started the discussion can change its state or delete it. */}
          {owner ? (
            confirmingDelete ? (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                <span className="text-sm text-red-800">
                  Delete this discussion and its {comments.length} {comments.length === 1 ? 'reply' : 'replies'}?
                </span>
                <button onClick={() => setConfirmingDelete(false)} disabled={deleting} className={`${button} bg-white text-gray-700 border border-gray-300 hover:bg-gray-50`}>
                  Cancel
                </button>
                <button onClick={handleDelete} disabled={deleting} className={`${button} bg-red-600 text-white hover:bg-red-700`}>
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {issueStatus === 'open' ? (
                  <>
                    <button onClick={() => handleStatusUpdate('resolved')} disabled={updatingStatus} className={`${button} bg-green-600 text-white hover:bg-green-700`}>
                      {updatingStatus ? 'Updating…' : 'Mark solved'}
                    </button>
                    <button onClick={() => handleStatusUpdate('closed')} disabled={updatingStatus} className={`${button} bg-white text-gray-700 border border-gray-300 hover:bg-gray-50`}>
                      Close
                    </button>
                  </>
                ) : (
                  <button onClick={() => handleStatusUpdate('open')} disabled={updatingStatus} className={`${button} bg-blue-600 text-white hover:bg-blue-700`}>
                    {updatingStatus ? 'Updating…' : 'Reopen'}
                  </button>
                )}
                <button onClick={() => setConfirmingDelete(true)} className={`${button} bg-white text-red-600 border border-red-200 hover:bg-red-50`}>
                  Delete
                </button>
              </div>
            )
          ) : (
            <span className="text-xs text-gray-500">Only {issue.userName} can mark this solved or close it</span>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 break-words">{issue.title}</h1>
      </div>

      {actionError && (
        <div role="alert" className="mx-6 mt-3 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-3 flex-shrink-0">
          <span className="flex-1">{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} aria-label="Dismiss" className="text-red-500 hover:text-red-700 leading-none text-lg">&times;</button>
        </div>
      )}

      <div className="flex-1 flex flex-col p-4 min-h-0">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-gray-900">Replies ({comments.length})</h3>
          <button onClick={() => fetchComments(true)} disabled={refreshing} className="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300 disabled:opacity-60">
            {refreshing ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto mb-4 min-h-0 pr-1">
          {/* The opening post */}
          <article className="bg-gradient-to-r from-blue-50 to-blue-50 rounded-lg p-5 mb-3 border-l-4 border-blue-600">
            <header className="flex justify-between items-start gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 shrink-0 rounded-full bg-blue-600 flex items-center justify-center text-sm font-semibold text-white" aria-hidden="true">
                  {(issue.userName || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900">{issue.userName}</span>
                    <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded">AUTHOR</span>
                  </div>
                  <div className="text-xs text-gray-500 truncate">{issue.userEmail}</div>
                </div>
              </div>
              <time className="text-xs text-gray-500 whitespace-nowrap" dateTime={issue.createdAt}>{formatDate(issue.createdAt)}</time>
            </header>
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">{issue.description}</p>
            {issue.tags?.length > 0 && (
              <div className="flex gap-2 flex-wrap pt-3 mt-3 border-t border-blue-200">
                {issue.tags.map((tag) => (
                  <span key={tag} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">#{tag}</span>
                ))}
              </div>
            )}
          </article>

          {loading ? (
            <div className="p-8 text-center text-gray-500 text-sm">Loading replies…</div>
          ) : error ? (
            <div className="p-8 text-center text-red-600 text-sm">{error}</div>
          ) : (
            <>
              {issueAnswerPending && (
                <p className="mb-3 px-4 py-3 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-800 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin" aria-hidden="true" />
                  The AI assistant is writing a first answer…
                </p>
              )}

              {threads.length === 0 && !issueAnswerPending && (
                <div className="p-8 text-center text-gray-500 text-sm">No replies yet. Be the first to reply!</div>
              )}

              {threads.map(({ root, replies }) => {
                const hasAIReply = replies.some((r) => r.isAI);
                const pending = aiPendingFor.has(String(root._id));
                // Only render a footer row when it has something in it; an empty
                // row left a blank strip under comments that already had an AI reply.
                const showFooter = !root.isAI && !isClosed && (pending || !hasAIReply);
                const footer = showFooter && (
                  <div className="flex justify-end items-center mt-3">
                    {pending ? (
                      <span className="text-xs text-blue-700 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin" aria-hidden="true" />
                        AI is writing a reply…
                      </span>
                    ) : !hasAIReply && (
                      <button
                        onClick={() => handleGenerateAIResponse(root._id)}
                        disabled={generatingAI === root._id}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 disabled:opacity-60"
                      >
                        {generatingAI === root._id ? 'Generating…' : 'Get AI response'}
                      </button>
                    )}
                  </div>
                );

                return (
                  <div key={root._id} className="mb-3">
                    <Comment comment={root} issueOwnerEmail={issue.userEmail} nested footer={footer} />
                    {replies.length > 0 && (
                      <div className="mt-2 ml-6 pl-4 border-l-2 border-blue-100 space-y-2">
                        {replies.map((reply) => (
                          <Comment key={reply._id} comment={reply} issueOwnerEmail={issue.userEmail} nested />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Reply box */}
        <div className="bg-white border-t border-gray-200 pl-4 pr-24 py-4">
          {isClosed ? (
            <p className="text-sm text-gray-500 text-center">
              This discussion is closed{owner ? ' - reopen it to accept replies.' : ' to new replies.'}
            </p>
          ) : (
            <form onSubmit={handleSubmitComment} className="flex gap-3 items-end">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmitComment(e);
                }}
                placeholder="Write a reply… (Ctrl+Enter to post)"
                aria-label="Write a reply"
                className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none
                           focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[60px] max-h-[160px]"
                required
              />
              <button
                type="submit"
                disabled={submittingComment || !newComment.trim()}
                className="px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700
                           disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-fit whitespace-nowrap"
              >
                {submittingComment ? 'Posting…' : 'Post reply'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default IssueDetail;
