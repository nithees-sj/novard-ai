import React from 'react';

/** Shown while a lazily-loaded route chunk is being fetched. */
const RouteFallback = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
    <div
      className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-primary-600 animate-spin"
      role="status"
      aria-label="Loading"
    />
    <p className="text-sm text-gray-500">Loading&hellip;</p>
  </div>
);

export default RouteFallback;
