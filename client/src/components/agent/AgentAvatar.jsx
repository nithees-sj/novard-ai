import React from 'react';
import { AgentMark } from '../ui/Icon';

/** The Novard Agent mark (the orb's four-point star with a small sparkle), in the current text colour. */
export const AgentGlyph = ({ className = 'h-4 w-4', strokeWidth = 1.9 }) => (
  <AgentMark className={className} strokeWidth={strokeWidth} aria-hidden="true" focusable="false" />
);

/**
 * The Novard Agent's avatar: the mark in white on a solid accent disc
 * (chat replies, action cards). No SVG ids, so any number can appear on a
 * page without clashing.
 */
const AgentAvatar = ({ size = 'h-7 w-7', className = '' }) => (
  <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-accent text-on-accent ${size} ${className}`} aria-hidden="true">
    <AgentGlyph className="h-[62%] w-[62%]" strokeWidth={2} />
  </span>
);

export default AgentAvatar;
