import React, { useState, useEffect, useRef, useCallback } from 'react';

const Notification = ({ message, type = 'info', duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  // Parents pass a fresh arrow function on every render. Holding it in a ref
  // keeps it out of the effect deps, so the dismiss timer is not restarted
  // each time the parent re-renders (which could leave the toast up forever).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // A new message reuses the same mounted component, so reset visibility.
  useEffect(() => {
    setIsVisible(true);
  }, [message, type]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onCloseRef.current) onCloseRef.current();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, message, type]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    if (onCloseRef.current) onCloseRef.current();
  }, []);

  if (!isVisible) return null;

  // Solid tones that keep white text readable (AA) in both themes.
  const tone = { success: 'bg-green-700', error: 'bg-red-600' }[type] || 'bg-blue-600';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed right-5 top-5 z-[1000] flex min-w-[300px] max-w-[500px] items-center gap-3 rounded-lg px-6 py-4 text-white shadow-lg ${tone}`}
    >
      <div className="flex-1 text-sm leading-snug">{message}</div>
      <button
        type="button"
        onClick={handleClose}
        aria-label="Dismiss notification"
        className="rounded p-1 text-xl leading-none text-white/80 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        ×
      </button>
    </div>
  );
};

export default Notification;
