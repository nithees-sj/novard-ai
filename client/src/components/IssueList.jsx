import React, { useState, useEffect, useCallback } from 'react';

const IssueList = ({ onIssueSelect, selectedIssueId, onCreateIssue }) => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('open');

  const apiUrl = process.env.REACT_APP_API_ENDPOINT || 'http://localhost:5001';

  const fetchIssues = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        sortBy,
        sortOrder,
        status: statusFilter,
        limit: 20
      });

      const response = await fetch(`${apiUrl}/api/forum/issues?${params}`);
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
  }, [apiUrl, sortBy, sortOrder, statusFilter]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

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

      const response = await fetch(`${apiUrl}/api/forum/search?${params}`);
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
      case 'open': return 'bg-green-500';
      case 'closed': return 'bg-red-500';
      case 'resolved': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col bg-gray-50">
        <div className="p-4 bg-white border-b border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900">Forum Issues</h3>
        </div>
        <div className="p-8 text-center text-gray-500 text-sm">Loading issues...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col bg-gray-50">
        <div className="p-4 bg-white border-b border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900">Forum Issues</h3>
        </div>
        <div className="p-8 text-center text-red-600 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 overflow-hidden">
      <div className="p-4 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Forum Issues</h3>
        
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Search issues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
          >
            Search
          </button>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="createdAt">Date</option>
            <option value="upvotes">Votes</option>
            <option value="title">Title</option>
          </select>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>

          <button
            onClick={onCreateIssue}
            className="ml-auto px-6 py-2 bg-green-600 text-white text-sm font-semibold rounded-md hover:bg-green-700"
          >
            + Add Issue
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
        {issues.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            {searchQuery ? 'No issues found matching your search.' : 'No issues yet. Be the first to create one!'}
          </div>
        ) : (
          issues.map((issue) => (
            <div
              key={issue.issueId}
              onClick={() => onIssueSelect(issue)}
              className={`bg-white rounded-lg p-4 mb-3 cursor-pointer border-2 transition-all shadow-md hover:shadow-lg ${selectedIssueId === issue.issueId ? 'border-blue-600 bg-blue-50' : 'border-transparent'
                }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-sm font-semibold text-gray-900 flex-1 mr-4">{issue.title}</h4>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white uppercase ${getStatusColor(issue.status)}`}>
                  {issue.status}
                </span>
              </div>

              <p className="text-sm text-gray-600 leading-relaxed mb-3 line-clamp-3">{issue.description}</p>

              {issue.tags && issue.tags.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-3">
                  {issue.tags.map((tag, index) => (
                    <span key={index} className="px-2 py-1 bg-gray-200 text-gray-700 rounded-lg text-xs font-medium border border-gray-300">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex justify-between items-center text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
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
