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

  const styles = {
    container: {
      position: 'fixed',
      top: '20px',
      right: '20px',
      backgroundColor: type === 'success' ? '#48bb78' : type === 'error' ? '#e53e3e' : '#3182ce',
      color: 'white',
      padding: '1rem 1.5rem',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      minWidth: '300px',
      maxWidth: '500px',
    },
    message: {
      flex: 1,
      fontSize: '0.875rem',
      lineHeight: '1.4',
    },
    closeButton: {
      background: 'none',
      border: 'none',
      color: 'white',
      cursor: 'pointer',
      fontSize: '1.25rem',
      padding: '0.25rem',
      opacity: 0.8,
    },
  };

  return (
    <div style={styles.container} role="status" aria-live="polite">
      <div style={styles.message}>{message}</div>
      <button style={styles.closeButton} onClick={handleClose} aria-label="Dismiss notification">
        ×
      </button>
    </div>
  );
};

export default Notification;
