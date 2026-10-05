import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Modal from './Modal';
import Button from './Button';

function ConfirmDialog({ title, message, confirmLabel, cancelLabel, danger, onDone }) {
  const [open, setOpen] = useState(true);
  const finish = (answer) => { setOpen(false); onDone(answer); };
  return (
    <Modal
      open={open}
      onClose={() => finish(false)}
      title={title}
      size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={() => finish(false)}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger-solid' : 'primary'} onClick={() => finish(true)} data-autofocus>{confirmLabel}</Button>
        </>
      )}
    >
      {message && <p className="text-body text-fg-muted">{message}</p>}
    </Modal>
  );
}

/**
 * A designed replacement for window.confirm: resolves true or false.
 *   if (!(await confirm({ title: 'Delete this note?', danger: true }))) return;
 */
export default function confirm({ title = 'Are you sure?', message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const onDone = (answer) => {
      resolve(answer);
      // Let the dialog unmount (and return focus) before removing its host.
      setTimeout(() => { root.unmount(); host.remove(); }, 0);
    };
    root.render(<ConfirmDialog {...{ title, message, confirmLabel, cancelLabel, danger, onDone }} />);
  });
}
