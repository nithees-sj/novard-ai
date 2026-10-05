/**
 * Mastery levels (from quiz accuracy) as one set of semantic tones, so every
 * chart and list colours them the same way.
 */
export const LEVEL_TONE = {
  Expert: 'success',
  Advanced: 'accent',
  Intermediate: 'warning',
  Beginner: 'danger',
  'Not enough data': 'neutral',
};

export const toneForLevel = (level) => LEVEL_TONE[level] || 'neutral';

/** A bar fill for a tone (meters, progress). */
export const BAR = {
  success: 'bg-success',
  accent: 'bg-accent',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-fg-disabled',
};
