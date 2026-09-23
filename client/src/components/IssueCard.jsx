import React from 'react';
import { categoryMeta, statusMeta, isOwner } from '../lib/forum';

const CATEGORY_ICONS = {
  general: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
              <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
            </svg>
  ),
  tutorial: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
            </svg>
  ),
  urgent: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
  ),
  ideation: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
            </svg>
  ),
  showcase: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
  ),
};

/**
 * One discussion in the grid. The icon and badge come from the post's
 * category; the pill is its status. Previously a single badge was keyed by
 * status, so every post showed "ACTIVE" or "SOLVED" and the category icons
 * were unreachable, and the reply count was always 0 (the server never sent it).
 */
const IssueCard = ({ issue, onClick }) => {
  const category = categoryMeta(issue.category);
  const status = statusMeta(issue.status);
  const commentsCount = issue.commentsCount || 0;
  const netVotes = issue.netVotes ?? ((issue.upvotes || 0) - (issue.downvotes || 0));
  const mine = isOwner(issue);

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick())}
      role="button"
      tabIndex={0}
      className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-xl transition-all duration-300
                 cursor-pointer hover:border-blue-300 group flex flex-col focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {/* Header: category icon + category badge + status */}
      <div className="flex justify-between items-start gap-3 mb-4">
        <div className={`w-10 h-10 shrink-0 rounded-lg ${category.iconBg} ${category.iconColor}
                        flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
          {CATEGORY_ICONS[category.value]}
        </div>
        <div className="flex flex-wrap justify-end items-center gap-1.5">
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${category.badge}`}>
            {category.label}
          </span>
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold text-white uppercase inline-flex items-center gap-1 ${status.pill}`}>
            {issue.status === 'resolved' && (
              <span className="w-3 h-3 [&>svg]:w-3 [&>svg]:h-3" aria-hidden="true"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg></span>
            )}
            {status.label}
          </span>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-lg font-bold text-gray-900 mb-2 
                     group-hover:text-blue-600 transition-colors line-clamp-2 min-h-[3.5rem]">
        {issue.title}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[2.5rem]">
        {issue.description}
      </p>

      {/* Footer: author, votes, replies */}
      <div className="mt-auto flex items-center justify-between text-sm pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 shrink-0 rounded-full bg-gradient-to-br from-blue-400 to-blue-600
                          flex items-center justify-center text-xs font-semibold text-white">
            {issue.userName ? issue.userName.charAt(0).toUpperCase() : 'U'}
          </div>
          <span className="text-gray-700 font-medium truncate max-w-[120px]">
            {mine ? 'You' : issue.userName || 'Anonymous'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-gray-500 shrink-0">
          <span className="flex items-center gap-1" title={`${netVotes} net votes`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            <span className="tabular-nums">{netVotes}</span>
          </span>
          <span className="flex items-center gap-1.5" title={`${commentsCount} ${commentsCount === 1 ? 'reply' : 'replies'}`}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
            <span className="tabular-nums">{commentsCount}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default IssueCard;
