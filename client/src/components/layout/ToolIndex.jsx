import React from 'react';
import Icon from '../ui/Icon';
import { TOOLS } from '../../lib/pages';

/**
 * The tools of a hub page (Career, Doubts & Notes, Videos): one large card
 * per row: a soft blue icon chip, what the tool does, what you get (as quiet
 * tags) and an Open button. Blue stays an accent, not a fill.
 * tools: [{ key (lib/pages TOOLS), description, detail ('a · b · c'), onOpen }]
 */
export default function ToolIndex({ tools }) {
  return (
    <ul className="space-y-4">
      {tools.map((t) => {
        const meta = TOOLS[t.key];
        const gets = (t.detail || '').split('·').map((x) => x.trim()).filter(Boolean).map((x) => x[0].toUpperCase() + x.slice(1));
        return (
          <li key={t.key}>
            <button
              type="button"
              onClick={t.onOpen}
              className="group relative flex w-full flex-col gap-5 overflow-hidden rounded-xl bg-raised p-6 text-left ring-1 ring-line-subtle transition duration-200 hover:shadow-popover hover:ring-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:flex-row sm:items-center sm:gap-6 sm:p-7"
            >
              <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent-soft/70 text-accent-fg">
                <Icon name={meta.icon} className="h-6 w-6" strokeWidth={1.6} />
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="block text-title font-semibold text-fg">{meta.name}</span>
                <span className="mt-1.5 block max-w-3xl text-lead text-fg-muted">{t.description}</span>
                {gets.length > 0 && (
                  <span className="mt-3 flex flex-wrap gap-1.5">
                    {gets.map((g) => (
                      <span key={g} className="inline-flex h-6 items-center rounded-full bg-sunken px-2.5 text-caption text-fg-muted ring-1 ring-inset ring-line-subtle">{g}</span>
                    ))}
                  </span>
                )}
              </span>
              <span className="relative inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-lg px-4 text-body font-medium text-fg ring-1 ring-inset ring-line transition-colors duration-200 group-hover:bg-sunken group-hover:ring-line-strong sm:self-center">
                Open {meta.name}
                <Icon name="arrowRight" className="h-4 w-4 text-accent-fg transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** A quieter follow-up below the tools: one line of what it is and its action. */
export function ToolAside({ title, text, action }) {
  return (
    <section className="mt-8 flex flex-col gap-4 rounded-xl bg-raised px-5 py-5 ring-1 ring-line-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="min-w-0">
        <h2 className="text-lead font-semibold text-fg">{title}</h2>
        <p className="mt-0.5 max-w-2xl text-small text-fg-muted">{text}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </section>
  );
}
