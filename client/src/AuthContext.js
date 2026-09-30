import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { api, errorMessage } from './lib/api';
import { clearSession, restoreSession, saveSession, SESSION_EXPIRED_EVENT } from './lib/session';
import { clearAdminSession, saveAdminSession } from './lib/adminApi';
import logger from './lib/logger';

const ADMIN_ROLES = ['admin', 'superadmin'];

const AuthContext = createContext(null);

/**
 * Authentication state and actions.
 *
 * Sign-in: Google's implicit flow gives the browser an access token, which the
 * API verifies with Google and exchanges for a Novard-AI session token. The
 * session is kept in localStorage (lib/session.js) and sent with every API
 * call (lib/api.js). When the API rejects it, the student is signed out.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState(null);

  // One session: signing out of the app also ends the admin console session.
  const signOut = useCallback(() => {
    clearSession();
    clearAdminSession();
    setUser(null);
    window.google?.accounts?.id?.disableAutoSelect();
  }, []);

  // Restore the session on load, then confirm in the background that the API still accepts it.
  useEffect(() => {
    const stored = restoreSession();
    setUser(stored);
    setLoading(false);
    if (stored) {
      api.get('/api/auth/me')
        .then(({ data }) => {
          // Keep the stored profile (and role) in step with the account.
          if (data?.user?.email === stored.email) {
            setUser(saveSession({ user: data.user }));
            // No longer an admin: drop any admin console session too.
            if (!ADMIN_ROLES.includes(data.user.role)) clearAdminSession();
          }
        })
        .catch((error) => {
          if (![401, 403].includes(error.response?.status)) logger.warn('Could not verify the session', error);
        });
    }
  }, []);

  // A 401 (expired or revoked session) or a suspended account signs the student out.
  useEffect(() => {
    const onExpired = (event) => {
      signOut();
      if (event.detail?.message) setAuthError(event.detail.message);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [signOut]);

  const googleLogin = useGoogleLogin({
    flow: 'implicit',
    onSuccess: async (tokenResponse) => {
      setSigningIn(true);
      setAuthError(null);
      try {
        const { data } = await api.post('/api/auth/google', { accessToken: tokenResponse.access_token });
        setUser(saveSession(data));
        // "Continue with Google" is the only sign-in an admin needs: the API returns
        // an admin console session too when the account is an admin.
        if (data.admin?.token) saveAdminSession(data.admin);
        else clearAdminSession();
      } catch (error) {
        logger.error('Sign-in failed', error);
        setAuthError(errorMessage(error, 'Sign-in failed. Please try again.'));
      } finally {
        setSigningIn(false);
      }
    },
    onError: (error) => {
      logger.error('Google sign-in error', error);
      setAuthError('Google sign-in was cancelled or failed. Please try again.');
    },
    onNonOAuthError: (error) => {
      // e.g. the popup was closed or blocked
      if (error?.type !== 'popup_closed') setAuthError('The Google sign-in window could not be opened. Please allow pop-ups and try again.');
    },
  });

  const signIn = useCallback(() => {
    setAuthError(null);
    googleLogin();
  }, [googleLogin]);

  /** Keep the session in step after the profile changes (new name, new token). */
  const updateSession = useCallback((session) => {
    setUser(saveSession(session));
  }, []);

  const value = useMemo(() => ({
    user, loading, signingIn, authError, signIn, signOut, updateSession,
  }), [user, loading, signingIn, authError, signIn, signOut, updateSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Auth state and actions: { user, loading, signingIn, authError, signIn, signOut, updateSession } */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
