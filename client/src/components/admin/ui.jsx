import React from 'react';
import { Badge, Icon, Spinner } from '../learning/LearningUI';

/**
 * Small pieces shared by the admin console pages, built on the app's own
 * components (LearningUI badges, buttons, the profile cards). Colour means
 * status only: green / amber / red; everything else is blue and grey.
 */

const LEVEL_TONE = { LOW: 'green', MEDIUM: 'amber', HIGH: 'red', CRITICAL: 'red' };
export const LevelBadge = ({ level }) => <Badge tone={LEVEL_TONE[level] || 'gray'}>{level || 'n/a'}</Badge>;

const LIGHT = {
  ok: ['bg-emerald-500', 'OK'],
  idle: ['bg-gray-300', 'No traffic'],
  degraded: ['bg-amber-500', 'Degraded'],
  down: ['bg-red-500', 'Down'],
  off: ['bg-gray-400', 'Switched off'],
  missing: ['bg-red-500', 'Not configured'],
};
export const StatusLight = ({ status, withLabel = true }) => {
  const [color, label] = LIGHT[status] || ['bg-gray-300', status || 'unknown'];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} aria-hidden="true" />
      {withLabel && label}
    </span>
  );
};

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const Loading = ({ label = 'Loading…' }) => (
  <div className="flex items-center justify-center py-16 text-sm text-gray-500" role="status"><Spinner className="mr-2 h-5 w-5 text-blue-600" /> {label}</div>
);

export const ErrorNote = ({ error, onRetry }) => (error ? (
  <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
    <span>{error}</span>
    {onRetry && <button type="button" onClick={onRetry} className="font-semibold underline">Try again</button>}
  </div>
) : null);

export const Section = ({ title, subtitle, right, children, className = '' }) => (
  <section className={`overflow-hidden rounded-xl border border-gray-200 bg-white ${className}`}>
    {(title || right) && (
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pb-3 pt-5">
        <div>
          {title && <h2 className="text-base font-bold text-gray-900">{title}</h2>}
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        {right}
      </div>
    )}
    {children}
  </section>
);

export const usd = (v) => (v === null || v === undefined ? '–' : `$${Number(v).toFixed(v >= 1 ? 2 : 4)}`);
export const pct = (v, digits = 0) => (v === null || v === undefined ? '–' : `${(Number(v) * 100).toFixed(digits)}%`);
export const ms = (v) => (v === null || v === undefined ? '–' : v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`);
export const when = (d) => (d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–');

export const DriverList = ({ drivers = [] }) => (drivers.length
  ? (
    <ul className="flex flex-wrap gap-1.5">
      {drivers.map((d) => <li key={d.feature} className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-700">{d.label} {d.z > 0 ? '+' : ''}{Number(d.z).toFixed(1)}σ</li>)}
    </ul>
  )
  : <span className="text-xs text-gray-400">no unusual signal</span>);

export const IconText = ({ icon, children }) => <span className="inline-flex items-center gap-1.5"><Icon name={icon} className="h-4 w-4" />{children}</span>;
