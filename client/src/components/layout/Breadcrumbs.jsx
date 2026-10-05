import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../ui/Icon';
import cx from '../ui/cx';

/**
 * Where you are: crumbs [{ label, to?, onClick? }], the last one is the
 * current page. On phones only the current page shows, with a back arrow to
 * its parent.
 */
export default function Breadcrumbs({ crumbs = [], className }) {
  if (crumbs.length === 0) return null;
  const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2] : null;
  const current = crumbs[crumbs.length - 1];

  const crumbLink = (c, cls) => (c.to
    ? <Link to={c.to} onClick={c.onClick} className={cls}>{c.label}</Link>
    : c.onClick ? <button type="button" onClick={c.onClick} className={cls}>{c.label}</button> : <span className={cls}>{c.label}</span>);

  const linkClass = 'rounded px-1 py-0.5 text-fg-subtle transition-colors hover:bg-sunken hover:text-fg';

  return (
    <nav aria-label="Breadcrumb" className={cx('min-w-0', className)}>
      {/* phones: back to the parent, then the current page */}
      <div className="flex min-w-0 items-center gap-1 sm:hidden">
        {parent && (parent.to || parent.onClick) && (
          parent.to
            ? <Link to={parent.to} onClick={parent.onClick} className="-ml-1 rounded p-1 text-fg-subtle hover:bg-sunken hover:text-fg" aria-label={`Back to ${parent.label}`}><Icon name="chevronLeft" className="h-4 w-4" /></Link>
            : <button type="button" onClick={parent.onClick} className="-ml-1 rounded p-1 text-fg-subtle hover:bg-sunken hover:text-fg" aria-label={`Back to ${parent.label}`}><Icon name="chevronLeft" className="h-4 w-4" /></button>
        )}
        <span className="truncate text-body font-medium text-fg" aria-current="page">{current.label}</span>
      </div>
      {/* wider screens: the whole trail */}
      <ol className="hidden min-w-0 items-center gap-0.5 text-body sm:flex">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${c.label}-${i}`} className={cx('flex min-w-0 items-center gap-0.5', last ? 'shrink' : 'shrink-0')}>
              {i > 0 && <Icon name="chevronRight" className="h-3.5 w-3.5 text-fg-disabled" />}
              {last
                ? <span className="truncate px-1 font-medium text-fg" aria-current="page">{c.label}</span>
                : crumbLink(c, linkClass)}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
