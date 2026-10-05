import React from 'react';
import { Badge, Icon } from '../learning/LearningUI';
import { PageHeader as UIPageHeader } from '../ui/Headers';
import { LoadingBlock } from '../ui/States';

/**
 * Small pieces shared by the admin console pages, built on the app's own
 * components (LearningUI badges, buttons, the profile cards). Colour means
 * status only: green / amber / red; everything else is blue and grey.
 */

const LEVEL_TONE = { LOW: 'green', MEDIUM: 'amber', HIGH: 'red', CRITICAL: 'red' };
export const LevelBadge = ({ level }) => <Badge tone={LEVEL_TONE[level] || 'gray'}>{level || 'n/a'}</Badge>;

const LIGHT = {
  ok: ['bg-success', 'OK'],
  idle: ['bg-fg-disabled', 'No traffic'],
  degraded: ['bg-warning', 'Degraded'],
  limited: ['bg-warning', 'Rate-limited'],
  down: ['bg-danger', 'Down'],
  off: ['bg-fg-subtle', 'Switched off'],
  missing: ['bg-danger', 'Not configured'],
};
export const StatusLight = ({ status, withLabel = true }) => {
  const [color, label] = LIGHT[status] || ['bg-fg-disabled', status || 'unknown'];
  return (
    <span className="inline-flex items-center gap-1.5 text-small text-fg-muted">
      <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
      {withLabel && label}
    </span>
  );
};

export const PageHeader = ({ title, subtitle, actions }) => (
  <UIPageHeader title={title} description={subtitle} actions={actions} className="mb-6" />
);

export const Loading = ({ label = 'Loading…' }) => (
  <LoadingBlock label={label} />
);

export const ErrorNote = ({ error, onRetry }) => (error ? (
  <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-danger-soft px-4 py-3 text-body text-danger-fg">
    <span>{error}</span>
    {onRetry && <button type="button" onClick={onRetry} className="font-semibold underline">Try again</button>}
  </div>
) : null);

export const Section = ({ title, subtitle, right, children, className = '' }) => (
  <section className={`overflow-hidden rounded-xl bg-raised ring-1 ring-line-subtle ${className}`}>
    {(title || right) && (
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div>
          {title && <h2 className="text-body font-semibold text-fg">{title}</h2>}
          {subtitle && <p className="mt-0.5 text-small text-fg-subtle">{subtitle}</p>}
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
      {drivers.map((d) => (d.text
        // The complaint count: a plain sentence, not a deviation.
        ? <li key={d.feature} className="rounded-sm bg-danger-soft px-1.5 py-0.5 text-caption font-medium text-danger-fg">{d.label}</li>
        : <li key={d.feature} className="tabular rounded-sm bg-sunken px-1.5 py-0.5 text-caption text-fg-muted">{d.label} {d.z > 0 ? '+' : ''}{Number(d.z).toFixed(1)}σ</li>))}
    </ul>
  )
  : <span className="text-small text-fg-subtle">no unusual signal</span>);

export const IconText = ({ icon, children }) => <span className="inline-flex items-center gap-1.5"><Icon name={icon} className="h-4 w-4" />{children}</span>;
