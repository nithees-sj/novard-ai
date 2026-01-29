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

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 overflow-auto">
      <div className="p-4 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <button
          onClick={onBack}
          className="text-sm text-blue-600 hover:underline flex items-center gap-2"
        >
          ← Back to Issues
        </button>
      </div>

      <div className="bg-white rounded-lg p-6 m-4 shadow-md flex-shrink-0">
        <div className="flex justify-between items-start mb-3">
          <h1 className="text-2xl font-bold text-gray-900 flex-1 mr-4">{issue.title}</h1>
          <span className={`px-6 py-2 rounded-full text-sm font-semibold text-white uppercase ${getStatusColor(issue.status)}`}>
            {issue.status}
          </span>
        </div>

        <p className="text-sm text-gray-700 leading-relaxed mb-4 whitespace-pre-wrap">{issue.description}</p>

        {issue.tags && issue.tags.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-4">
            {issue.tags.map((tag, index) => (
              <span key={index} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-2xl text-xs">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
              {issue.userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-sm text-gray-900">{issue.userName}</div>
              <div className="text-xs text-gray-500">{issue.userEmail}</div>
            </div>
          </div>
          <div className="text-xs text-gray-500">{formatDate(issue.createdAt)}</div>
        </div>

        <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
          {issue.status === 'open' && (
            <>
              <button
                onClick={() => handleStatusUpdate('resolved')}
                disabled={updatingStatus}
                className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-md hover:bg-green-700 disabled:opacity-60"
              >
                {updatingStatus ? 'Updating...' : '✓ Mark as Resolved'}
              </button>
              <button
                onClick={() => handleStatusUpdate('closed')}
                disabled={updatingStatus}
                className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-md hover:bg-red-700 disabled:opacity-60"
              >
                {updatingStatus ? 'Updating...' : '✕ Close Issue'}
              </button>
            </>
          )}
          {(issue.status === 'resolved' || issue.status === 'closed') && (
            <button
              onClick={() => handleStatusUpdate('open')}
              disabled={updatingStatus}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:opacity-60"
            >
              {updatingStatus ? 'Updating...' : '↻ Reopen Issue'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4 min-h-0">
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

        <div className="flex-1 mb-4 min-h-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500 text-sm">Loading comments...</div>
          ) : error ? (
              <div className="p-8 text-center text-red-600 text-sm">{error}</div>
          ) : comments.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">No comments yet. Be the first to comment!</div>
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
          )}
        </div>

        <div className="bg-white rounded-lg p-4 shadow-lg flex-shrink-0">
          <form onSubmit={handleSubmitComment}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="w-full px-3 py-3 text-sm border border-gray-300 rounded-md min-h-[100px] resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-600 mb-3"
              required
            />
            <button
              type="submit"
              disabled={submittingComment}
              className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:opacity-60"
            >
              {submittingComment ? 'Posting...' : 'Post Comment'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default IssueDetail;
