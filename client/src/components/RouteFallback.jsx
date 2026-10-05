import React from 'react';
import { getToken } from '../lib/session';
import { Skeleton } from './ui/States';

/**
 * Shown while a lazily-loaded route chunk (or the session) loads. Signed in,
 * it is the app's frame with placeholder content, so the page does not jump
 * when it arrives; signed out, a quiet line on the page colour.
 */
const RouteFallback = () => {
  if (!getToken()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas" role="status" aria-label="Loading">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-accent" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-canvas" role="status" aria-label="Loading">
      <div className="fixed inset-y-0 left-0 hidden w-60 border-r border-line-subtle bg-sunken p-4 lg:block" aria-hidden="true">
        <Skeleton className="h-6 w-32" />
        <div className="mt-8 space-y-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-5 w-40" />)}</div>
      </div>
      <div className="h-14 border-b border-line-subtle lg:ml-60" aria-hidden="true" />
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:ml-60 lg:px-8" aria-hidden="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        <div className="mt-10 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" rounded="rounded-lg" />)}</div>
      </div>
    </div>
  );
};

export default RouteFallback;
