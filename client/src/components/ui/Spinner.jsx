import React from 'react';

/** A small busy indicator in the current text colour. */
export default function Spinner({ className = 'h-4 w-4', label }) {
  return (
    <span
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80 ${className}`}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
