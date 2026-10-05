import React from 'react';
import { Navigate } from 'react-router-dom';
import mainlogo from '../../images/mainlogo.png';
import { useAdminAuth } from '../../AdminAuthContext';
import { Icon } from '../../components/learning/LearningUI';
import ThemeToggle from '../../components/ThemeToggle';

/**
 * Admin console sign-in: the same Google sign-in as the app. The server
 * checks the account's role; a student account is told clearly and gets no
 * admin session.
 */
export default function AdminLogin() {
  const { admin, signIn, signingIn, error } = useAdminAuth();
  if (admin) return <Navigate to="/admin" replace />;
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 px-4">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-surface p-8 text-center shadow-soft">
        <img src={mainlogo} alt="NOVARD-AI" className="mx-auto mb-4 h-12 w-12 rounded-xl dark:invert" />
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Admin console</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-gray-900">Sign in to NOVARD-AI admin</h1>
        <p className="mt-2 text-sm text-gray-500">Use the Google account an admin role was granted to. Student accounts cannot sign in here.</p>
        <button
          type="button"
          onClick={signIn}
          disabled={signingIn}
          aria-busy={signingIn}
          className="mx-auto mt-6 flex items-center gap-2 rounded-full bg-blue-600 px-8 py-3.5 text-[0.95rem] font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-70"
        >
          <Icon name="shield" className="h-4 w-4" />
          {signingIn ? 'Signing in…' : 'Sign in with Google'}
        </button>
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
        <a href="/" className="mt-6 inline-block text-xs font-semibold text-gray-500 hover:text-blue-600">Back to Novard-AI</a>
      </div>
    </div>
  );
}
