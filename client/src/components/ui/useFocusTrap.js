import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * While `active`: keep Tab inside `ref`, close on Escape, lock the page
 * scroll, and give focus back to whatever had it when the trap opened.
 * Focus moves to the element marked [data-autofocus], else the first field.
 */
export default function useFocusTrap(ref, active, onEscape) {
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return undefined;
    const node = ref.current;
    const previous = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const items = () => Array.from(node?.querySelectorAll(FOCUSABLE) || []).filter((el) => el.offsetParent !== null || el === document.activeElement);
    const first = node?.querySelector('[data-autofocus]') || items()[0] || node;
    // After paint, so a field that mounts with the dialog can take focus.
    const raf = requestAnimationFrame(() => first?.focus?.());

    const onKey = (e) => {
      if (e.key === 'Escape' && escapeRef.current) {
        e.stopPropagation();
        escapeRef.current(e);
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const list = items();
      if (list.length === 0) { e.preventDefault(); return; }
      const [head, tail] = [list[0], list[list.length - 1]];
      if (e.shiftKey && (document.activeElement === head || !node.contains(document.activeElement))) { e.preventDefault(); tail.focus(); }
      else if (!e.shiftKey && document.activeElement === tail) { e.preventDefault(); head.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus();
    };
  }, [active, ref]);
}
