import React from 'react';
import { useNavigate } from 'react-router-dom';
import Tooltip from './ui/Tooltip';
import { AgentGlyph } from './agent/AgentAvatar';

/**
 * The large assistant mark (the agent's welcome screen): a ring around the
 * star core, on a face in the page's surface colour. Static.
 */
export const BotMark = () => (
  <svg viewBox="0 0 120 120" width="100%" height="100%" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="novard-bot-bg" cx="50%" cy="50%" r="50%">
        <stop offset="0%" style={{ stopColor: 'rgb(var(--surface))' }} />
        <stop offset="75%" style={{ stopColor: 'rgb(var(--surface))' }} />
        <stop offset="100%" style={{ stopColor: 'rgb(var(--blue-50))' }} />
      </radialGradient>
      <linearGradient id="novard-bot-energy" x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="50%" stopColor="#2563EB" />
        <stop offset="100%" stopColor="#0891B2" />
      </linearGradient>
      <linearGradient id="novard-bot-stream" x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0%" stopColor="#2563EB" stopOpacity="0" />
        <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#60A5FA" stopOpacity="1" />
      </linearGradient>
      <filter id="novard-bot-glow" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur result="blur" stdDeviation="4" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    {/* base */}
    <rect width="120" height="120" rx="60" fill="url(#novard-bot-bg)" />
    <rect x="1" y="1" width="118" height="118" rx="59" stroke="#3B82F6" strokeOpacity="0.35" strokeWidth="1.5" />

    {/* energy vortex rings */}
    <circle cx="60" cy="60" r="45" stroke="url(#novard-bot-stream)" strokeWidth="3" strokeLinecap="round" strokeDasharray="110 170" />
    <circle cx="60" cy="60" r="38" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" opacity="0.7" />

    {/* orbiting particles */}
    <g>
      <circle cx="60" cy="15" r="3" fill="#3B82F6" />
      <circle cx="99" cy="82" r="2.5" fill="#0EA5E9" />
      <circle cx="21" cy="82" r="2.5" fill="#60A5FA" />
    </g>

    {/* pulsing star core with lightning */}
    <g>
      <path d="M60 26 C60 42 42 60 26 60 C42 60 60 78 60 94 C60 78 78 60 94 60 C78 60 60 42 60 26 Z" fill="url(#novard-bot-energy)" opacity="0.25" />
      <path d="M60 32 C60 46 46 60 32 60 C46 60 60 74 60 88 C60 74 74 60 88 60 C74 60 60 46 60 32 Z" fill="url(#novard-bot-energy)" />
      <polygon points="60,45 69,57 63,57 66,70 54,61 60,61" fill="#FFFFFF" />
    </g>

    {/* "live" badge */}
    <g>
      <circle cx="86" cy="34" r="5" fill="#2563EB" style={{ stroke: 'rgb(var(--surface))' }} strokeWidth="2" />
      <path d="M86 31 L84 34 L86 34 L85 37 L88 33.5 L86.5 33.5 Z" fill="#FFFFFF" />
    </g>
  </svg>
);

/**
 * The floating way into the Novard Agent: a small round button in the
 * bottom-right corner, in the strip the app shell keeps free of content
 * (AppShell's right gutter), so it never covers a button or a field. Hidden
 * on phones, where the top bar has the same button.
 */
const ChatbotButton = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-5 right-4 z-40 hidden sm:block">
      <Tooltip label="Novard Agent" side="left">
        <button
          type="button"
          onClick={() => navigate('/chatbot')}
          aria-label="Open Novard Agent, the AI assistant"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-on-accent shadow-popover transition-colors duration-150 hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <AgentGlyph className="h-5 w-5" />
        </button>
      </Tooltip>
    </div>
  );
};

export default ChatbotButton;
