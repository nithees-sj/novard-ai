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
 * One discussion as a row of the forum list: votes and replies in fixed
 * columns on the right so they compare down the page, the title and one line
 * of the post, then category, status and author.
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
        className="group flex w-full items-start gap-4 px-4 py-4 text-left transition-colors duration-150 hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus sm:px-5"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-lead font-medium text-fg group-hover:text-accent-fg">{issue.title}</span>
          {issue.description && <span className="mt-1 block line-clamp-1 text-body text-fg-muted">{issue.description}</span>}
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-small text-fg-subtle">
            <Badge tone={category.tone}><Icon name={category.icon} className="h-3 w-3" />{category.label}</Badge>
            <Status tone={status.tone}>{status.label}</Status>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Avatar name={issue.userName || 'Anonymous'} size="xs" />
              <span className="truncate">{mine ? 'You' : issue.userName || 'Anonymous'}</span>
            </span>
            {issue.createdAt && <time dateTime={issue.createdAt}>{ago(issue.createdAt)}</time>}
          </span>
        </span>
        <span className="flex shrink-0 gap-4 pt-0.5 text-small text-fg-subtle sm:gap-6">
          <span className="flex w-10 flex-col items-center" title={`${netVotes} net votes`}>
            <span className="num text-body font-medium text-fg">{netVotes}</span>
            <span className="text-caption">votes</span>
          </span>
          <span className="flex w-10 flex-col items-center" title={`${commentsCount} ${commentsCount === 1 ? 'reply' : 'replies'}`}>
            <span className={`num text-body font-medium ${commentsCount ? 'text-fg' : 'text-fg-subtle'}`}>{commentsCount}</span>
            <span className="text-caption">{commentsCount === 1 ? 'reply' : 'replies'}</span>
          </span>
        </span>
      </button>
    </li>
  );
};

export default IssueCard;
