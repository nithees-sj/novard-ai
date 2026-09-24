import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Animated assistant mark (designed in Stitch), on a white face: an energy vortex around a
 * pulsing star core, with a small "live" lightning badge. The SVG is its own
 * round button face; animations live in index.css (.bot-*) and stop for
 * users who prefer reduced motion.
 */
const BotMark = () => (
  <svg viewBox="0 0 120 120" width="100%" height="100%" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="novard-bot-bg" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="75%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#EFF6FF" />
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

    {/* white base */}
    <rect width="120" height="120" rx="60" fill="url(#novard-bot-bg)" />
    <rect x="1" y="1" width="118" height="118" rx="59" stroke="#3B82F6" strokeOpacity="0.35" strokeWidth="1.5" />

    {/* energy vortex rings */}
    <circle className="bot-spin" cx="60" cy="60" r="45" stroke="url(#novard-bot-stream)" strokeWidth="3" strokeLinecap="round" strokeDasharray="110 170" filter="url(#novard-bot-glow)" />
    <circle className="bot-spin-reverse bot-dash" cx="60" cy="60" r="38" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" opacity="0.7" />

    {/* orbiting particles */}
    <g className="bot-spin">
      <circle cx="60" cy="15" r="3" fill="#3B82F6" filter="url(#novard-bot-glow)" />
      <circle cx="99" cy="82" r="2.5" fill="#0EA5E9" />
      <circle cx="21" cy="82" r="2.5" fill="#60A5FA" />
    </g>

    {/* pulsing star core with lightning */}
    <g className="bot-pulse">
      <path d="M60 26 C60 42 42 60 26 60 C42 60 60 78 60 94 C60 78 78 60 94 60 C78 60 60 42 60 26 Z" fill="url(#novard-bot-energy)" filter="url(#novard-bot-glow)" opacity="0.25" />
      <path d="M60 32 C60 46 46 60 32 60 C46 60 60 74 60 88 C60 74 74 60 88 60 C74 60 60 46 60 32 Z" fill="url(#novard-bot-energy)" />
      <polygon points="60,45 69,57 63,57 66,70 54,61 60,61" fill="#FFFFFF" filter="url(#novard-bot-glow)" />
    </g>

    {/* "live" badge */}
    <g className="bot-badge">
      <circle cx="86" cy="34" r="5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
      <path d="M86 31 L84 34 L86 34 L85 37 L88 33.5 L86.5 33.5 Z" fill="#FFFFFF" />
    </g>
  </svg>
);

/** Floating entry point to the assistant: a "Novard Agent" label above the animated mark. */
const ChatbotButton = () => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate('/chatbot')}
      title="Ask the Novard Agent"
      aria-label="Open Novard Agent, the AI assistant"
      className="group fixed bottom-8 right-8 z-50 flex flex-col items-center gap-2 rounded-2xl
                 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
    >
      <span
        className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-blue-100 bg-white/95 px-3 py-1
                   text-[11px] font-semibold tracking-wide shadow-md shadow-blue-500/15 backdrop-blur
                   transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-blue-500/30"
        aria-hidden="true"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping motion-reduce:animate-none" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Novard Agent</span>
      </span>
      <span
        className="block w-16 h-16 rounded-full bg-white shadow-lg shadow-blue-500/25
                   transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-blue-500/40"
        aria-hidden="true"
      >
        <BotMark />
      </span>
    </button>
  );
};

export default ChatbotButton;
