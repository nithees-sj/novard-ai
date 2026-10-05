import { currentEmail } from './session';

/**
 * Shared forum vocabulary. Category and status are independent: a Tutorial can
 * be open or solved. The old UI mixed both into a single dropdown and sent the
 * categories as a status, which the server had no values for.
 */
export const FORUM_CATEGORIES = [
  { value: 'general', label: 'General', tone: 'neutral', icon: 'forum', badge: 'bg-gray-100 text-gray-700', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
  { value: 'tutorial', label: 'Tutorial', tone: 'info', icon: 'book', badge: 'bg-purple-100 text-purple-700', iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
  { value: 'urgent', label: 'Urgent', tone: 'danger', icon: 'warning', badge: 'bg-red-100 text-red-700', iconBg: 'bg-red-100', iconColor: 'text-red-600' },
  { value: 'ideation', label: 'Ideation', tone: 'warning', icon: 'idea', badge: 'bg-green-100 text-green-700', iconBg: 'bg-green-100', iconColor: 'text-green-600' },
  { value: 'showcase', label: 'Showcase', tone: 'accent', icon: 'image', badge: 'bg-pink-100 text-pink-700', iconBg: 'bg-pink-100', iconColor: 'text-pink-600' },
];

export const FORUM_STATUSES = [
  // `tone` is the Badge/Status tone; `pill` is kept for older callers.
  { value: 'open', label: 'Active', tone: 'success', pill: 'bg-green-700' },
  { value: 'resolved', label: 'Solved', tone: 'accent', pill: 'bg-teal-700' },
  { value: 'closed', label: 'Closed', tone: 'neutral', pill: 'bg-slate-500' },
];

export const FORUM_SORTS = [
  { value: 'newest', label: 'Latest' },
  { value: 'popular', label: 'Most upvoted' },
  { value: 'discussed', label: 'Most discussed' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'title', label: 'Title A–Z' },
];

export const categoryMeta = (value) =>
  FORUM_CATEGORIES.find((c) => c.value === value) || FORUM_CATEGORIES[0];

export const statusMeta = (value) =>
  FORUM_STATUSES.find((s) => s.value === value) || FORUM_STATUSES[0];

export const currentUserEmail = () => currentEmail().trim().toLowerCase();

export const isOwner = (issue) =>
  Boolean(issue?.userEmail) && issue.userEmail.trim().toLowerCase() === currentUserEmail();
