import React from 'react';
import cx from './cx';

/**
 * The top of a page: its one name (the same as in the sidebar and the
 * breadcrumb), one line on what it is for, and the page's actions.
 */
export function PageHeader({ title, description, actions, eyebrow, className, children }) {
  return (
    <header className={cx('mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-small text-fg-subtle">{eyebrow}</div>}
        <h1 className="text-display font-semibold text-fg">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-body text-fg-muted">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** The heading of a section inside a page. */
export function SectionHeader({ title, description, actions, as: Tag = 'h2', className }) {
  return (
    <div className={cx('mb-3 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <Tag className="text-lead font-semibold text-fg">{title}</Tag>
        {description && <p className="mt-0.5 text-small text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * A raised surface for content that needs a container (a chart, a form).
 * Use sparingly: sections on the page canvas usually need only a header.
 */
export function Card({ title, description, actions, padded = true, className, bodyClassName, children, as: Tag = 'section' }) {
  return (
    <Tag className={cx('rounded-xl bg-raised ring-1 ring-line-subtle', className)}>
      {(title || actions) && (
        <div className={cx('flex items-start justify-between gap-4', padded ? 'px-5 pt-4' : 'px-5 py-4')}>
          <div className="min-w-0">
            {title && <h3 className="text-body font-semibold text-fg">{title}</h3>}
            {description && <p className="mt-0.5 text-small text-fg-subtle">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cx(padded && 'p-5', padded && (title || actions) && 'pt-3', bodyClassName)}>{children}</div>
    </Tag>
  );
}
