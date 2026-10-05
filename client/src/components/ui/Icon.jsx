import React from 'react';
import {
  LuActivity, LuArrowDown, LuArrowLeft, LuArrowRight, LuArrowUp, LuAward, LuBell, LuBookOpen, LuBot, LuBrain,
  LuBriefcase, LuCalendarDays, LuCheck, LuChevronDown, LuChevronLeft, LuChevronRight, LuChevronUp, LuAlertCircle,
  LuCheckCircle2, LuHelpCircle, LuClock, LuCompass, LuCopy, LuDownload, LuMoreHorizontal, LuExternalLink, LuFileText,
  LuFlag, LuFlame, LuGlobe, LuGraduationCap, LuHome, LuImage, LuInbox, LuInfo, LuLayers, LuLibrary, LuLightbulb,
  LuList, LuListChecks, LuLoader2, LuLock, LuLogOut, LuMail, LuMap, LuMenu, LuMessageSquare, LuMessagesSquare,
  LuMic, LuMonitor, LuMoon, LuStickyNote, LuPanelLeft, LuPaperclip, LuPencil, LuPlay, LuPlus, LuRefreshCw,
  LuMapPin, LuSearch, LuSend, LuSettings, LuShieldCheck, LuSlidersHorizontal, LuSparkles, LuSquare, LuStar, LuSun, LuTarget,
  LuThumbsDown, LuThumbsUp, LuTrash2, LuTrendingUp, LuAlertTriangle, LuUpload, LuUser, LuUsers, LuVideo, LuX, LuZap,
} from 'react-icons/lu';

/**
 * The Novard Agent mark, drawn on the same 24px grid and stroke as Lucide:
 * a speech bubble with an AI spark inside. Used wherever the agent is named
 * (sidebar, top bar, agent avatars).
 */
export function AgentMark({ className, strokeWidth = 1.75, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...rest}>
      <path d="M12 3.5c4.97 0 9 3.36 9 7.5s-4.03 7.5-9 7.5c-1.07 0-2.1-.16-3.05-.45L4.5 20l1.1-3.6C4.3 15.05 3 13.15 3 11c0-4.14 4.03-7.5 9-7.5z" />
      <path d="M12 7.25c.35 1.85 1.4 2.9 3.25 3.25-1.85.35-2.9 1.4-3.25 3.25-.35-1.85-1.4-2.9-3.25-3.25 1.85-.35 2.9-1.4 3.25-3.25z" fill="currentColor" stroke="none" />
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
