import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { SegmentedControl } from './ui/Tabs';
import UIIcon from './ui/Icon';

const glyph = (name) => function ThemeGlyph({ className }) { return <UIIcon name={name} className={className} />; };
const SunIcon = glyph('sun');
const MoonIcon = glyph('moon');
const MonitorIcon = glyph('monitor');
const CheckIcon = glyph('check');

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: SunIcon },
  { value: 'dark', label: 'Dark', Icon: MoonIcon },
  { value: 'system', label: 'System', Icon: MonitorIcon },
];


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

  const Current = resolved === 'dark' ? MoonIcon : SunIcon;
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
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted transition-colors duration-150 hover:bg-sunken hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Current className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Theme"
          onKeyDown={onMenuKey}
          className="absolute right-0 top-full z-[70] mt-1.5 w-48 rounded-lg bg-overlay p-1 shadow-popover ring-1 ring-line-subtle animate-slide-down"
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
                className={`flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-left text-body transition-colors focus:outline-none focus-visible:bg-sunken ${active ? 'font-medium text-fg' : 'text-fg-muted hover:bg-sunken hover:text-fg'}`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">
                  {optionLabel}
                  {value === 'system' && <span className="ml-1 text-caption font-normal text-fg-subtle">({resolved === 'dark' ? 'Dark' : 'Light'})</span>}
                </span>
                {active && <CheckIcon className="h-4 w-4 shrink-0 text-accent-fg" aria-hidden="true" />}
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
  const { preference, setPreference } = useTheme();
  return (
    <SegmentedControl
      label="Theme"
      value={preference}
      onChange={setPreference}
      options={[{ id: 'light', label: 'Light', icon: 'sun' }, { id: 'dark', label: 'Dark', icon: 'moon' }, { id: 'system', label: 'System', icon: 'monitor' }]}
    />
  );
}
