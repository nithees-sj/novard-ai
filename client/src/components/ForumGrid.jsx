import React, { useState, useEffect, useCallback, useRef } from 'react';
import IssueCard from './IssueCard';
import { FORUM_CATEGORIES, FORUM_STATUSES, FORUM_SORTS } from '../lib/forum';
import { apiJson } from '../lib/api';
import logger from '../lib/logger';
import { PageHeader } from './ui/Headers';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { Select } from './ui/Field';
import { EmptyState, ErrorState, Skeleton } from './ui/States';

const PAGE_SIZE = 12;
const DEFAULTS = { category: 'all', status: 'all', sort: 'newest', query: '' };


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

      const data = await apiJson(`/api/forum/issues?${params}`);

      // A slower, older request must not overwrite the results of a newer one.
      if (seq !== requestSeq.current) return;
      setIssues((prev) => (append ? [...prev, ...(data.issues || [])] : data.issues || []));
      setTotal(data.total || 0);
      setPage(pageToLoad);
      setHasMore(Boolean(data.hasMore));
      setError(null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      logger.error('Error fetching issues', err);
      setError(err.message || 'Failed to load discussions');
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [category, status, sort, query]);

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
    <div>
      <PageHeader
        title="Forum"
        description="Ask other students, share what you built, and help with what you know. An AI assistant answers too."
        actions={<Button icon="plus" onClick={onCreateIssue}>New post</Button>}
      />

      {/* Filters */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <input
            type="search"
            placeholder="Search titles, posts and tags"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setQuery(searchInput.trim())}
            aria-label="Search discussions"
            className="block h-9 w-full rounded bg-raised pl-9 pr-3 text-body text-fg ring-1 ring-inset ring-line placeholder:text-fg-subtle transition-shadow hover:ring-line-strong focus:outline-none focus:ring-2 focus:ring-focus"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className="lg:w-40">
            <option value="all">All categories</option>
            {FORUM_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className="lg:w-36">
            <option value="all">All statuses</option>
            {FORUM_STATUSES.map((st) => <option key={st.value} value={st.value}>{st.label}</option>)}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by" className="col-span-2 sm:col-span-1 lg:w-40">
            {FORUM_SORTS.map((so) => <option key={so.value} value={so.value}>{so.label}</option>)}
          </Select>
        </div>
      </div>

      <div className="mb-3 mt-5 flex min-h-[1.25rem] items-center justify-between text-body text-fg-muted">
        <span className="tabular" aria-live="polite">
          {!loading && !error && total > 0 && `${issues.length} of ${total} ${total === 1 ? 'discussion' : 'discussions'}`}
        </span>
        {filtersActive && (
          <button type="button" onClick={clearFilters} className="font-medium text-accent-fg hover:underline">Clear filters</button>
        )}
      </div>

      <div className={loading || error || issues.length === 0 ? 'overflow-hidden rounded-xl bg-raised ring-1 ring-line-subtle' : ''}>
        {loading ? (
          <div className="divide-y divide-line-subtle" role="status" aria-label="Loading discussions">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2.5 px-5 py-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-40" />
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState title="Discussions didn’t load" text={error} onRetry={() => fetchPage(1, false)} />
        ) : issues.length === 0 ? (
          <EmptyState
            icon="forum"
            title={filtersActive ? 'No discussions match' : 'No discussions yet'}
            text={filtersActive ? 'Try other filters, or clear them to see everything.' : 'Start the first one: ask a question or share something you made.'}
            action={filtersActive
              ? <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>
              : <Button icon="plus" onClick={onCreateIssue}>New post</Button>}
          />
        ) : (
          <ul className="space-y-3">
            {issues.map((issue) => (
              <IssueCard key={issue.issueId} issue={issue} onClick={() => onIssueSelect(issue)} />
            ))}
          </ul>
        )}
      </div>

      {hasMore && !loading && (
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" onClick={() => fetchPage(page + 1, true)} loading={loadingMore} loadingLabel="Loading…">
            Load more <span className="tabular text-fg-subtle">({total - issues.length} left)</span>
          </Button>
        </div>
      )}
    </div>
  );
};

export default ForumGrid;
