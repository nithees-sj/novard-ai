import React from 'react';
import {
  LuActivity, LuArrowDown, LuArrowLeft, LuArrowRight, LuArrowUp, LuAward, LuBell, LuBookOpen, LuBot, LuBrain,
  LuBriefcase, LuCalendarDays, LuCheck, LuChevronDown, LuChevronLeft, LuChevronRight, LuChevronUp, LuAlertCircle,
  LuCheckCircle2, LuHelpCircle, LuClock, LuCompass, LuCopy, LuDownload, LuMoreHorizontal, LuExternalLink, LuFileText,
  LuFlag, LuFlame, LuGripVertical, LuListTodo, LuGlobe, LuGraduationCap, LuHome, LuImage, LuInbox, LuInfo, LuLayers, LuLibrary, LuLightbulb,
  LuList, LuListChecks, LuLoader2, LuLock, LuLogOut, LuMail, LuMap, LuMenu, LuMessageSquare, LuMessagesSquare,
  LuMic, LuMonitor, LuMoon, LuStickyNote, LuPanelLeft, LuPaperclip, LuPencil, LuPlay, LuPlus, LuRefreshCw,
  LuMapPin, LuSearch, LuSend, LuSettings, LuShieldCheck, LuSlidersHorizontal, LuSparkles, LuSquare, LuStar, LuSun, LuTarget,
  LuThumbsDown, LuThumbsUp, LuTrash2, LuTrendingUp, LuAlertTriangle, LuUpload, LuUser, LuUsers, LuVideo, LuX, LuZap,
} from 'react-icons/lu';

/**
 * The Novard Agent mark: the curved four-point star of the agent's orb,
 * static and flat, with a small companion sparkle where the orb has its
 * badge. Drawn on Lucide's 24px grid so it sits with the other icons.
 */
export function AgentMark({ className, strokeWidth = 1.75, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...rest}>
      <path d="M10.5 4.5c0 4.7-3.3 8-8 8 4.7 0 8 3.3 8 8 0-4.7 3.3-8 8-8-4.7 0-8-3.3-8-8z" />
      <path d="M18.5 2.25c0 1.75-1 2.75-2.75 2.75 1.75 0 2.75 1 2.75 2.75 0-1.75 1-2.75 2.75-2.75-1.75 0-2.75-1-2.75-2.75z" fill="currentColor" strokeWidth={1.25} />
    </svg>
  );
}

/**
 * The one icon set (Lucide, through react-icons): 1.75px strokes, sized by
 * the className (h-4 w-4 by default, h-5 w-5 in navigation). Decorative by
 * default; pass `label` when the icon is the only content of a control.
 */
const ICONS = {
  // learning tools
  chat: LuMessageSquare,
  summary: LuFileText,
  quiz: LuListChecks,
  video: LuVideo,
  play: LuPlay,
  book: LuBookOpen,
  notes: LuStickyNote,
  library: LuLibrary,
  doubt: LuHelpCircle,
  brain: LuBrain,
  plan: LuCalendarDays,
  todo: LuListTodo,
  roadmap: LuMap,
  map: LuMapPin,
  compass: LuCompass,
  target: LuTarget,
  award: LuAward,
  graduation: LuGraduationCap,
  layers: LuLayers,
  idea: LuLightbulb,
  // places
  home: LuHome,
  career: LuBriefcase,
  forum: LuMessagesSquare,
  user: LuUser,
  users: LuUsers,
  settings: LuSettings,
  sliders: LuSlidersHorizontal,
  shield: LuShieldCheck,
  inbox: LuInbox,
  agent: AgentMark,
  bot: LuBot,
  // actions
  plus: LuPlus,
  trash: LuTrash2,
  send: LuSend,
  edit: LuPencil,
  copy: LuCopy,
  download: LuDownload,
  upload: LuUpload,
  link: LuExternalLink,
  refresh: LuRefreshCw,
  search: LuSearch,
  logout: LuLogOut,
  menu: LuMenu,
  sidebar: LuPanelLeft,
  more: LuMoreHorizontal,
  grip: LuGripVertical,
  x: LuX,
  check: LuCheck,
  stop: LuSquare,
  flag: LuFlag,
  bell: LuBell,
  mic: LuMic,
  image: LuImage,
  paperclip: LuPaperclip,
  mail: LuMail,
  lock: LuLock,
  globe: LuGlobe,
  thumbsUp: LuThumbsUp,
  thumbsDown: LuThumbsDown,
  star: LuStar,
  // arrows
  arrowLeft: LuArrowLeft,
  arrowRight: LuArrowRight,
  arrowUp: LuArrowUp,
  arrowDown: LuArrowDown,
  chevronLeft: LuChevronLeft,
  chevronRight: LuChevronRight,
  chevronDown: LuChevronDown,
  chevronUp: LuChevronUp,
  // status and data
  sparkles: LuSparkles,
  bolt: LuZap,
  flame: LuFlame,
  clock: LuClock,
  chart: LuActivity,
  trend: LuTrendingUp,
  list: LuList,
  info: LuInfo,
  alert: LuAlertCircle,
  warning: LuAlertTriangle,
  success: LuCheckCircle2,
  loader: LuLoader2,
  sun: LuSun,
  moon: LuMoon,
  monitor: LuMonitor,
};

export const ICON_NAMES = Object.keys(ICONS);

export default function Icon({ name, className = 'h-4 w-4', strokeWidth = 1.75, label }) {
  const Glyph = ICONS[name];
  if (!Glyph) {
    if (process.env.NODE_ENV !== 'production') console.warn(`Icon: unknown name "${name}"`);
    return null;
  }
  return (
    <Glyph
      className={`shrink-0 ${className}`}
      strokeWidth={strokeWidth}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
    />
  );
}

export { Icon };
