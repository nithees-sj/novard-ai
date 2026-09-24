/**
 * Deep links into the hub pages, used by the Novard Agent's "Open …" buttons
 * and the profile page:
 *
 *   /career?tool=roadmap&open=<id>      /doubts?tool=doubts&open=<id>
 *   /video?tool=summarizer&open=<id>    /skill-unlocker?open=<id>
 *
 * The hub reads `tool` to show the right section; that section reads `open`
 * to select the item. Read a value once (e.g. in a useState initialiser, so
 * React's StrictMode double effects see the same value), then clear it so a
 * later refresh or selection is not overridden.
 */
export const readParam = (name) => new URLSearchParams(window.location.search).get(name);

export function clearParam(name) {
  const params = new URLSearchParams(window.location.search);
  if (!params.has(name)) return;
  params.delete(name);
  const query = params.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
}

export const readOpenParam = () => readParam('open');
export const clearOpenParam = () => clearParam('open');
