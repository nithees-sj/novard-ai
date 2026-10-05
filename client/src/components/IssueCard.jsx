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
 * One discussion as a card in the forum grid: category and status, the
 * title (two lines), a three-line preview, and a footer with the author,
 * the age, votes and replies. Cards in a row share one height.
 */
const IssueCard = ({ issue, onClick }) => {
  const category = categoryMeta(issue.category);
  const status = statusMeta(issue.status);
  const commentsCount = issue.commentsCount || 0;
  const netVotes = issue.netVotes ?? ((issue.upvotes || 0) - (issue.downvotes || 0));
  const mine = isOwner(issue);

  return (
    <li className="flex">
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full flex-col rounded-xl bg-raised p-5 text-left ring-1 ring-line-subtle transition duration-200 hover:-translate-y-0.5 hover:shadow-popover hover:ring-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span className="flex items-center justify-between gap-2">
          <Badge tone={category.tone}><Icon name={category.icon} className="h-3 w-3" />{category.label}</Badge>
          <Status tone={status.tone} className="text-fg-muted">{status.label}</Status>
        </span>

        <span className="mt-4 block line-clamp-2 text-lead font-semibold leading-snug text-fg [overflow-wrap:anywhere] group-hover:text-accent-fg">{issue.title}</span>
        <span className="mt-2 block line-clamp-3 text-body leading-relaxed text-fg-muted [overflow-wrap:anywhere]">
          {issue.description || 'No details added.'}
        </span>

        <span className="block min-h-5 flex-1" aria-hidden="true" />
        <span className="flex items-center justify-between gap-3 border-t border-line-subtle pt-4">
          <span className="flex min-w-0 items-center gap-2.5">
            <Avatar name={issue.userName || 'Anonymous'} size="md" />
            <span className="min-w-0">
              <span className="block truncate text-small font-medium text-fg">{mine ? 'You' : issue.userName || 'Anonymous'}</span>
              {issue.createdAt && <time className="block text-caption text-fg-subtle" dateTime={issue.createdAt}>{ago(issue.createdAt)}</time>}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-3 text-small text-fg-muted">
            <span className="inline-flex items-center gap-1" title={`${netVotes} net votes`}>
              <Icon name="thumbsUp" className="h-4 w-4 text-fg-subtle" />
              <span className="num font-medium text-fg">{netVotes}</span>
              <span className="sr-only">votes</span>
            </span>
            <span className="inline-flex items-center gap-1" title={`${commentsCount} ${commentsCount === 1 ? 'reply' : 'replies'}`}>
              <Icon name="chat" className="h-4 w-4 text-fg-subtle" />
              <span className={`num font-medium ${commentsCount ? 'text-fg' : 'text-fg-subtle'}`}>{commentsCount}</span>
              <span className="sr-only">{commentsCount === 1 ? 'reply' : 'replies'}</span>
            </span>
          </span>
        </span>
      </button>
    </li>
  );
};

export default IssueCard;
