import React from 'react';
import cx from './cx';

/**
 * Numbers in a row, separated by hairlines rather than boxed one by one.
 * Captions wrap to two lines instead of being cut off.
 */
export function StatStrip({ children, className }) {
  return (
    <div className={cx('grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line-subtle ring-1 ring-line-subtle sm:grid-cols-3 lg:grid-cols-6', className)}>
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, tone, className }) {
  return (
    <div className={cx('min-w-0 bg-raised px-4 py-3.5', className)}>
      <p className="text-small text-fg-muted">{label}</p>
      <p className={cx('num mt-1 text-title font-medium', tone === 'danger' ? 'text-danger-fg' : tone === 'success' ? 'text-success-fg' : tone === 'warning' ? 'text-warning-fg' : 'text-fg')}>{value}</p>
      {sub && <p className="mt-0.5 line-clamp-2 text-caption text-fg-subtle">{sub}</p>}
    </div>
  );
}
