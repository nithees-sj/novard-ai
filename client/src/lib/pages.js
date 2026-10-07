/**
 * Every student page's one name, used in the sidebar, the breadcrumb, the
 * page heading and the browser tab, so they never disagree.
 */
export const PAGES = {
  home: { path: '/home', name: 'Home', icon: 'home' },
  doubts: { path: '/doubts', name: 'Doubts & Notes', icon: 'doubt' },
  plans: { path: '/skill-unlocker', name: 'Skill Plans', icon: 'plan' },
  todos: { path: '/todos', name: 'Todo lists', icon: 'todo' },
  videos: { path: '/video', name: 'Videos', icon: 'video' },
  career: { path: '/career', name: 'Career', icon: 'career' },
  forum: { path: '/forum', name: 'Forum', icon: 'forum' },
  profile: { path: '/profile', name: 'Profile', icon: 'user' },
  settings: { path: '/settings', name: 'Settings', icon: 'settings' },
  reports: { path: '/reports', name: 'My reports', icon: 'flag' },
  agent: { path: '/chatbot', name: 'Novard Agent', icon: 'agent' },
};

/** The tools inside a page. */
export const TOOLS = {
  roadmap: { page: 'career', name: 'Smart Roadmap', icon: 'roadmap' },
  skills: { page: 'career', name: 'Skill Gap Analysis', icon: 'target' },
  notes: { page: 'doubts', name: 'Notes & Quiz', icon: 'summary' },
  doubtClearance: { page: 'doubts', name: 'Doubt Clearance', icon: 'doubt' },
  videoLibrary: { page: 'videos', name: 'Video Library', icon: 'library' },
  videoSummarizer: { page: 'videos', name: 'Video Summarizer', icon: 'play' },
};

/** The sidebar, in groups. A group without a label is set apart by space only. */
export const NAV_GROUPS = [
  { label: null, items: ['home', 'agent'] },
  { label: 'Learn', items: ['doubts', 'plans', 'todos', 'videos'] },
  { label: 'Grow', items: ['career', 'forum'] },
  { label: null, items: ['profile', 'settings'] },
];

/** The browser tab title for a page (and optionally a tool or item inside it). */
export const documentTitle = (...parts) => [...parts.filter(Boolean), 'NOVARD-AI'].join(' · ');
