import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { api } from '../lib/api';
import { saveSession, SESSION_EXPIRED_EVENT } from '../lib/session';

let googleOptions;
jest.mock('@react-oauth/google', () => ({
  useGoogleLogin: (options) => {
    googleOptions = options;
    return jest.fn();
  },
}));
jest.mock('../lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn() },
  errorMessage: (error, fallback) => error?.response?.data?.error || fallback,
}));

function Probe() {
  const { user, authError, signingIn, signIn } = useAuth();
  return (
    <div>
      <span data-testid="user">{user?.email || 'signed out'}</span>
      <span data-testid="error">{authError || ''}</span>
      <span data-testid="busy">{String(signingIn)}</span>
      <button type="button" onClick={signIn}>sign in</button>
    </div>
  );
}

const renderAuth = () => render(<AuthProvider><Probe /></AuthProvider>);

describe('AuthProvider', () => {
  // react-scripts resets mock implementations before each test.
  beforeEach(() => api.get.mockResolvedValue({ data: {} }));

  it('exchanges the Google token for an API session', async () => {
    api.post.mockResolvedValue({ data: { token: 'session-token', user: { name: 'Alice', email: 'alice@example.com' } } });
    renderAuth();

    await act(async () => { await googleOptions.onSuccess({ access_token: 'google-token' }); });

    expect(api.post).toHaveBeenCalledWith('/api/auth/google', { accessToken: 'google-token' });
    expect(screen.getByTestId('user')).toHaveTextContent('alice@example.com');
    expect(localStorage.getItem('auth_token')).toBe('session-token');
  });

  it('shows why sign-in failed instead of failing silently', async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'This sign-in was not issued for Novard-AI.' } } });
    renderAuth();
    await act(async () => { await googleOptions.onSuccess({ access_token: 'x' }); });
    expect(screen.getByTestId('user')).toHaveTextContent('signed out');
    expect(screen.getByTestId('error')).toHaveTextContent('This sign-in was not issued for Novard-AI.');
    expect(screen.getByTestId('busy')).toHaveTextContent('false');
  });

  it('restores a saved session and signs out when the API rejects it', async () => {
    saveSession({ token: 'tok', user: { name: 'Alice', email: 'alice@example.com' } });
    renderAuth();
    expect(screen.getByTestId('user')).toHaveTextContent('alice@example.com');
    expect(api.get).toHaveBeenCalledWith('/api/auth/me');

    act(() => { window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT)); });
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('signed out'));
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('does not restore a session saved before tokens existed', () => {
    localStorage.setItem('auth_user', JSON.stringify({ email: 'alice@example.com' }));
    renderAuth();
    expect(screen.getByTestId('user')).toHaveTextContent('signed out');
  });
});
