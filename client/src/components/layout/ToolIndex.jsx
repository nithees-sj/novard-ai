import React from 'react';
import Icon from '../ui/Icon';
import { TOOLS } from '../../lib/pages';

/**
 * The tools of a hub page (Career, Doubts & Notes, Videos) as a list: what
 * each one does and what you get from it, one row each, divided by hairlines.
 * tools: [{ key (lib/pages TOOLS), description, detail, onOpen }]
 */
export default function ToolIndex({ tools }) {
  return (
    <ul className="divide-y divide-line-subtle border-y border-line-subtle">
      {tools.map((t) => {
        const meta = TOOLS[t.key];
        return (
          <li key={t.key}>
            <button
              type="button"
              onClick={t.onOpen}
              className="group -mx-3 flex w-[calc(100%+1.5rem)] items-start gap-4 rounded-lg px-3 py-5 text-left transition-colors duration-150 hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus sm:gap-5"
            >
              <Icon name={meta.icon} className="mt-1 h-5 w-5 text-fg-subtle transition-colors group-hover:text-accent-fg" strokeWidth={1.5} />
              <span className="min-w-0 flex-1">
                <span className="block text-title font-semibold text-fg">{meta.name}</span>
                <span className="mt-1 block max-w-2xl text-body text-fg-muted">{t.description}</span>
                {t.detail && <span className="mt-2 block text-small text-fg-subtle">{t.detail}</span>}
              </span>
              <span className="mt-1 hidden shrink-0 items-center gap-1 text-small font-medium text-accent-fg opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:inline-flex">
                Open <Icon name="arrowRight" className="h-4 w-4" />
              </span>
              <Icon name="chevronRight" className="mt-1.5 h-4 w-4 text-fg-subtle sm:hidden" />
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
    <section className="mt-10 flex flex-col gap-4 rounded-xl bg-sunken px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-body font-semibold text-fg">{title}</h2>
        <p className="mt-0.5 max-w-2xl text-small text-fg-muted">{text}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </section>
  );
}
