import React from 'react';
import cx from './cx';

/**
 * One row in a list: a title, an optional line under it, meta on the right.
 * Rows are divided by hairlines (wrap them in a `divide-y divide-line-subtle`
 * list); the selected row gets a soft accent tint, not an edge bar.
 *
 * Pass `onSelect` for a clickable row (rendered as a button-like element
 * that keeps nested buttons, such as delete, working) or `href`/`as` for a link.
 */
export default function ListRow({ title, subtitle, leading, meta, trailing, active = false, onSelect, className, children, titleClassName, as: Tag, ...rest }) {
  const interactive = !!onSelect;
  const Comp = Tag || 'div';
  return (
    <Comp
      role={interactive && !Tag ? 'button' : undefined}
      tabIndex={interactive && !Tag ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={interactive && !Tag ? (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(e); } } : undefined}
      aria-current={active ? 'true' : undefined}
      className={cx(
        'group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150',
        (interactive || Tag) && 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
        active ? 'bg-accent-soft' : (interactive || Tag) && 'hover:bg-sunken',
        className,
      )}
      {...rest}
    >
      {leading && <div className="mt-0.5 shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className={cx('line-clamp-2 text-body font-medium', active ? 'text-accent-fg' : 'text-fg', titleClassName)}>{title}</div>
        {subtitle && <div className="mt-0.5 line-clamp-2 text-small text-fg-muted">{subtitle}</div>}
        {children}
      </div>
      {meta && <div className="shrink-0 text-caption text-fg-subtle">{meta}</div>}
      {trailing}
    </Comp>
  );
}
