import React, { useState, useEffect, useCallback } from 'react';
import IssueCard from './IssueCard';

const ForumGrid = ({ onIssueSelect, onCreateIssue }) => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');

  const apiUrl = process.env.REACT_APP_API_ENDPOINT || 'http://localhost:5001';

  const fetchIssues = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        sortBy: sortBy,
        sortOrder: 'desc',
        status: categoryFilter === 'all' ? 'open' : categoryFilter,
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
      setError('Failed to load discussions');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, sortBy, categoryFilter]);

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
      setError('Failed to search discussions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-gray-50">
      {/* Header Section - Sticky */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">
            AI Community Forum
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            Connect, share, and learn with peers.
          </p>
          
          {/* Search and Filters Row */}
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" 
                   fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search discussions, topics, or issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg 
                           focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent
                           text-sm"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg bg-white
                         focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent
                         text-sm font-medium text-gray-700 cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="open">Active</option>
              <option value="tutorial">Tutorial</option>
              <option value="urgent">Urgent</option>
              <option value="ideation">Ideation</option>
              <option value="showcase">Showcase</option>
              <option value="resolved">Solved</option>
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg bg-white
                         focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent
                         text-sm font-medium text-gray-700 cursor-pointer"
            >
              <option value="createdAt">Latest</option>
              <option value="upvotes">Popular</option>
              <option value="title">Title</option>
            </select>

            {/* New Post Button */}
            <button
              onClick={onCreateIssue}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white 
                         rounded-lg font-medium text-sm transition-colors duration-200
                         flex items-center gap-2 whitespace-nowrap shadow-sm hover:shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Post
            </button>
          </div>
        </div>
      </div>

      {/* Cards Grid Section */}
      <div className="px-8 py-6">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 text-sm">Loading discussions...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-600 font-medium mb-2">{error}</p>
                <button 
                  onClick={fetchIssues}
                  className="text-blue-600 text-sm hover:underline"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : issues.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center max-w-md">
                <svg className="w-20 h-20 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" />
                </svg>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No discussions found</h3>
                <p className="text-gray-600 text-sm mb-4">
                  {searchQuery ? 'Try adjusting your search terms' : 'Be the first to start a discussion!'}
                </p>
                <button
                  onClick={onCreateIssue}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white 
                             rounded-lg font-medium text-sm transition-colors"
                >
                  Create New Post
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {issues.map((issue) => (
                  <IssueCard
                    key={issue.issueId}
                    issue={issue}
                    onClick={() => onIssueSelect(issue)}
                  />
                ))}
              </div>

              {/* Load More Button */}
              {issues.length >= 20 && (
                <div className="mt-8 text-center">
                  <button
                    onClick={fetchIssues}
                    className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 
                               rounded-lg font-medium hover:border-blue-600 hover:text-blue-600
                               transition-colors duration-200"
                  >
                    Load More Discussions
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForumGrid;
