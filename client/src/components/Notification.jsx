import React, { useState, useEffect, useRef, useCallback } from 'react';
import Toast from './ui/Toast';

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
  return <Toast message={message} type={type} onClose={handleClose} />;
};

export default Notification;
