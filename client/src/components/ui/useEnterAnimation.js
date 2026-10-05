import { useLayoutEffect, useRef } from 'react';

const KEYFRAMES = [
  { opacity: 0, transform: 'translateY(6px)' },
  { opacity: 1, transform: 'translateY(0)' },
];
const TIMING = { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' };

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Eases `ref`'s element in (fade + 6px rise, 220ms) whenever `key` changes:
 * a new page, tool, tab or item. Uses the Web Animations API, so nothing
 * remounts and no state is lost; the transform is gone when it finishes.
 * Skipped for people who prefer reduced motion.
 */
export default function useEnterAnimation(ref, key) {
  const first = useRef(true);
  useLayoutEffect(() => {
    const el = ref.current;
    const isFirst = first.current;
    first.current = false;
    if (!el || reducedMotion() || typeof el.animate !== 'function') return undefined;
    // The first render of a page animates too (it is a navigation), but softer.
    const anim = el.animate(KEYFRAMES, isFirst ? { ...TIMING, duration: 260 } : TIMING);
    return () => anim.cancel();
  }, [ref, key]);
}
