import React from 'react';
import cx from './cx';

/**
 * A small label for status or category. Soft fill, no border. The old tone
 * names (gray, blue, green, amber, red) map onto the semantic tones.
 */
const TONES = {
  neutral: 'bg-sunken text-fg-muted ring-1 ring-inset ring-line-subtle',
  accent: 'bg-accent-soft text-accent-fg',
  success: 'bg-success-soft text-success-fg',
  warning: 'bg-warning-soft text-warning-fg',
  danger: 'bg-danger-soft text-danger-fg',
  info: 'bg-info-soft text-info-fg',
};
const ALIASES = { gray: 'neutral', blue: 'accent', green: 'success', amber: 'warning', red: 'danger' };
export const toneOf = (tone) => ALIASES[tone] || tone || 'neutral';

const DOTS = { neutral: 'bg-fg-subtle', accent: 'bg-accent', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', info: 'bg-info' };

export default function Badge({ tone = 'neutral', dot = false, className, children }) {
  const t = toneOf(tone);
  return (
    <span className={cx('inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm px-1.5 text-caption font-medium', TONES[t], className)}>
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full', DOTS[t])} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** A status as a coloured dot and text, for lists and tables where a filled badge is too loud. */
export function Status({ tone = 'neutral', children, className }) {
  const t = toneOf(tone);
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-small text-fg-muted', className)}>
      <span className={cx('h-2 w-2 shrink-0 rounded-full', DOTS[t])} aria-hidden="true" />
      {children}
    </span>
  );
}
