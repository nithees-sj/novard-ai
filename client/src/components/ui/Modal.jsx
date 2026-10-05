import React, { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import cx from './cx';
import { IconButton } from './Button';
import useFocusTrap from './useFocusTrap';

const WIDTHS = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-3xl' };

/**
 * A dialog over the page: rendered in a portal, focus kept inside, Escape
 * and a click on the backdrop close it (unless `dismissible` is false, e.g.
 * while saving), and focus returns to the trigger afterwards.
 */
export default function Modal({ open, onClose, title, description, children, footer, size = 'md', dismissible = true, labelledBy, className, bodyClassName }) {
  const ref = useRef(null);
  const autoId = useId();
  const titleId = labelledBy || `${autoId}-title`;
  const close = dismissible ? onClose : undefined;
  useFocusTrap(ref, open, close);
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-6 dark:bg-black/60"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close?.(); }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title || labelledBy ? titleId : undefined}
        tabIndex={-1}
        className={cx('flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl bg-overlay shadow-modal ring-1 ring-line-subtle animate-slide-up focus:outline-none sm:rounded-xl', WIDTHS[size], className)}
      >
        {title && (
          <div className="flex items-start justify-between gap-4 px-5 pb-1 pt-5">
            <div className="min-w-0">
              <h2 id={titleId} className="text-title font-semibold text-fg">{title}</h2>
              {description && <p className="mt-1 text-body text-fg-muted">{description}</p>}
            </div>
            {close && <IconButton icon="x" label="Close" size="sm" onClick={close} className="-mr-1.5 -mt-1" />}
          </div>
        )}
        <div className={cx('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-subtle bg-raised/50 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
