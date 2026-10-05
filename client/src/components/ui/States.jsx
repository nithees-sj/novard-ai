import React from 'react';
import cx from './cx';
import Icon from './Icon';

/**
 * Empty, loading and error states. No icon tiles: a quiet line icon, a
 * title, one sentence and the action that fixes it.
 */
export function EmptyState({ icon, title, text, action, compact = false, className }) {
  return (
    <div className={cx('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'min-h-[16rem] px-6 py-12', className)}>
      {icon && <Icon name={icon} className={cx('mb-3 text-fg-subtle', compact ? 'h-5 w-5' : 'h-6 w-6')} strokeWidth={1.5} />}
      <h3 className={cx('font-semibold text-fg', compact ? 'text-body' : 'text-lead')}>{title}</h3>
      {text && <p className={cx('mt-1 max-w-sm text-fg-muted', compact ? 'text-small' : 'text-body')}>{text}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/** Something failed to load: what happened and a way to retry. */
export function ErrorState({ title = 'This didn’t load', text, onRetry, retryLabel = 'Try again', className }) {
  return (
    <div className={cx('flex flex-col items-center justify-center px-6 py-12 text-center', className)} role="alert">
      <Icon name="alert" className="mb-3 h-6 w-6 text-danger-fg" strokeWidth={1.5} />
      <h3 className="text-lead font-semibold text-fg">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-body text-fg-muted">{text}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-5 inline-flex h-9 items-center gap-2 rounded bg-raised px-3.5 text-body font-medium text-fg ring-1 ring-inset ring-line transition-colors hover:bg-sunken">
          <Icon name="refresh" /> {retryLabel}
        </button>
      )}
    </div>
  );
}

/** A grey placeholder block in the shape of the content to come. */
export function Skeleton({ className = 'h-4 w-full', rounded = 'rounded' }) {
  return <span className={cx('block animate-pulse bg-sunken', rounded, className)} aria-hidden="true" />;
}

/** Placeholder text lines. */
export function SkeletonText({ lines = 3, className }) {
  const widths = ['w-full', 'w-11/12', 'w-4/5', 'w-2/3', 'w-3/4'];
  return (
    <div className={cx('space-y-2.5', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} className={cx('h-3', widths[i % widths.length])} />)}
    </div>
  );
}

/** Placeholder list rows (title + meta line), divided like ListRow. */
export function SkeletonRows({ rows = 4, className, label = 'Loading' }) {
  return (
    <div className={cx('divide-y divide-line-subtle', className)} role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-2 px-3 py-3">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/** A centred loading line for an area whose final layout is unknown. */
export function LoadingBlock({ label = 'Loading…', className }) {
  return (
    <div className={cx('flex items-center justify-center gap-2.5 py-16 text-body text-fg-subtle', className)} role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
      {label}
    </div>
  );
}
