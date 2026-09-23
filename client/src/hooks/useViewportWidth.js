import { useEffect, useState } from 'react';

/**
 * Tracks the viewport width so components that compute inline styles from
 * window.innerWidth re-render when the window is resized. Reading innerWidth
 * during render alone produces styles that are correct only on first paint.
 */
export default function useViewportWidth() {
  const [width, setWidth] = useState(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth
  );

  useEffect(() => {
    let frame = null;
    const handleResize = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        setWidth(window.innerWidth);
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return width;
}
