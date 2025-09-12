import React, { useState, useEffect } from 'react';

const IssueList = ({ onIssueSelect, selectedIssueId, onCreateIssue }) => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('open');

  useEffect(() => {
    fetchIssues();
  }, [sortBy, sortOrder, statusFilter]);

  const fetchIssues = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        sortBy,
        sortOrder,
        status: statusFilter,
        limit: 20
      });

      const response = await fetch(`http://localhost:5000/api/forum/issues?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch issues');
      }

      const data = await response.json();
      setIssues(data.issues || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching issues:', err);
      setError('Failed to load issues');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchIssues();
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({
        q: searchQuery,
        limit: 20
      });

      const response = await fetch(`http://localhost:5000/api/forum/search?${params}`);
      if (!response.ok) {
        throw new Error('Failed to search issues');
      }

      const data = await response.json();
      setIssues(data.issues || []);
      setError(null);
    } catch (err) {
      console.error('Error searching issues:', err);
      setError('Failed to search issues');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
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
      overflow: 'hidden', // Prevent container from scrolling
    },
    header: {
      padding: '1rem',
      backgroundColor: 'white',
      borderBottom: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      flexShrink: 0, // Don't shrink the header
    },
    title: {
      fontSize: '1.75rem', // Further increased from 1.5rem
      fontWeight: 'bold',
      color: '#2d3748',
      marginBottom: '1.5rem', // Increased margin
    },
    searchContainer: {
      display: 'flex',
      gap: '0.5rem',
      marginBottom: '1rem',
    },
    searchInput: {
      flex: 1,
      padding: '1rem', // Further increased padding
      border: '1px solid #e2e8f0',
      borderRadius: '10px', // Increased border radius
      fontSize: '1.1rem', // Further increased from 1rem
    },
    searchButton: {
      padding: '1rem 1.5rem', // Further increased padding
      backgroundColor: '#3182ce',
      color: 'white',
      border: 'none',
      borderRadius: '10px', // Increased border radius
      cursor: 'pointer',
      fontSize: '1.1rem', // Further increased from 1rem
    },
    filtersContainer: {
      display: 'flex',
      gap: '1rem',
      alignItems: 'center',
    },
    select: {
      padding: '1rem', // Further increased padding
      border: '1px solid #e2e8f0',
      borderRadius: '10px', // Increased border radius
      fontSize: '1.1rem', // Further increased from 1rem
      backgroundColor: 'white',
    },
    addButton: {
      padding: '1rem 2rem', // Further increased padding
      backgroundColor: '#38a169',
      color: 'white',
      border: 'none',
      borderRadius: '10px', // Increased border radius
      cursor: 'pointer',
      fontSize: '1.1rem', // Further increased from 1rem
      fontWeight: '600',
      marginLeft: 'auto',
    },
    issuesList: {
      flex: 1,
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '0.5rem',
      height: '100%', // Ensure it takes full height
    },
    issueItem: {
      backgroundColor: 'white',
      borderRadius: '10px', // Increased border radius
      padding: '1.25rem', // Increased padding
      marginBottom: '0.75rem', // Increased margin
      cursor: 'pointer',
      border: '2px solid transparent',
      transition: 'all 0.2s',
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)', // Increased shadow
    },
    selectedIssue: {
      borderColor: '#3182ce',
      backgroundColor: '#ebf8ff',
    },
    issueHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '0.5rem',
    },
    issueTitle: {
      fontSize: '1.4rem', // Further increased from 1.2rem
      fontWeight: '600',
      color: '#2d3748',
      margin: 0,
      flex: 1,
      marginRight: '1rem', // Increased margin
    },
    statusBadge: {
      padding: '0.5rem 1rem', // Further increased padding
      borderRadius: '20px', // Increased border radius
      fontSize: '1rem', // Further increased from 0.875rem
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    issueDescription: {
      fontSize: '1.2rem', // Further increased from 1rem
      color: '#4a5568',
      lineHeight: '1.6', // Increased line height
      marginBottom: '1.25rem', // Increased margin
      display: '-webkit-box',
      WebkitLineClamp: 3, // Increased from 2 to show more text
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
    },
    issueMeta: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '1rem', // Further increased from 0.875rem
      color: '#718096',
    },
    userInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    avatar: {
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      backgroundColor: '#e2e8f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '0.625rem',
      fontWeight: '600',
      color: '#4a5568',
    },
    tags: {
      display: 'flex',
      gap: '0.5rem', // Increased gap
      flexWrap: 'wrap',
      marginTop: '1rem', // Increased margin
      marginBottom: '1rem', // Added bottom margin
    },
    tag: {
      padding: '0.375rem 0.875rem', // Increased padding
      backgroundColor: '#e2e8f0',
      color: '#2d3748',
      borderRadius: '16px', // Increased border radius
      fontSize: '0.875rem', // Increased font size
      fontWeight: '500',
      border: '1px solid #cbd5e0',
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
    },
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h3 style={styles.title}>Forum Issues</h3>
        </div>
        <div style={styles.loading}>Loading issues...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h3 style={styles.title}>Forum Issues</h3>
        </div>
        <div style={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Forum Issues</h3>
        
        <div style={styles.searchContainer}>
          <input
            type="text"
            placeholder="Search issues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} style={styles.searchButton}>
            Search
          </button>
        </div>

        <div style={styles.filtersContainer}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={styles.select}
          >
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={styles.select}
          >
            <option value="createdAt">Date</option>
            <option value="upvotes">Votes</option>
            <option value="title">Title</option>
          </select>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            style={styles.select}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>

          <button onClick={onCreateIssue} style={styles.addButton}>
            + Add Issue
          </button>
        </div>
      </div>

      <div style={styles.issuesList}>
        {issues.length === 0 ? (
          <div style={styles.empty}>
            {searchQuery ? 'No issues found matching your search.' : 'No issues yet. Be the first to create one!'}
          </div>
        ) : (
          issues.map((issue) => (
            <div
              key={issue.issueId}
              style={{
                ...styles.issueItem,
                ...(selectedIssueId === issue.issueId ? styles.selectedIssue : {})
              }}
              onClick={() => onIssueSelect(issue)}
            >
              <div style={styles.issueHeader}>
                <h4 style={styles.issueTitle}>{issue.title}</h4>
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
                  <span>{issue.userName}</span>
                </div>
                <span>{formatDate(issue.createdAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default IssueList;
