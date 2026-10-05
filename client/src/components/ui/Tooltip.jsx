import React, { useId, useState } from 'react';
import cx from './cx';

/**
 * A short text label shown on hover and keyboard focus of its child.
 * For icon-only buttons the label is also the button's aria-label, so the
 * tooltip is presentation only.
 */
export default function Tooltip({ label, side = 'top', children, className }) {
  const [shown, setShown] = useState(false);
  const id = useId();
  const pos = {
    top: 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
    bottom: 'top-full left-1/2 mt-1.5 -translate-x-1/2',
    left: 'right-full top-1/2 mr-1.5 -translate-y-1/2',
    right: 'left-full top-1/2 ml-1.5 -translate-y-1/2',
  }[side];
  return (
    <span
      className={cx('relative inline-flex', className)}
      onMouseEnter={() => setShown(true)}
      onMouseLeave={() => setShown(false)}
      onFocus={() => setShown(true)}
      onBlur={() => setShown(false)}
    >
      {children}
      {shown && (
        <span id={id} role="tooltip" className={cx('pointer-events-none absolute z-[90] whitespace-nowrap rounded bg-tooltip px-2 py-1 text-caption font-medium text-tooltip-fg shadow-popover animate-fade-in', pos)}>
          {label}
        </span>
      )}
    </span>
  );
}
