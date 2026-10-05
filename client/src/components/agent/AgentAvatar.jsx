import React from 'react';

/** The Novard Agent's star-and-spark glyph, in the current text colour. */
export const AgentGlyph = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true" focusable="false">
    <path d="M12 2.5c0 4.8-4.7 9.5-9.5 9.5 4.8 0 9.5 4.7 9.5 9.5 0-4.8 4.7-9.5 9.5-9.5-4.8 0-9.5-4.7-9.5-9.5z" fill="currentColor" />
    <path d="M12.6 7.6l-3 4.6h2.2l-.9 4.2 3.5-5h-2.3l.5-3.8z" className="fill-accent" />
  </svg>
);

/**
 * The Novard Agent's small static mark: the glyph on a solid accent disc.
 * No SVG ids, so any number can appear on a page without clashing.
 */
const AgentAvatar = ({ size = 'h-7 w-7', className = '' }) => (
  <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-accent text-on-accent ${size} ${className}`} aria-hidden="true">
    <AgentGlyph className="h-[62%] w-[62%]" />
  </span>
);

export default AgentAvatar;
