import React, { useState, useEffect, useCallback } from 'react';

const IssueDetail = ({ issue, onBack }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const apiUrl = process.env.REACT_APP_API_ENDPOINT || 'http://localhost:5001';

  const fetchComments = useCallback(async (isRefresh = false) => {
    if (!issue) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const response = await fetch(`${apiUrl}/api/forum/issues/${issue.issueId}/comments`);
      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }

      const data = await response.json();
      setComments(data.comments || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching comments:', err);
      setError('Failed to load comments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [issue, apiUrl]);

  useEffect(() => {
    if (issue) {
      fetchComments();

      const interval = setInterval(() => {
        fetchComments();
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [issue, fetchComments]);

  const handleRefresh = () => {
    fetchComments(true);
  };

  const handleGenerateAIResponse = async (commentId) => {
    try {
      setGeneratingAI(commentId);
      const response = await fetch(`${apiUrl}/api/forum/comments/${commentId}/ai-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate AI response');
      }

      const aiComment = await response.json();
      setComments(prev => [...prev, aiComment]);
    } catch (error) {
      console.error('Error generating AI response:', error);
      alert('Failed to generate AI response. Please try again.');
    } finally {
      setGeneratingAI(null);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    try {
      setUpdatingStatus(true);
      const response = await fetch(`${apiUrl}/api/forum/issues/${issue.issueId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update issue status');
      }

      await response.json();
      window.location.reload();
    } catch (error) {
      console.error('Error updating issue status:', error);
      alert('Failed to update issue status. Please try again.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const userEmail = localStorage.getItem('email') || 'anonymous@example.com';
      const userName = localStorage.getItem('name') || 'Anonymous User';

      const response = await fetch(`${apiUrl}/api/forum/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          issueId: issue.issueId,
          content: newComment,
          userEmail,
          userName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit comment');
      }

      const newCommentData = await response.json();
      setComments(prev => [...prev, newCommentData]);
      setNewComment('');

      setTimeout(() => {
        fetchComments();
      }, 2000);
    } catch (err) {
      console.error('Error submitting comment:', err);
      alert('Failed to submit comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'bg-green-500';
      case 'closed': return 'bg-red-500';
      case 'resolved': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  if (!issue) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to AI Forum</h2>
          <p className="text-sm text-gray-600 mb-4">Select an issue from the right panel to view details and comments</p>
          <div className="text-xs text-gray-500">Or create a new issue to get started!</div>
        </div>
      </div>
    );
  }

  const hideScrollbarStyle = {
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    WebkitOverflowScrolling: 'touch',
  };

  return (
    <>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .smooth-scroll {
          scroll-behavior: smooth;
        }
      `}</style>
      <div className="w-full h-full flex flex-col bg-gray-50 hide-scrollbar smooth-scroll" style={hideScrollbarStyle}>
      <div className="p-4 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <button
          onClick={onBack}
          className="text-sm text-blue-600 hover:underline flex items-center gap-2"
        >
          ← Back to Issues
        </button>
      </div>

        {/* Sleeker Header - No Description/Tags */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
          {/* Single-line Header: Badge, Issue #, Metadata, Buttons */}
          <div className="flex justify-between items-center mb-3">
            {/* Left Side: Badge + Issue # + Metadata */}
            <div className="flex items-center gap-3">
              {/* OPEN Badge */}
              <span className={`px-3 py-1 rounded-md text-xs font-bold text-white uppercase ${getStatusColor(issue.status)}`}>
                {issue.status}
              </span>

              {/* Issue Number */}
              <span className="text-sm font-semibold text-gray-600">
                Issue #{issue.issueId || '4002'}
              </span>

              {/* Bullet Separator */}
              <span className="text-gray-400">•</span>

              {/* Opened by metadata */}
              <span className="text-sm text-gray-600">
                Opened by <span className="font-semibold text-gray-900">{issue.userName}</span> • {formatDate(issue.createdAt)}
              </span>
            </div>

            {/* Right Side: Action Buttons */}
            <div className="flex items-center gap-3">
              {issue.status === 'open' && (
                <>
                  <button
                    onClick={() => handleStatusUpdate('resolved')}
                    disabled={updatingStatus}
                    className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-md hover:bg-green-700 disabled:opacity-60 transition-colors"
                  >
                    {updatingStatus ? 'Updating...' : 'Resolve'}
                  </button>
                  <button
                    onClick={() => handleStatusUpdate('closed')}
                    disabled={updatingStatus}
                    className="px-5 py-2 bg-red-600 text-white text-sm font-semibold rounded-md hover:bg-red-700 disabled:opacity-60 transition-colors"
                  >
                    {updatingStatus ? 'Updating...' : 'Close'}
                  </button>
                </>
              )}
              {(issue.status === 'resolved' || issue.status === 'closed') && (
                <button
                  onClick={() => handleStatusUpdate('open')}
                  disabled={updatingStatus}
                  className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {updatingStatus ? 'Updating...' : 'Reopen'}
                </button>
              )}
            </div>
          </div>

          {/* Title - Large and Bold */}
          <h1 className="text-2xl font-bold text-gray-900">{issue.title}</h1>
        </div>

        <div className="flex-1 flex flex-col p-4 overflow-hidden">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-gray-900">Comments ({comments.length})</h3>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300 disabled:opacity-60 flex items-center gap-2"
          >
            {refreshing ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>

          <div className="flex-1 overflow-y-auto mb-4 hide-scrollbar smooth-scroll" style={hideScrollbarStyle}>
          {loading ? (
            <div className="p-8 text-center text-gray-500 text-sm">Loading comments...</div>
          ) : error ? (
              <div className="p-8 text-center text-red-600 text-sm">{error}</div>
              ) : (
                // Always show initial issue as first comment
                [
                  // Initial Issue Comment
                  <div
                    key={`initial-${issue.issueId}`}
                    className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-5 mb-3 border-l-4 border-blue-600"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm font-semibold text-white">
                          {issue.userName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-sm text-gray-900">{issue.userName}</div>
                            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded">ISSUE OPENER</span>
                          </div>
                          <div className="text-xs text-gray-500">{issue.userEmail}</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">{formatDate(issue.createdAt)}</div>
                    </div>
                    <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap mb-3">
                      {issue.description}
                    </div>
                    {/* Tags in initial comment */}
                    {issue.tags && issue.tags.length > 0 && (
                      <div className="flex gap-2 flex-wrap pt-3 border-t border-blue-200">
                        {issue.tags.map((tag, index) => (
                          <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>,
                  // Regular comments
                  ...(comments.length === 0 ? (
                    [<div key="no-replies" className="p-8 text-center text-gray-500 text-sm">No replies yet. Be the first to reply!</div>]
                  ) : (
                    comments.map((comment) => (
              <div
                key={comment._id}
                className={`bg-white rounded-lg p-4 mb-3 shadow-md ${comment.isAI ? 'bg-blue-50 border-l-4 border-blue-600' : ''}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${comment.isAI ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {comment.isAI ? 'AI' : comment.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-gray-900">
                        {comment.isAI ? 'AI Assistant' : comment.userName}
                      </div>
                      <div className="text-xs text-gray-500">{comment.userEmail}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">{formatDate(comment.createdAt)}</div>
                </div>

                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mt-2">{comment.content}</div>

                <div className="flex justify-between items-center mt-3 text-xs">
                  <div>
                    {comment.isAI && (
                      <span className="text-blue-600 font-semibold">AI Response</span>
                    )}
                  </div>
                  {!comment.isAI && (
                    <button
                      onClick={() => handleGenerateAIResponse(comment._id)}
                      disabled={generatingAI === comment._id}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:opacity-60"
                    >
                      {generatingAI === comment._id ? 'Generating...' : 'Get AI Response'}
                    </button>
                  )}
                </div>
              </div>
            ))
                    ))
                  ]
          )}
        </div>

          {/* Minimal Comment Input - Clean & Sleek */}
          <div className="bg-white border-t border-gray-200 px-4 py-4">
            <form onSubmit={handleSubmitComment} className="flex gap-3 items-end">
              {/* Simple Text Area */}
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a response..."
                className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                         min-h-[60px] max-h-[120px] hide-scrollbar smooth-scroll transition-all"
                style={hideScrollbarStyle}
              required
            />

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submittingComment || !newComment.trim()}
                className="px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 h-fit"
              >
                {submittingComment ? 'Posting...' : 'Post Comment'}
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
          </form>
        </div>

      </div>
    </div>
    </>
  );
};

export default IssueDetail;
