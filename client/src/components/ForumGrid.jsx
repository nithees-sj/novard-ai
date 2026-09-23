import React, { useState, useEffect, useCallback, useRef } from 'react';
import IssueCard from './IssueCard';
import { FORUM_CATEGORIES, FORUM_STATUSES, FORUM_SORTS } from '../lib/forum';

const PAGE_SIZE = 12;
const DEFAULTS = { category: 'all', status: 'all', sort: 'newest', query: '' };

const selectClass =
  'px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 ' +
  'focus:ring-blue-600 focus:border-transparent text-sm font-medium text-gray-700 cursor-pointer';

/**
 * Discussion list. Category, status, search and sort are all applied together
 * by the server, so every combination is exact:
 *   - "All categories" now really means all (it used to mean "open only")
 *   - categories and status are separate controls (the old single dropdown
 *     sent Tutorial/Urgent/... as a status, which always returned nothing)
 *   - search keeps the other filters instead of discarding them
 *   - "Load more" fetches the next page (it used to refetch the same 20)
 */
const ForumGrid = ({ onIssueSelect, onCreateIssue, refreshKey = 0 }) => {
  const [issues, setIssues] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState(DEFAULTS.query);
  const [category, setCategory] = useState(DEFAULTS.category);
  const [status, setStatus] = useState(DEFAULTS.status);
  const [sort, setSort] = useState(DEFAULTS.sort);

  const apiUrl = process.env.REACT_APP_API_ENDPOINT;
  const requestSeq = useRef(0);

  // Search as you type, but only once typing pauses.
  useEffect(() => {
    const t = setTimeout(() => setQuery(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchPage = useCallback(async (pageToLoad, append) => {
    const seq = ++requestSeq.current;
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const params = new URLSearchParams({
        category, status, sort, page: String(pageToLoad), limit: String(PAGE_SIZE),
      });
      if (query) params.set('q', query);

      const response = await fetch(`${apiUrl}/api/forum/issues?${params}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to load discussions');

      // A slower, older request must not overwrite the results of a newer one.
      if (seq !== requestSeq.current) return;
      setIssues((prev) => (append ? [...prev, ...(data.issues || [])] : data.issues || []));
      setTotal(data.total || 0);
      setPage(pageToLoad);
      setHasMore(Boolean(data.hasMore));
      setError(null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error('Error fetching issues:', err);
      setError(err.message || 'Failed to load discussions');
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [apiUrl, category, status, sort, query]);

  useEffect(() => {
    fetchPage(1, false);
  }, [fetchPage, refreshKey]);

  const filtersActive =
    category !== DEFAULTS.category || status !== DEFAULTS.status || sort !== DEFAULTS.sort || query !== '';

  const clearFilters = () => {
    setSearchInput('');
    setQuery('');
    setCategory(DEFAULTS.category);
    setStatus(DEFAULTS.status);
    setSort(DEFAULTS.sort);
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-gray-50">
      {/* Header Section - Sticky */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">AI Community Forum</h1>
          <p className="text-sm text-gray-600 mb-6">Connect, share, and learn with peers.</p>

          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative min-w-0">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                   fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                placeholder="Search discussions, topics, or tags..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setQuery(searchInput.trim())}
                aria-label="Search discussions"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none
                           focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass} aria-label="Category">
                <option value="all">All categories</option>
                {FORUM_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>

              <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass} aria-label="Status">
                <option value="all">All statuses</option>
                {FORUM_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>

              <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectClass} aria-label="Sort by">
                {FORUM_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>

              <button
                onClick={onCreateIssue}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm
                           transition-colors duration-200 flex items-center gap-2 whitespace-nowrap shadow-sm hover:shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Post
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-500 min-h-[20px]">
            <span>
              {!loading && !error && (
                total === 0 ? 'No matching discussions'
                  : `Showing ${issues.length} of ${total} ${total === 1 ? 'discussion' : 'discussions'}`
              )}
            </span>
            {filtersActive && (
              <button onClick={clearFilters} className="text-blue-600 font-medium hover:underline">
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cards Grid Section */}
      <div className="px-8 py-6">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                <p className="text-gray-600 text-sm">Loading discussions...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <p className="text-red-600 font-medium mb-2">{error}</p>
                <button onClick={() => fetchPage(1, false)} className="text-blue-600 text-sm hover:underline">
                  Try again
                </button>
              </div>
            </div>
          ) : issues.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center max-w-md">
                <svg className="w-20 h-20 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" />
                </svg>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No discussions found</h3>
                <p className="text-gray-600 text-sm mb-4">
                  {filtersActive ? 'Nothing matches these filters.' : 'Be the first to start a discussion!'}
                </p>
                {filtersActive ? (
                  <button onClick={clearFilters} className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:border-blue-600 hover:text-blue-600">
                    Clear filters
                  </button>
                ) : (
                  <button onClick={onCreateIssue} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors">
                    Create New Post
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {issues.map((issue) => (
                  <IssueCard key={issue.issueId} issue={issue} onClick={() => onIssueSelect(issue)} />
                ))}
              </div>

              {hasMore && (
                <div className="mt-8 text-center">
                  <button
                    onClick={() => fetchPage(page + 1, true)}
                    disabled={loadingMore}
                    className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-medium
                               hover:border-blue-600 hover:text-blue-600 transition-colors duration-200 disabled:opacity-60"
                  >
                    {loadingMore ? 'Loading…' : `Load more (${total - issues.length} left)`}
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
