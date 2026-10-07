import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Types a streamed reply out at a steady, readable pace instead of in the
 * bursts the network delivers. The pace adapts to the backlog: it never falls
 * more than about CATCH_UP_SECONDS behind, and slows to a calm writing speed
 * as it catches up.
 *
 * While typing, the visible text is kept valid Markdown (see visibleMarkdown),
 * so half-written **bold** or `code` never shows its raw markers, and a
 * diagram appears whole rather than redrawing as it is written.
 */

const MIN_CPS = 90;
const MAX_CPS = 420;
const CATCH_UP_SECONDS = 1.5;
const PAINT_MS = 32; // ~30 renders a second is smooth and keeps Markdown parsing cheap

const prefersReducedMotion = () => typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The code fence still open at the end of `text`, or null. */
function openFence(text) {
  let open = null;
  const re = /^ {0,3}(`{3,}|~{3,})(.*)$/gm;
  let m = re.exec(text);
  while (m) {
    if (!open) open = { index: m.index, marker: m[1], lang: m[2].trim().split(/\s/)[0].toLowerCase() };
    else if (m[1].startsWith(open.marker) && !m[2].trim()) open = null;
    m = re.exec(text);
  }
  return open;
}

/** Where the fence opened at `fence` closes in `text` (just past it), or -1. */
function fenceEnd(text, fence) {
  const re = /^ {0,3}(`{3,}|~{3,})[ \t]*$/gm;
  re.lastIndex = text.indexOf('\n', fence.index) + 1 || text.length;
  let m = re.exec(text);
  while (m) {
    if (m[1].startsWith(fence.marker)) return m.index + m[0].length;
    m = re.exec(text);
  }
  return -1;
}

/**
 * The first part of a reply, shaped to render cleanly while it is typed:
 * trailing Markdown markers are held back, an open `code` span or **bold**
 * run is closed, and an unfinished diagram is left out until it is complete.
 */
export function visibleMarkdown(text) {
  let out = text.replace(/[*_`~]+$/, '');
  const fence = openFence(out);
  if (fence) return fence.lang === 'mermaid' ? out.slice(0, fence.index).trimEnd() : out;
  const para = out.slice(out.lastIndexOf('\n\n') + 1);
  if ((para.match(/`/g) || []).length % 2) return `${out}\``;
  const plain = para.replace(/`[^`]*`/g, '');
  if ((plain.match(/\*\*/g) || []).length % 2) out += '**';
  return out;
}

/**
 * @param {string} text    the reply so far (it grows while streaming)
 * @param {boolean} active animate it; when false the whole text shows at once
 * @returns {{shown: string, typing: boolean}}
 */
export default function useTypewriter(text, active) {
  const target = text || '';
  const animate = active && !prefersReducedMotion();
  const pos = useRef(animate ? 0 : target.length);
  const [count, setCount] = useState(pos.current);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    if (!animate) {
      pos.current = target.length;
      setCount(target.length);
      return undefined;
    }
    if (pos.current >= target.length) {
      pos.current = target.length; // the final reply can be a little shorter than the stream (trimmed)
      setCount(target.length);
      return undefined;
    }
    let frame;
    let last = performance.now();
    let painted = 0;
    const tick = (now) => {
      const goal = targetRef.current;
      const dt = Math.min(now - last, 100) / 1000;
      last = now;
      const backlog = goal.length - pos.current;
      const cps = Math.min(MAX_CPS, Math.max(MIN_CPS, backlog / CATCH_UP_SECONDS));
      pos.current = Math.min(goal.length, pos.current + cps * dt);
      // A diagram is shown whole: skip straight past it once it is complete.
      const fence = openFence(goal.slice(0, Math.floor(pos.current)));
      if (fence?.lang === 'mermaid') {
        const end = fenceEnd(goal, fence);
        if (end !== -1) pos.current = Math.max(pos.current, end);
      }
      const done = pos.current >= goal.length;
      if (done || now - painted >= PAINT_MS) {
        painted = now;
        setCount(Math.floor(pos.current));
      }
      if (!done) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, target.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = Math.min(count, target.length);
  const typing = animate && shown < target.length;
  const visible = useMemo(() => (typing ? visibleMarkdown(target.slice(0, shown)) : target), [typing, target, shown]);
  return { shown: visible, typing };
}
