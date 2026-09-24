/**
 * Deep links such as /roadmap?open=<id>, used by the Novard Agent's
 * "Open roadmap" / "Open doubt" buttons to land on the item it created.
 *
 * Read the id once (e.g. in a useState initialiser, so React's StrictMode
 * double effects see the same value), select the item, then clear the
 * parameter so a refresh or a later selection is not overridden.
 */
export const readOpenParam = () => new URLSearchParams(window.location.search).get('open');

export function clearOpenParam() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('open')) return;
  params.delete('open');
  const query = params.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
}
