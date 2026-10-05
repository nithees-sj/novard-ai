import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../AuthContext';
import { ThemeProvider, THEME_KEY, useTheme } from '../ThemeContext';
import ThemeToggle from '../../components/ThemeToggle';
import { api } from '../../lib/api';
import { saveSession } from '../../lib/session';

jest.mock('@react-oauth/google', () => ({ useGoogleLogin: () => jest.fn() }));
jest.mock('../../lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
  errorMessage: (error, fallback) => error?.response?.data?.error || fallback,
}));

/** A device whose light/dark setting the test can flip. */
function mockDevice(dark) {
  const listeners = new Set();
  const query = {
    matches: dark,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  };
  window.matchMedia = () => query;
  return (nowDark) => {
    query.matches = nowDark;
    listeners.forEach((fn) => fn({ matches: nowDark }));
  };
}

function Probe() {
  const { preference, resolved } = useTheme();
  return <span data-testid="theme">{`${preference}/${resolved}`}</span>;
}

const renderTheme = () => render(
  <AuthProvider>
    <ThemeProvider>
      <Probe />
      <ThemeToggle />
    </ThemeProvider>
  </AuthProvider>
);

const isDark = () => document.documentElement.classList.contains('dark');
const signedIn = () => saveSession({ token: 'tok', user: { name: 'Alice', email: 'alice@example.com' } });

describe('ThemeProvider', () => {
  const originalMatchMedia = window.matchMedia;
  beforeEach(() => {
    document.documentElement.className = '';
    api.get.mockResolvedValue({ data: {} });
    api.put.mockResolvedValue({ data: {} });
  });
  afterEach(() => { window.matchMedia = originalMatchMedia; });

  it('follows the device by default, live', () => {
    const setDeviceDark = mockDevice(false);
    renderTheme();
    expect(screen.getByTestId('theme')).toHaveTextContent('system/light');
    expect(isDark()).toBe(false);

    act(() => setDeviceDark(true));
    expect(screen.getByTestId('theme')).toHaveTextContent('system/dark');
    expect(isDark()).toBe(true);
  });

  it('switches from the nav menu and remembers the choice in this browser', async () => {
    mockDevice(false);
    renderTheme();

    fireEvent.click(screen.getByRole('button', { name: /change theme/i }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /dark/i }));

    expect(screen.getByTestId('theme')).toHaveTextContent('dark/dark');
    expect(isDark()).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    // Signed out: nothing is sent to the API.
    expect(api.put).not.toHaveBeenCalled();
  });

  it("applies the account's theme over this browser's", async () => {
    localStorage.setItem(THEME_KEY, 'light');
    signedIn();
    api.get.mockResolvedValue({ data: { user: { name: 'Alice', email: 'alice@example.com', theme: 'dark' } } });
    renderTheme();

    await waitFor(() => expect(screen.getByTestId('theme')).toHaveTextContent('dark/dark'));
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(api.put).not.toHaveBeenCalled();
  });

  it("gives an account that never chose this browser's choice", async () => {
    localStorage.setItem(THEME_KEY, 'dark');
    signedIn();
    api.get.mockResolvedValue({ data: { user: { name: 'Alice', email: 'alice@example.com', theme: null } } });
    renderTheme();

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/auth/preferences', { theme: 'dark' }));
    expect(screen.getByTestId('theme')).toHaveTextContent('dark/dark');
  });

  it('saves a new choice to the account when signed in', async () => {
    mockDevice(false);
    signedIn();
    api.get.mockResolvedValue({ data: { user: { name: 'Alice', email: 'alice@example.com', theme: 'light' } } });
    api.put.mockResolvedValue({ data: { user: { name: 'Alice', email: 'alice@example.com', theme: 'system' } } });
    renderTheme();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /change theme/i }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /system/i }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/auth/preferences', { theme: 'system' }));
    expect(screen.getByTestId('theme')).toHaveTextContent('system/light');
  });

  it('is a fixed light theme outside a provider', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current).toMatchObject({ preference: 'system', resolved: 'light' });
    expect(() => result.current.setPreference('dark')).not.toThrow();
  });
});
