import React, { useState, useEffect } from 'react';

const IssueDetail = ({ issue, onBack }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (issue) {
      fetchComments();
      
      // Set up auto-refresh for comments every 10 seconds
      const interval = setInterval(() => {
        fetchComments();
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [issue]);

  const fetchComments = async (isRefresh = false) => {
    if (!issue) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const response = await fetch(`http://localhost:5000/api/forum/issues/${issue.issueId}/comments`);
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
  };

  const handleRefresh = () => {
    fetchComments(true);
  };

  const handleGenerateAIResponse = async (commentId) => {
    try {
      setGeneratingAI(commentId);
      const response = await fetch(`http://localhost:5000/api/forum/comments/${commentId}/ai-response`, {
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
      const response = await fetch(`http://localhost:5000/api/forum/issues/${issue.issueId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update issue status');
      }

      const updatedIssue = await response.json();
      // Update the issue in the parent component
      window.location.reload(); // Simple refresh for now
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

      const response = await fetch('http://localhost:5000/api/forum/comments', {
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
      
      // Refresh comments to get AI response
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
      case 'open': return '#48bb78';
      case 'closed': return '#e53e3e';
      case 'resolved': return '#3182ce';
      default: return '#718096';
    }
  };

  const styles = {
    container: {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f7fafc',
      overflow: 'auto', // Allow scrolling within the container
    },
    header: {
      padding: '1.5rem', // Increased padding
      backgroundColor: 'white',
      borderBottom: '1px solid #e2e8f0',
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)', // Increased shadow
      flexShrink: 0, // Don't shrink the header
    },
    backButton: {
      background: 'none',
      border: 'none',
      color: '#3182ce',
      cursor: 'pointer',
      fontSize: '1rem', // Increased from 0.875rem
      marginBottom: '1.25rem', // Increased margin
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    issueCard: {
      backgroundColor: 'white',
      borderRadius: '12px', // Increased border radius
      padding: '2rem', // Increased padding
      marginBottom: '1.5rem', // Increased margin
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)', // Increased shadow
      flexShrink: 0, // Don't shrink the issue card
    },
    issueHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '1rem',
    },
    issueTitle: {
      fontSize: '2.5rem', // Further increased from 2rem
      fontWeight: 'bold',
      color: '#2d3748',
      margin: 0,
      flex: 1,
      marginRight: '2rem', // Increased margin
    },
    statusBadge: {
      padding: '1rem 2rem', // Further increased padding
      borderRadius: '30px', // Increased border radius
      fontSize: '1.2rem', // Further increased from 1rem
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    issueDescription: {
      fontSize: '1.4rem', // Further increased from 1.2rem
      color: '#4a5568',
      lineHeight: '1.8', // Increased line height
      marginBottom: '2rem', // Increased margin
      whiteSpace: 'pre-wrap',
    },
    issueMeta: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: '1rem',
      borderTop: '1px solid #e2e8f0',
    },
    userInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
    },
    avatar: {
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      backgroundColor: '#e2e8f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '0.875rem',
      fontWeight: '600',
      color: '#4a5568',
    },
    tags: {
      display: 'flex',
      gap: '0.5rem',
      flexWrap: 'wrap',
      marginTop: '1rem',
    },
    tag: {
      padding: '0.25rem 0.75rem',
      backgroundColor: '#edf2f7',
      color: '#4a5568',
      borderRadius: '16px',
      fontSize: '0.75rem',
    },
    commentsSection: {
      flex: 1,
      padding: '1.5rem', // Increased padding
      display: 'flex',
      flexDirection: 'column',
      minHeight: '0', // Allow flex to work properly
    },
    commentsList: {
      flex: 1,
      marginBottom: '1.5rem',
      minHeight: '0', // Allow flex to work properly
    },
    commentsHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1rem',
    },
    commentsTitle: {
      fontSize: '1.75rem', // Further increased from 1.5rem
      fontWeight: 'bold',
      color: '#2d3748',
      margin: 0,
    },
    refreshButton: {
      padding: '0.75rem 1.25rem', // Increased padding
      backgroundColor: '#e2e8f0',
      color: '#4a5568',
      border: 'none',
      borderRadius: '8px', // Increased border radius
      cursor: 'pointer',
      fontSize: '1rem', // Increased from 0.875rem
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    disabledRefreshButton: {
      opacity: 0.6,
      cursor: 'not-allowed',
    },
    commentForm: {
      backgroundColor: 'white',
      borderRadius: '12px', // Increased border radius
      padding: '1.5rem', // Increased padding
      marginTop: 'auto', // Push to bottom
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)', // Enhanced shadow
      flexShrink: 0, // Don't shrink the form
    },
    commentTextarea: {
      width: '100%',
      padding: '1.25rem', // Further increased padding
      border: '1px solid #e2e8f0',
      borderRadius: '10px', // Increased border radius
      fontSize: '1.3rem', // Further increased from 1.1rem
      minHeight: '120px', // Further increased from 100px
      resize: 'vertical',
      fontFamily: 'inherit',
      marginBottom: '1.25rem', // Increased margin
    },
    submitButton: {
      padding: '1.25rem 2.5rem', // Further increased padding
      backgroundColor: '#3182ce',
      color: 'white',
      border: 'none',
      borderRadius: '10px', // Increased border radius
      cursor: 'pointer',
      fontSize: '1.2rem', // Further increased from 1rem
      fontWeight: '600',
    },
    disabledButton: {
      opacity: 0.6,
      cursor: 'not-allowed',
    },
    comment: {
      backgroundColor: 'white',
      borderRadius: '12px', // Further increased border radius
      padding: '1.75rem', // Further increased padding
      marginBottom: '1.5rem', // Further increased margin
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)', // Enhanced shadow
    },
    aiComment: {
      backgroundColor: '#f0f9ff',
      borderLeft: '4px solid #3182ce',
    },
    commentHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '0.5rem',
    },
    commentAuthor: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    commentAvatar: {
      width: '36px', // Increased from 24px
      height: '36px', // Increased from 24px
      borderRadius: '50%',
      backgroundColor: '#e2e8f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1rem', // Increased from 0.75rem
      fontWeight: '600',
      color: '#4a5568',
    },
    aiAvatar: {
      backgroundColor: '#3182ce',
      color: 'white',
    },
    commentContent: {
      fontSize: '1.5rem', // Further increased from 1.3rem
      color: '#4a5568',
      lineHeight: '1.8', // Increased line height
      whiteSpace: 'pre-wrap',
      marginTop: '1rem', // Added top margin
    },
    commentMeta: {
      fontSize: '0.875rem', // Increased from 0.75rem
      color: '#718096',
      marginTop: '0.75rem', // Increased margin
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    aiResponseButton: {
      padding: '0.75rem 1.5rem', // Further increased padding
      backgroundColor: '#3182ce',
      color: 'white',
      border: 'none',
      borderRadius: '8px', // Increased border radius
      cursor: 'pointer',
      fontSize: '1rem', // Further increased from 0.875rem
      fontWeight: '600',
    },
    disabledAIButton: {
      opacity: 0.6,
      cursor: 'not-allowed',
    },
    statusActions: {
      display: 'flex',
      gap: '1rem',
      marginTop: '1.5rem',
      paddingTop: '1.5rem',
      borderTop: '1px solid #e2e8f0',
    },
    statusButton: {
      padding: '0.75rem 1.5rem',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: '600',
      transition: 'all 0.2s',
    },
    closeButton: {
      backgroundColor: '#e53e3e',
      color: 'white',
    },
    resolveButton: {
      backgroundColor: '#38a169',
      color: 'white',
    },
    reopenButton: {
      backgroundColor: '#3182ce',
      color: 'white',
    },
    disabledStatusButton: {
      opacity: 0.6,
      cursor: 'not-allowed',
    },
    loading: {
      padding: '2rem',
      textAlign: 'center',
      color: '#718096',
    },
    error: {
      padding: '2rem',
      textAlign: 'center',
      color: '#e53e3e',
    },
    empty: {
      padding: '2rem',
      textAlign: 'center',
      color: '#718096',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      minHeight: 'calc(100vh - 200px)', // Ensure it takes proper height
    },
  };

  if (!issue) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#2d3748' }}>
            Welcome to AI Forum
          </h2>
          <p style={{ fontSize: '1.2rem', marginBottom: '2rem', color: '#4a5568' }}>
            Select an issue from the right panel to view details and comments
          </p>
          <div style={{ fontSize: '1rem', color: '#718096' }}>
            Or create a new issue to get started!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={onBack} style={styles.backButton}>
          ← Back to Issues
        </button>
      </div>

      <div style={styles.issueCard}>
        <div style={styles.issueHeader}>
          <h1 style={styles.issueTitle}>{issue.title}</h1>
          <span
            style={{
              ...styles.statusBadge,
              backgroundColor: getStatusColor(issue.status),
              color: 'white',
            }}
          >
            {issue.status}
          </span>
        </div>

        <p style={styles.issueDescription}>{issue.description}</p>

        {issue.tags && issue.tags.length > 0 && (
          <div style={styles.tags}>
            {issue.tags.map((tag, index) => (
              <span key={index} style={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        )}

        <div style={styles.issueMeta}>
          <div style={styles.userInfo}>
            <div style={styles.avatar}>
              {issue.userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: '600', color: '#2d3748', fontSize: '1.1rem' }}>
                {issue.userName}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#718096' }}>
                {issue.userEmail}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '1rem', color: '#718096' }}>
            {formatDate(issue.createdAt)}
          </div>
        </div>

        <div style={styles.statusActions}>
          {issue.status === 'open' && (
            <>
              <button
                onClick={() => handleStatusUpdate('resolved')}
                style={{
                  ...styles.statusButton,
                  ...styles.resolveButton,
                  ...(updatingStatus ? styles.disabledStatusButton : {})
                }}
                disabled={updatingStatus}
              >
                {updatingStatus ? 'Updating...' : '✓ Mark as Resolved'}
              </button>
              <button
                onClick={() => handleStatusUpdate('closed')}
                style={{
                  ...styles.statusButton,
                  ...styles.closeButton,
                  ...(updatingStatus ? styles.disabledStatusButton : {})
                }}
                disabled={updatingStatus}
              >
                {updatingStatus ? 'Updating...' : '✕ Close Issue'}
              </button>
            </>
          )}
          {issue.status === 'resolved' && (
            <button
              onClick={() => handleStatusUpdate('open')}
              style={{
                ...styles.statusButton,
                ...styles.reopenButton,
                ...(updatingStatus ? styles.disabledStatusButton : {})
              }}
              disabled={updatingStatus}
            >
              {updatingStatus ? 'Updating...' : '↻ Reopen Issue'}
            </button>
          )}
          {issue.status === 'closed' && (
            <button
              onClick={() => handleStatusUpdate('open')}
              style={{
                ...styles.statusButton,
                ...styles.reopenButton,
                ...(updatingStatus ? styles.disabledStatusButton : {})
              }}
              disabled={updatingStatus}
            >
              {updatingStatus ? 'Updating...' : '↻ Reopen Issue'}
            </button>
          )}
        </div>
      </div>

      <div style={styles.commentsSection}>
        <div style={styles.commentsHeader}>
          <h3 style={styles.commentsTitle}>Comments ({comments.length})</h3>
          <button
            onClick={handleRefresh}
            style={{
              ...styles.refreshButton,
              ...(refreshing ? styles.disabledRefreshButton : {})
            }}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>

        <div style={styles.commentsList}>
          {loading ? (
            <div style={styles.loading}>Loading comments...</div>
          ) : error ? (
            <div style={styles.error}>{error}</div>
          ) : comments.length === 0 ? (
            <div style={styles.empty}>No comments yet. Be the first to comment!</div>
          ) : (
            comments.map((comment) => (
              <div
                key={comment._id}
                style={{
                  ...styles.comment,
                  ...(comment.isAI ? styles.aiComment : {})
                }}
              >
                <div style={styles.commentHeader}>
                  <div style={styles.commentAuthor}>
                    <div
                      style={{
                        ...styles.commentAvatar,
                        ...(comment.isAI ? styles.aiAvatar : {})
                      }}
                    >
                      {comment.isAI ? 'AI' : comment.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', color: '#2d3748', fontSize: '1.1rem' }}>
                        {comment.isAI ? 'AI Assistant' : comment.userName}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#718096' }}>
                        {comment.userEmail}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#718096' }}>
                    {formatDate(comment.createdAt)}
                  </div>
                </div>

                <div style={styles.commentContent}>{comment.content}</div>

                <div style={styles.commentMeta}>
                  <div>
                    {comment.isAI && (
                      <span style={{ color: '#3182ce', fontWeight: '600' }}>
                        AI Response
                      </span>
                    )}
                  </div>
                  {!comment.isAI && (
                    <button
                      onClick={() => handleGenerateAIResponse(comment._id)}
                      style={{
                        ...styles.aiResponseButton,
                        ...(generatingAI === comment._id ? styles.disabledAIButton : {})
                      }}
                      disabled={generatingAI === comment._id}
                    >
                      {generatingAI === comment._id ? 'Generating...' : 'Get AI Response'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={styles.commentForm}>
          <form onSubmit={handleSubmitComment}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              style={styles.commentTextarea}
              required
            />
            <button
              type="submit"
              style={{
                ...styles.submitButton,
                ...(submittingComment ? styles.disabledButton : {})
              }}
              disabled={submittingComment}
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
