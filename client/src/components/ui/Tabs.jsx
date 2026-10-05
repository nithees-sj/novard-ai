import React, { useRef } from 'react';
import cx from './cx';
import Icon from './Icon';
import Spinner from './Spinner';

/** Arrow keys, Home and End move between tabs (and select them), as the ARIA tabs pattern expects. */
function useRoving(items, active, onChange) {
  const refs = useRef([]);
  const onKeyDown = (e) => {
    const i = items.findIndex((t) => t.id === active);
    const go = (n) => {
      e.preventDefault();
      const next = (n + items.length) % items.length;
      refs.current[next]?.focus();
      onChange(items[next].id);
    };
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(items.length - 1);
  };
  return { refs, onKeyDown };
}

/**
 * Tabs as an underlined row: for switching views inside a page or panel.
 * tabs: [{ id, label, icon, busy, count }]
 */
export function Tabs({ tabs, active, onChange, label, size = 'md', className }) {
  const { refs, onKeyDown } = useRoving(tabs, active, onChange);
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={cx('-mb-px flex max-w-full gap-1 overflow-x-auto scrollbar-hide', className)}>
      {tabs.map((t, i) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cx(
              'relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t px-2.5 font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
              size === 'sm' ? 'h-9 text-small' : 'h-10 text-body',
              on ? 'text-fg' : 'text-fg-subtle hover:text-fg',
            )}
          >
            {t.busy ? <Spinner className="h-3.5 w-3.5 text-accent-fg" /> : t.icon && <Icon name={t.icon} className={cx('h-4 w-4', on && 'text-accent-fg')} />}
            {t.label}
            {t.count != null && <span className="tabular text-caption text-fg-subtle">{t.count}</span>}
            <span className={cx('absolute inset-x-1.5 bottom-0 h-0.5 rounded-full transition-colors duration-150', on ? 'bg-accent' : 'bg-transparent')} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

/**
 * A segmented control: two to four mutually exclusive options shown as one
 * pill (theme, list filter). options: [{ id, label, icon }]
 */
export function SegmentedControl({ options, value, onChange, label, size = 'md', className, iconOnly = false }) {
  const { refs, onKeyDown } = useRoving(options, value, onChange);
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className={cx('inline-flex max-w-full rounded-lg bg-sunken p-0.5 ring-1 ring-inset ring-line-subtle', className)}>
      {options.map((o, i) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={iconOnly ? o.label : undefined}
            title={iconOnly ? o.label : undefined}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.id)}
            className={cx(
              'inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus',
              size === 'sm' ? 'h-7 px-2.5 text-small' : 'h-8 px-3 text-body',
              on ? 'bg-raised text-fg shadow-raised ring-1 ring-line-subtle' : 'text-fg-muted hover:text-fg',
            )}
          >
            {o.icon && <Icon name={o.icon} className="h-4 w-4" />}
            {!iconOnly && o.label}
          </button>
        );
      })}
    </div>
  );
}
