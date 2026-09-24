import React from 'react';

/**
 * The Novard Agent's small static mark (the star core of the animated
 * floating button). Plain CSS gradient and no SVG ids, so any number can
 * appear on a page without clashing.
 */
const AgentAvatar = ({ size = 'h-7 w-7', className = '' }) => (
  <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-500 shadow-sm shadow-blue-500/30 ${size} ${className}`} aria-hidden="true">
    <svg viewBox="0 0 24 24" className="h-[62%] w-[62%]" fill="none">
      <path d="M12 2.5c0 4.8-4.7 9.5-9.5 9.5 4.8 0 9.5 4.7 9.5 9.5 0-4.8 4.7-9.5 9.5-9.5-4.8 0-9.5-4.7-9.5-9.5z" fill="white" fillOpacity="0.95" />
      <path d="M12.6 7.6l-3 4.6h2.2l-.9 4.2 3.5-5h-2.3l.5-3.8z" fill="#2563EB" />
    </svg>
  </span>
);

export default AgentAvatar;
