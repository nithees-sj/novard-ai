import React from 'react';
import { Navigate } from 'react-router-dom';
import mainlogo from '../../images/mainlogo.png';
import { useAdminAuth } from '../../AdminAuthContext';
import { Icon } from '../../components/learning/LearningUI';
import ThemeToggle from '../../components/ThemeToggle';
import Button from '../../components/ui/Button';

/**
 * Admin console sign-in: the same Google sign-in as the app. The server
 * checks the account's role; a student account is told clearly and gets no
 * admin session.
 */
export default function AdminLogin() {
  const { admin, signIn, signingIn, error } = useAdminAuth();
  if (admin) return <Navigate to="/admin" replace />;
  return (
    <div className="relative min-h-screen bg-canvas px-6">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="mx-auto max-w-sm pt-24 sm:pt-32">
        <div className="flex items-center gap-2.5">
          <img src={mainlogo} alt="NOVARD-AI" className="h-7 w-7 rounded-md dark:invert" />
          <span className="font-display text-lead font-bold tracking-tight text-fg">NOVARD-AI</span>
          <span className="text-small text-fg-subtle">Admin console</span>
        </div>
        <h1 className="mt-8 text-display font-semibold text-fg">Sign in to NOVARD-AI admin</h1>
        <p className="mt-2 text-body text-fg-muted">Use the Google account an admin role was granted to. Student accounts cannot sign in here.</p>
        <Button size="lg" icon="shield" className="mt-6" onClick={signIn} loading={signingIn} loadingLabel="Signing in…">
          Sign in with Google
        </Button>
        {error && <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-4 py-3 text-body text-danger-fg">{error}</p>}
        <a href="/" className="mt-8 inline-flex items-center gap-1 text-small text-fg-subtle hover:text-fg"><Icon name="arrowLeft" className="h-3.5 w-3.5" /> Back to Novard-AI</a>
      </div>
    </div>
  );
}
