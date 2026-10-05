import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import cx from './cx';
import Icon from './Icon';

/**
 * A button that opens a list of actions. Arrow keys, Home and End move
 * between items, Escape or a click outside closes it and focus returns to
 * the button.
 *
 *   <Menu label="Account" trigger={(props) => <button {...props}>…</button>}>
 *     {(close) => <><MenuItem onSelect={…}>Profile</MenuItem>…</>}
 *   </Menu>
 */
/** The menu's enabled items that are shown (some only appear at certain widths). */
const visibleItems = (node) => Array.from(node?.querySelectorAll('[role^="menuitem"]:not([disabled])') || []).filter((el) => el.getClientRects().length > 0);

export default function Menu({ trigger, children, align = 'end', width = 'w-56', className, label, panelClassName }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const button = useRef(null);
  const panel = useRef(null);
  const id = useId();

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!wrap.current?.contains(e.target)) close(false); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => visibleItems(panel.current)[0]?.focus());
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, close]);

  const onPanelKey = (e) => {
    const items = visibleItems(panel.current);
    const i = items.indexOf(document.activeElement);
    const go = (n) => { e.preventDefault(); items[(n + items.length) % items.length]?.focus(); };
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(items.length - 1);
    else if (e.key === 'Tab') close(false);
  };

  return (
    <div ref={wrap} className={cx('relative', className)}>
      {trigger({
        ref: button,
        onClick: () => setOpen((o) => !o),
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? id : undefined,
        'aria-label': label,
      })}
      {open && (
        <div
          ref={panel}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onPanelKey}
          className={cx('absolute top-full z-[70] mt-1.5 rounded-lg bg-overlay p-1 shadow-popover ring-1 ring-line-subtle animate-slide-down', align === 'end' ? 'right-0' : 'left-0', width, panelClassName)}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  );
}

/** One action in a Menu. */
export function MenuItem({ icon, children, onSelect, danger = false, href, as: Tag, checked, className, ...rest }) {
  const Comp = Tag || (href ? 'a' : 'button');
  const role = checked === undefined ? 'menuitem' : 'menuitemradio';
  return (
    <Comp
      role={role}
      aria-checked={checked === undefined ? undefined : checked}
      tabIndex={-1}
      href={href}
      type={Comp === 'button' ? 'button' : undefined}
      onClick={onSelect}
      className={cx(
        'flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-left text-body transition-colors duration-150 focus:outline-none',
        danger ? 'text-danger-fg hover:bg-danger-soft focus:bg-danger-soft' : 'text-fg hover:bg-sunken focus:bg-sunken',
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} className={cx('h-4 w-4', danger ? '' : 'text-fg-subtle')} />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {checked && <Icon name="check" className="h-4 w-4 text-accent-fg" />}
    </Comp>
  );
}

export const MenuSeparator = () => <div role="separator" className="-mx-1 my-1 h-px bg-line-subtle" />;

/** A non-interactive header block at the top of a menu (e.g. the signed-in account). */
export const MenuHeader = ({ children }) => <div className="px-2.5 pb-2 pt-1.5">{children}</div>;
