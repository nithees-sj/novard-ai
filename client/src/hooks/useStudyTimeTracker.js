import { useEffect } from 'react';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;

const TICK_MS = 15 * 1000;      // how often active time is added up
const FLUSH_MS = 60 * 1000;     // how often it is sent to the server
const IDLE_MS = 5 * 60 * 1000;  // no input for this long = stepped away

/** Event other components listen for to refresh time-based numbers. */
export const USAGE_EVENT = 'novard:usage-recorded';

const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const videoPlaying = () =>
  Array.from(document.querySelectorAll('video')).some((v) => !v.paused && !v.ended);

/**
 * Records the time a student actually spends in the app, for the dashboard's
 * study-time chart and the profile page.
 *
 * Time counts only while the tab is visible and focused, and the student has
 * used the mouse, keyboard or touch in the last five minutes, or is watching
 * a video (a playing <video>, or a focused embedded player). An open tab left
 * in the background, or a walk away from the desk, does not count, and two
 * tabs cannot both count because only one can have focus.
 *
 * Seconds are sent about once a minute, and with sendBeacon when the tab is
 * hidden or closed, so little is lost. text/plain keeps the beacon a simple
 * cross-origin request (no CORS preflight).
 */
export default function useStudyTimeTracker(userId) {
  useEffect(() => {
    if (!userId || !apiUrl) return undefined;

    let lastInput = Date.now();
    let lastTick = Date.now();
    let pending = 0;
    let pendingDay = localDay();

    const isActive = () => {
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return false;
      if (Date.now() - lastInput < IDLE_MS) return true;
      return videoPlaying() || document.activeElement?.tagName === 'IFRAME';
    };

    const send = (day, seconds, { beacon = false } = {}) => {
      const body = JSON.stringify({ userId, day, seconds });
      const url = `${apiUrl}/api/usage/heartbeat`;
      if (beacon && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }));
        return;
      }
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: true })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          window.dispatchEvent(new CustomEvent(USAGE_EVENT, { detail: { day, seconds } }));
        })
        .catch(() => {
          // Offline or server restarting: keep the time and try again on the next flush.
          if (day === pendingDay) pending += seconds;
        });
    };

    const flush = (opts) => {
      const seconds = Math.round(pending);
      if (seconds < 1) return;
      pending = 0;
      send(pendingDay, seconds, opts);
    };

    const tick = () => {
      const now = Date.now();
      // Cap the step so a sleeping laptop or a throttled background timer is never counted as study.
      const elapsed = Math.min(now - lastTick, TICK_MS * 2);
      lastTick = now;
      const today = localDay();
      if (today !== pendingDay) {
        flush();
        pendingDay = today;
      }
      if (isActive()) pending += elapsed / 1000;
    };

    const onInput = () => { lastInput = Date.now(); };
    const onHide = () => {
      tick();
      flush({ beacon: true });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide();
      else lastTick = Date.now(); // do not count the time the tab was hidden
    };

    const inputEvents = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'];
    inputEvents.forEach((e) => window.addEventListener(e, onInput, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('blur', tick);

    const tickTimer = setInterval(tick, TICK_MS);
    const flushTimer = setInterval(() => { tick(); flush(); }, FLUSH_MS);

    return () => {
      clearInterval(tickTimer);
      clearInterval(flushTimer);
      inputEvents.forEach((e) => window.removeEventListener(e, onInput, { capture: true }));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('blur', tick);
      tick();
      flush({ beacon: true }); // signing out or switching account
    };
  }, [userId]);
}
