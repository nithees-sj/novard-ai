/**
 * Colours passed as values (SVG fills and strokes, inline styles) rather than
 * Tailwind classes. Every value is a CSS variable, so it follows the
 * light/dark theme (src/theme/palette.js). Series use the categorical
 * chart-1…6 tokens; status uses the semantic tones. Apply them through `style`
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
  surface: css('raised'),
  muted: css('chart-6'),
  series: [1, 2, 3, 4, 5, 6].map((n) => css(`chart-${n}`)),
};

/** The semantic status tones as values. */
export const tone = {
  accent: css('accent'),
  success: css('success'),
  warning: css('warning'),
  danger: css('danger'),
  info: css('info'),
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
  quiz: css('chart-1'),
  question: css('chart-2'),
  planDay: css('chart-3'),
  materialAdded: css('chart-4'),
  forumPost: css('chart-5'),
  forumComment: css('chart-6'),
};

/** Readiness (0-100) as a colour: on track, getting there, early, far off. */
export const readinessColor = (r) => (r >= 75 ? tone.success : r >= 50 ? tone.accent : r >= 25 ? tone.warning : tone.danger);
