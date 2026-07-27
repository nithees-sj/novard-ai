import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';

const AuthContext = createContext(null);

const apiUrl = process.env.REACT_APP_API_ENDPOINT;

/**
 * AuthProvider wraps the app and provides authentication state + actions.
 * Uses Google OAuth (via @react-oauth/google) instead of Firebase.
 * Persists session in localStorage.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, restore session from localStorage
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('auth_user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error restoring session:', error);
      localStorage.removeItem('auth_user');
    }
    setLoading(false);
  }, []);

  // Save user to backend
  const saveUserToBackend = useCallback(async (userData) => {
    try {
      const response = await axios.post(`${apiUrl}/saveUser`, userData);
      console.log('User data saved:', response.data);
    } catch (error) {
      console.error('Error saving user data:', error);
    }
  }, []);

  // Google OAuth login using implicit flow to get an ID token
  const googleLogin = useGoogleLogin({
    flow: 'implicit',
    onSuccess: async (tokenResponse) => {
      try {
        // Fetch user info from Google's userinfo endpoint
        const userInfoResponse = await axios.get(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          {
            headers: {
              Authorization: `Bearer ${tokenResponse.access_token}`,
            },
          }
        );

        const profile = userInfoResponse.data;
        const userData = {
          name: profile.name,
          email: profile.email,
          picture: profile.picture,
          displayName: profile.name,
          photoURL: profile.picture,
        };

        setUser(userData);

        // Persist to localStorage
        localStorage.setItem('auth_user', JSON.stringify(userData));
        localStorage.setItem('name', userData.name);
        localStorage.setItem('email', userData.email);
        localStorage.setItem('profilePic', userData.picture);

        // Save to backend
        await saveUserToBackend({
          name: userData.name,
          email: userData.email,
          picture: userData.picture,
        });
      } catch (error) {
        console.error('Error fetching user info:', error);
      }
    },
    onError: (error) => {
      console.error('Google login error:', error);
    },
  });

  const signIn = useCallback(() => {
    googleLogin();
  }, [googleLogin]);

  const signOut = useCallback(() => {
    setUser(null);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('name');
    localStorage.removeItem('email');
    localStorage.removeItem('profilePic');
    // Revoke Google session
    window.google?.accounts?.id?.disableAutoSelect();
  }, []);

  const value = {
    user,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to access auth state and actions.
 * Returns { user, loading, signIn, signOut }
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
