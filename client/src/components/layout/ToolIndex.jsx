import React from 'react';
import Icon from '../ui/Icon';
import { TOOLS } from '../../lib/pages';

/**
 * The tools of a hub page (Career, Doubts & Notes, Videos): one card each,
 * with a blue icon chip, what it does, what you get, and an Open action.
 * tools: [{ key (lib/pages TOOLS), description, detail, onOpen }]
 */
export default function ToolIndex({ tools }) {
  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {tools.map((t) => {
        const meta = TOOLS[t.key];
        return (
          <li key={t.key}>
            <button
              type="button"
              onClick={t.onOpen}
              className="group flex h-full w-full items-start gap-4 rounded-xl bg-raised p-5 text-left ring-1 ring-line-subtle transition duration-150 hover:ring-accent/40 hover:shadow-popover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:p-6"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-fg ring-1 ring-inset ring-accent/15 transition-colors group-hover:bg-accent group-hover:text-on-accent">
                <Icon name={meta.icon} className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col self-stretch">
                <span className="block text-title font-semibold text-fg">{meta.name}</span>
                <span className="mt-1 block text-body text-fg-muted">{t.description}</span>
                {t.detail && <span className="mt-2 block text-small text-fg-subtle">{t.detail}</span>}
                <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-body font-medium text-accent-fg">
                  Open {meta.name}
                  <Icon name="arrowRight" className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                </span>
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
    <section className="mt-8 flex flex-col gap-4 rounded-xl bg-accent-soft px-5 py-5 ring-1 ring-inset ring-accent/15 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="min-w-0">
        <h2 className="text-lead font-semibold text-fg">{title}</h2>
        <p className="mt-0.5 max-w-2xl text-small text-fg-muted">{text}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </section>
  );
}
