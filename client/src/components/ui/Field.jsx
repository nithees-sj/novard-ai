import React, { forwardRef } from 'react';
import cx from './cx';
import Icon from './Icon';

/** Text fields: one height, one border, one focus style. */
export const inputClass = 'block w-full rounded border-0 bg-raised px-3 py-2 text-body text-fg ring-1 ring-inset ring-line placeholder:text-fg-subtle transition-shadow duration-150 hover:ring-line-strong focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:bg-sunken disabled:text-fg-disabled';

export const fieldClass = (bad) => cx(inputClass, bad && 'ring-danger hover:ring-danger focus:ring-danger');

export const Input = forwardRef(function Input({ invalid, className, ...rest }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cx(fieldClass(invalid), 'h-9', className)} {...rest} />;
});

export const Textarea = forwardRef(function Textarea({ invalid, className, rows = 4, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} aria-invalid={invalid || undefined} className={cx(fieldClass(invalid), 'min-h-[5rem] resize-y leading-relaxed', className)} {...rest} />;
});

/**
 * A native <select>, styled: it keeps the platform's keyboard handling,
 * type-ahead, screen-reader support and mobile pickers.
 */
export const Select = forwardRef(function Select({ invalid, className, size = 'md', children, ...rest }, ref) {
  return (
    // className sizes the control (default: full width).
    <div className={cx('relative', className || 'w-full')}>
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cx(fieldClass(invalid), 'cursor-pointer appearance-none pr-9', size === 'sm' ? 'h-8 py-1 text-small' : 'h-9')}
        {...rest}
      >
        {children}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
    </div>
  );
});

/** A labelled form field with an optional hint, error and character counter. */
export function Field({ id, label, optional = false, required = false, hint, error, count, max, children, className }) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-small font-medium text-fg">
          {label}
          {required && <span className="text-danger-fg" aria-hidden="true"> *</span>}
          {optional && <span className="font-normal text-fg-subtle"> (optional)</span>}
        </label>
        {max && (
          <span className={cx('tabular text-caption', count > max ? 'font-medium text-danger-fg' : count > max * 0.9 ? 'text-warning-fg' : 'text-fg-subtle')}>{count}/{max}</span>
        )}
      </div>
      {children}
      {error ? <p className="mt-1.5 text-caption text-danger-fg">{error}</p> : hint ? <p className="mt-1.5 text-caption text-fg-subtle">{hint}</p> : null}
    </div>
  );
}
