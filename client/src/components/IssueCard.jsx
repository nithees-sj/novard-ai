import React from 'react';
import { categoryMeta, statusMeta, isOwner } from '../lib/forum';
import Icon from './ui/Icon';
import Badge, { Status } from './ui/Badge';
import Avatar from './ui/Avatar';

const ago = (value) => {
  if (!value) return '';
  const mins = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/**
 * One discussion as a card of the forum list: category and status, the
 * title, two lines of the post, the author and age; votes and replies in
 * fixed boxes on the right so they compare down the page.
 */
const IssueCard = ({ issue, onClick }) => {
  const category = categoryMeta(issue.category);
  const status = statusMeta(issue.status);
  const commentsCount = issue.commentsCount || 0;
  const netVotes = issue.netVotes ?? ((issue.upvotes || 0) - (issue.downvotes || 0));
  const mine = isOwner(issue);

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full flex-col gap-4 rounded-xl bg-raised p-5 text-left ring-1 ring-line-subtle transition duration-200 hover:shadow-popover hover:ring-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:flex-row sm:items-start sm:gap-6 sm:p-6"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={category.tone}><Icon name={category.icon} className="h-3 w-3" />{category.label}</Badge>
            <Status tone={status.tone} className="text-fg-muted">{status.label}</Status>
          </span>
          <span className="mt-2.5 block break-words text-title font-semibold leading-snug text-fg group-hover:text-accent-fg [overflow-wrap:anywhere]">{issue.title}</span>
          {issue.description && <span className="mt-1.5 block line-clamp-2 text-lead leading-relaxed text-fg-muted [overflow-wrap:anywhere]">{issue.description}</span>}
          <span className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-body text-fg-muted">
            <span className="inline-flex min-w-0 items-center gap-2">
              <Avatar name={issue.userName || 'Anonymous'} size="sm" />
              <span className="truncate font-medium text-fg">{mine ? 'You' : issue.userName || 'Anonymous'}</span>
            </span>
            {issue.createdAt && <><span className="text-fg-disabled" aria-hidden="true">·</span><time dateTime={issue.createdAt}>{ago(issue.createdAt)}</time></>}
          </span>
        </span>
        <span className="flex shrink-0 gap-2 sm:gap-3">
          <span className="flex min-w-[4rem] flex-row items-baseline gap-1.5 rounded-lg bg-sunken px-3 py-1.5 sm:w-16 sm:flex-col sm:items-center sm:gap-0 sm:px-2 sm:py-2.5" title={`${netVotes} net votes`}>
            <span className="num text-title font-semibold text-fg">{netVotes}</span>
            <span className="text-caption text-fg-muted">votes</span>
          </span>
          <span className="flex min-w-[4rem] flex-row items-baseline gap-1.5 rounded-lg bg-sunken px-3 py-1.5 sm:w-16 sm:flex-col sm:items-center sm:gap-0 sm:px-2 sm:py-2.5" title={`${commentsCount} ${commentsCount === 1 ? 'reply' : 'replies'}`}>
            <span className={`num text-title font-semibold ${commentsCount ? 'text-fg' : 'text-fg-subtle'}`}>{commentsCount}</span>
            <span className="text-caption text-fg-muted">{commentsCount === 1 ? 'reply' : 'replies'}</span>
          </span>
        </span>
      </button>
    </li>
  );
};

export default IssueCard;
