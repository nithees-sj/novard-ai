import React from 'react';

/**
 * Card blocks shared by the profile page and the admin console: a stat tile
 * with an accent bar, a section heading and a titled card.
 */

export const Stat = ({ label, value, sub, accent }) => (
  <div className="bg-surface rounded-xl border border-gray-200 p-5 relative overflow-hidden">
    <span className={`absolute left-0 top-0 bottom-0 w-1 ${accent}`} aria-hidden="true" />
    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
    <p className="mt-2 text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
    <p className="mt-1 text-xs text-gray-500 truncate" title={typeof sub === 'string' ? sub : undefined}>{sub}</p>
  </div>
);

export const SectionTitle = ({ title, subtitle }) => (
  <div className="flex items-end justify-between gap-4 pt-4">
    <div>
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
    </div>
  </div>
);

export const Card = ({ title, subtitle, right, children, className = '' }) => (
  <div className={`bg-surface rounded-xl border border-gray-200 p-6 ${className}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
    <div className="mt-5">{children}</div>
  </div>
);
