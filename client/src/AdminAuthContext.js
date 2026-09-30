import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { adminApi, clearAdminSession, getAdminToken, getStoredAdmin, saveAdminSession, ADMIN_SESSION_EVENT } from './lib/adminApi';
import { errorMessage } from './lib/api';

const AdminAuthContext = createContext(null);

/**
 * The admin console's session: signed in with Google through the same OAuth
 * client as the app; the server checks the role and returns a separate,
 * shorter admin token. A non-admin gets a clear message and no token.
 */
export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => (getAdminToken() ? getStoredAdmin() : null));
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState(null);

  const signOut = useCallback((message) => {
    clearAdminSession();
    setAdmin(null);
    if (message) setError(message);
  }, []);

  // Confirm the stored session (and the current role) with the server.
  useEffect(() => {
    if (!getAdminToken()) return;
    adminApi.get('/api/admin/auth/me')
      .then(({ data }) => setAdmin(saveAdminSession({ admin: { ...getStoredAdmin(), ...data.admin } })))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onEnded = (event) => signOut(event.detail?.message || 'Your admin session has ended. Please sign in again.');
    window.addEventListener(ADMIN_SESSION_EVENT, onEnded);
    return () => window.removeEventListener(ADMIN_SESSION_EVENT, onEnded);
  }, [signOut]);

  const googleLogin = useGoogleLogin({
    flow: 'implicit',
    onSuccess: async (tokenResponse) => {
      setSigningIn(true);
      setError(null);
      try {
        const { data } = await adminApi.post('/api/admin/auth/google', { accessToken: tokenResponse.access_token });
        setAdmin(saveAdminSession(data));
      } catch (err) {
        setError(errorMessage(err, 'Admin sign-in failed. Please try again.'));
      } finally {
        setSigningIn(false);
      }
    },
    onError: () => setError('Google sign-in was cancelled or failed. Please try again.'),
    onNonOAuthError: (err) => {
      if (err?.type !== 'popup_closed') setError('The Google sign-in window could not be opened. Please allow pop-ups and try again.');
    },
  });

  const signIn = useCallback(() => {
    setError(null);
    googleLogin();
  }, [googleLogin]);

  const value = useMemo(() => ({ admin, signingIn, error, signIn, signOut }), [admin, signingIn, error, signIn, signOut]);
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

/** { admin, signingIn, error, signIn, signOut } */
export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  return context;
}
