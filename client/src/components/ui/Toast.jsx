import React from 'react';
import { createPortal } from 'react-dom';
import cx from './cx';
import Icon from './Icon';

const TONES = {
  success: { icon: 'success', color: 'text-success-fg' },
  error: { icon: 'alert', color: 'text-danger-fg' },
  info: { icon: 'info', color: 'text-accent-fg' },
};

/**
 * A short confirmation or error, top-right under the header (bottom on
 * phones, above the agent launcher's row). Purely visual: callers own the
 * timer and pass onClose.
 */
export default function Toast({ message, type = 'info', onClose }) {
  if (!message) return null;
  const t = TONES[type] || TONES.info;
  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex justify-center sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-[4.5rem]"
    >
      <div
        role={type === 'error' ? 'alert' : 'status'}
        aria-live={type === 'error' ? 'assertive' : 'polite'}
        className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg bg-overlay px-4 py-3 shadow-popover ring-1 ring-line-subtle animate-slide-down"
      >
        <Icon name={t.icon} className={cx('mt-0.5 h-4 w-4', t.color)} />
        <p className="min-w-0 flex-1 text-body text-fg">{message}</p>
        {onClose && (
          <button type="button" onClick={onClose} className="-mr-1 rounded p-0.5 text-fg-subtle transition-colors hover:bg-sunken hover:text-fg" aria-label="Dismiss">
            <Icon name="x" className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
