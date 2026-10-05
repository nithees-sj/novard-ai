import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { buttonClass } from '../components/ui/Button';
import { PAGES } from '../lib/pages';
import mainlogo from '../images/mainlogo.png';

function Message({ signedIn }) {
  const { pathname } = useLocation();
  return (
    <div className="max-w-xl py-10 sm:py-16">
      <p className="num text-small text-fg-subtle">404</p>
      <h1 className="mt-2 text-display font-semibold text-fg">This page doesn’t exist</h1>
      <p className="mt-2 text-body text-fg-muted">
        Nothing lives at <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-small text-fg">{pathname}</code>. The link may be old, or the address mistyped.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link to={signedIn ? PAGES.home.path : '/'} className={buttonClass({ variant: 'primary' })}>{signedIn ? 'Go to Home' : 'Go to the start page'}</Link>
        {signedIn && <Link to={PAGES.doubts.path} className={buttonClass({ variant: 'secondary' })}>Open Doubts &amp; Notes</Link>}
      </div>
    </div>
  );
}

/** Unknown addresses: inside the app when signed in, on a plain page otherwise. */
export default function NotFound({ signedIn }) {
  if (signedIn) {
    return (
      <AppShell crumbs={[{ label: 'Home', to: PAGES.home.path }, { label: 'Page not found' }]} title="Page not found">
        <Message signedIn />
      </AppShell>
    );
  }
  return (
    <div className="min-h-screen bg-canvas px-6">
      <div className="mx-auto max-w-xl pt-16">
        <Link to="/" className="inline-flex items-center gap-2.5 rounded">
          <img src={mainlogo} alt="" className="h-7 w-7 rounded-md dark:invert" />
          <span className="font-display text-lead font-bold tracking-tight text-fg">NOVARD-AI</span>
        </Link>
        <Message signedIn={false} />
      </div>
    </div>
  );
}
