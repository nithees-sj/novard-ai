import { useLayoutEffect, useRef } from 'react';

const KEYFRAMES = [
  { opacity: 0, transform: 'translateY(10px)' },
  { opacity: 1, transform: 'translateY(0)' },
];
// A long, soft ease-out: quick to start moving, slow to settle.
const TIMING = { duration: 450, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Eases `ref`'s element in (fade + 10px rise, 450ms) whenever `key` changes:
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
    const anim = el.animate(KEYFRAMES, isFirst ? { ...TIMING, duration: 520 } : TIMING);
    return () => anim.cancel();
  }, [ref, key]);
}
