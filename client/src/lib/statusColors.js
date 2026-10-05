/**
 * Colours passed as values (SVG fills and strokes, inline styles) rather than
 * Tailwind classes. Neutrals and the brand blue are CSS variables, so they
 * follow the light/dark theme (src/theme/palette.js); the series colours are
 * mid-ramp hues that read on both themes. Apply variables through `style`
 * (style={{ stroke: chart.brand }}): they are not reliable in SVG
 * presentation attributes.
 */
const css = (name) => `rgb(var(--${name}))`;

export const chart = {
  brand: css('chart-brand'),
  grid: css('chart-grid'),
  track: css('chart-track'),
  axis: css('chart-axis'),
  line: css('chart-line'),
  surface: css('surface'),
  muted: css('gray-400'),
};

/** Risk levels (admin console). */
export const LEVEL_COLORS = {
  LOW: css('level-low'),
  MEDIUM: css('level-medium'),
  HIGH: css('level-high'),
  CRITICAL: css('level-critical'),
};

/** Study-time mix on the profile, by activity kind. */
export const ACTIVITY_COLORS = {
  quiz: '#3b82f6',
  question: '#38bdf8',
  planDay: '#22c55e',
  materialAdded: '#a855f7',
  forumPost: '#f59e0b',
  forumComment: '#fbbf24',
};

/** Readiness (0-100) as a colour: on track, getting there, early, far off. */
export const readinessColor = (r) => (r >= 75 ? '#22c55e' : r >= 50 ? '#3b82f6' : r >= 25 ? '#f59e0b' : '#ef4444');
