import React from 'react';
import { Stat as UIStat, SectionHeader } from '../ui';

/**
 * Blocks shared by the profile page and the admin console: a stat (one cell
 * of a StatStrip), a section heading and a titled card.
 * Stats are not colour-coded; an older `accent` class only marks a warning
 * (amber) or a problem (red) value, through its tone.
 */

const toneFromAccent = (accent = '') => (/red/.test(accent) ? 'danger' : /amber/.test(accent) ? 'warning' : undefined);

export const Stat = ({ label, value, sub, accent, tone }) => <UIStat label={label} value={value} sub={sub} tone={tone || toneFromAccent(accent)} />;

export const SectionTitle = ({ title, subtitle, actions }) => (
  <SectionHeader title={title} description={subtitle} actions={actions} className="mb-0 pt-2" />
);

export const Card = ({ title, subtitle, right, children, className = '' }) => (
  <section className={`rounded-xl bg-raised p-5 ring-1 ring-line-subtle ${className}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-body font-semibold text-fg">{title}</h3>
        {subtitle && <p className="mt-0.5 text-small text-fg-subtle">{subtitle}</p>}
      </div>
      {right}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);
