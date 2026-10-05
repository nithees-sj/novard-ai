import { currentEmail } from './session';

/**
 * Shared forum vocabulary. Category and status are independent: a Tutorial can
 * be open or solved. The old UI mixed both into a single dropdown and sent the
 * categories as a status, which the server had no values for.
 */
export const FORUM_CATEGORIES = [
  { value: 'general', label: 'General', badge: 'bg-gray-100 text-gray-700', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
  { value: 'tutorial', label: 'Tutorial', badge: 'bg-purple-100 text-purple-700', iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
  { value: 'urgent', label: 'Urgent', badge: 'bg-red-100 text-red-700', iconBg: 'bg-red-100', iconColor: 'text-red-600' },
  { value: 'ideation', label: 'Ideation', badge: 'bg-green-100 text-green-700', iconBg: 'bg-green-100', iconColor: 'text-green-600' },
  { value: 'showcase', label: 'Showcase', badge: 'bg-pink-100 text-pink-700', iconBg: 'bg-pink-100', iconColor: 'text-pink-600' },
];

export const FORUM_STATUSES = [
  // Solid tones that keep the pills' white text readable (AA) in both themes.
  { value: 'open', label: 'Active', pill: 'bg-green-700' },
  { value: 'resolved', label: 'Solved', pill: 'bg-teal-700' },
  { value: 'closed', label: 'Closed', pill: 'bg-slate-500' },
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
