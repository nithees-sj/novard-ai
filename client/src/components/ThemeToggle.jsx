import React, { useEffect, useRef, useState } from 'react';
import { FiCheck, FiMonitor, FiMoon, FiSun } from 'react-icons/fi';
import { useTheme } from '../context/ThemeContext';

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: FiSun },
  { value: 'dark', label: 'Dark', Icon: FiMoon },
  { value: 'system', label: 'System', Icon: FiMonitor },
];

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40';

/**
 * The theme switch in the top bar: an icon button showing the current theme,
 * opening a menu of Light, Dark and System (follow the device).
 */
export default function ThemeToggle({ className = '' }) {
  const { preference, resolved, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => {
    if (!open) return undefined;
    // Start on the current choice, so Enter keeps it and the arrows move from there.
    itemRefs.current[Math.max(0, OPTIONS.findIndex((o) => o.value === preference))]?.focus();
    const onPointer = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- focus only when the menu opens

  const onMenuKey = (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const items = itemRefs.current;
    const at = items.indexOf(document.activeElement);
    const next = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: items.length - 1 }[event.key];
    items[(next + items.length) % items.length]?.focus();
  };

  const choose = (value) => {
    setPreference(value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const Current = resolved === 'dark' ? FiMoon : FiSun;
  const label = preference === 'system' ? `System (${resolved})` : preference;
  // The menu is placed against this wrapper, unless a caller already positions it.
  const position = /\b(absolute|fixed)\b/.test(className) ? '' : 'relative';

  return (
    <div ref={rootRef} className={`${position} shrink-0 ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${label}. Change theme`}
        title="Change theme"
        className={`flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-surface text-gray-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 ${focusRing}`}
      >
        <Current className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Theme"
          onKeyDown={onMenuKey}
          className="absolute right-0 top-full z-[60] mt-2 w-48 rounded-xl border border-gray-200 bg-surface-overlay p-1 shadow-hard animate-slide-down"
        >
          {OPTIONS.map(({ value, label: optionLabel, Icon }, i) => {
            const active = preference === value;
            return (
              <button
                key={value}
                ref={(el) => { itemRefs.current[i] = el; }}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => choose(value)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${focusRing} ${active ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">
                  {optionLabel}
                  {value === 'system' && <span className="ml-1 text-xs font-normal text-gray-500">({resolved === 'dark' ? 'Dark' : 'Light'})</span>}
                </span>
                {active && <FiCheck className="h-4 w-4 shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** The same three choices as a segmented control (the Settings page). */
export function ThemeOptions() {
  const { preference, resolved, setPreference } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-xl border border-gray-200 bg-gray-100 p-1">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(value)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${focusRing} ${active ? 'bg-surface text-gray-900 shadow-sm dark:bg-gray-200' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
            {value === 'system' && active && <span className="text-xs font-normal text-gray-500">({resolved})</span>}
          </button>
        );
      })}
    </div>
  );
}
