import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../lib/api';
import { getToken } from '../lib/session';
import logger from '../lib/logger';

/**
 * Light / dark theme.
 *
 *   preference  what the user chose: 'light', 'dark' or 'system' (follow the device)
 *   resolved    what is showing: 'light' or 'dark'
 *
 * The choice is kept in this browser (THEME_KEY, read before the first paint by
 * the script in public/index.html) and on the account (PUT /api/auth/preferences),
 * so it follows the student to other devices. When signed in, the account
 * wins; an account that never chose takes this browser's choice (e.g. one made
 * on the landing page before signing in). The colours themselves switch in CSS
 * (src/theme/palette.js) when <html> has the `dark` class.
 */
export const THEMES = ['light', 'dark', 'system'];
export const THEME_KEY = 'novard_theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
// The browser chrome colour (mobile address bar), as the page background.
const CHROME_COLORS = { light: '#ffffff', dark: '#0b0f14' };

const readStored = () => {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return THEMES.includes(value) ? value : 'system';
  } catch {
    return 'system';
  }
};

const store = (preference) => {
  try {
    localStorage.setItem(THEME_KEY, preference);
  } catch {
    // Storage blocked: the choice lasts until the tab closes.
  }
};

const darkQuery = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(DARK_QUERY) : null);

function applyTheme(resolved) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', CHROME_COLORS[resolved]));
}

const DEFAULT = { preference: 'system', resolved: 'light', setPreference: () => {} };
const ThemeContext = createContext(DEFAULT);

export function ThemeProvider({ children }) {
  const { user, updateSession } = useAuth();
  const [preference, setPreferenceState] = useState(readStored);
  const [systemDark, setSystemDark] = useState(() => Boolean(darkQuery()?.matches));
  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  // Read by the account sync below without making it re-run on every change.
  const preferenceRef = useRef(preference);
  preferenceRef.current = preference;

  useEffect(() => applyTheme(resolved), [resolved]);

  // 'system' follows the device as it changes (e.g. an automatic evening switch).
  useEffect(() => {
    const query = darkQuery();
    if (!query?.addEventListener) return undefined;
    const onChange = (event) => setSystemDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  /** Save to the account. Without an app session (signed out, or an admin-only console session) it stays in this browser. */
  const saveToAccount = useCallback((theme) => {
    if (!getToken()) return;
    api.put('/api/auth/preferences', { theme })
      .then(({ data }) => { if (data?.user) updateSession({ user: data.user }); })
      .catch((error) => logger.warn('Could not save the theme to the account', error));
  }, [updateSession]);

  // Signed in: the account's theme wins; an account that never chose takes this browser's.
  // `theme` is undefined on a session restored from storage, until /api/auth/me answers.
  const email = user?.email;
  const accountTheme = user?.theme;
  useEffect(() => {
    if (!email) return;
    if (THEMES.includes(accountTheme)) {
      if (accountTheme !== preferenceRef.current) {
        setPreferenceState(accountTheme);
        store(accountTheme);
      }
    } else if (accountTheme === null) {
      saveToAccount(preferenceRef.current);
    }
  }, [email, accountTheme, saveToAccount]);

  const setPreference = useCallback((next) => {
    if (!THEMES.includes(next)) return;
    setPreferenceState(next);
    store(next);
    if (email) saveToAccount(next);
  }, [email, saveToAccount]);

  const value = useMemo(() => ({ preference, resolved, setPreference }), [preference, resolved, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** { preference, resolved, setPreference }. Outside a ThemeProvider it is a fixed light theme. */
export const useTheme = () => useContext(ThemeContext);
