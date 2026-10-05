import React from 'react';
import { Icon } from './learning/LearningUI';
import { useAppStatus, useFeature } from '../context/AppStatusContext';
import useAiUsage from '../hooks/useAiUsage';

/** When a token allowance comes back, in the student's own time zone. */
const resetTime = (iso) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** One tool's used-up AI token allowance. */
function TokenLimitBox({ limit, resetsAt, className }) {
  return (
    <div role="status" className={`flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 ${className}`}>
      <span className="mt-0.5 text-warning-fg"><Icon name="bolt" className="h-4 w-4" /></span>
      <div className="text-sm text-warning-fg">
        <p className="font-semibold">AI limit reached: {limit.label}</p>
        <p>{limit.message}</p>
        {resetsAt && <p className="mt-0.5 text-xs text-warning-fg">Available again {resetTime(resetsAt)}.</p>}
      </div>
    </div>
  );
}

/**
 * What the admins say about a tool: switched off ("temporarily unavailable",
 * with their message), the student's AI token allowance for it used up, or a
 * known issue while it still works.
 */
export default function FeatureNotice({ tool, className = 'mb-4' }) {
  const feature = useFeature(tool);
  const usage = useAiUsage();
  if (!tool) return null;
  const limit = usage?.tools.find((t) => t.tool === tool && t.reached);
  if (!feature.enabled) {
    return (
      <div role="status" className={`flex items-start gap-3 rounded-lg bg-sunken px-4 py-3 ${className}`}>
        <Icon name="info" className="mt-0.5 h-4 w-4 text-fg-subtle" />
        <div className="text-body">
          <p className="font-semibold text-fg">{feature.label || 'This tool'} is temporarily unavailable</p>
          <p className="text-fg-muted">{feature.message || 'We are working on it. Please try again later; everything you saved is safe.'}</p>
        </div>
      </div>
    );
  }
  if (limit) return <TokenLimitBox limit={limit} resetsAt={usage.resetsAt} className={className} />;
  if (feature.notice) {
    return (
      <div role="status" className={`flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 ${className}`}>
        <span className="mt-0.5 text-warning-fg"><Icon name="flag" className="h-4 w-4" /></span>
        <p className="text-sm text-warning-fg"><strong>We know about this: </strong>{feature.notice}</p>
      </div>
    );
  }
  return null;
}

/** The dashboard banner an admin can publish (Announcements). */
export function DashboardBanner() {
  const { status } = useAppStatus();
  if (!status.banner) return null;
  return (
    <div role="status" className="mb-6 flex items-start gap-3 rounded-lg bg-accent-soft px-4 py-3">
      <Icon name="info" className="mt-0.5 h-4 w-4 text-accent-fg" />
      <div className="text-body">
        {status.banner.title && <p className="font-semibold text-fg">{status.banner.title}</p>}
        {status.banner.body && <p className="text-fg-muted">{status.banner.body}</p>}
      </div>
    </div>
  );
}

/**
 * On the dashboard: every tool whose AI token allowance the student has used
 * up, and a heads-up for any that are nearly used up (80% or more).
 */
export function AiLimitBanner() {
  const usage = useAiUsage();
  if (!usage) return null;
  const reached = usage.tools.filter((t) => t.reached);
  const nearly = usage.tools.filter((t) => !t.reached && t.limit && t.used >= t.limit * 0.8);
  if (!reached.length && !nearly.length) return null;
  return (
    <div className="mb-6 space-y-3">
      {reached.map((t) => <TokenLimitBox key={t.tool} limit={t} resetsAt={usage.resetsAt} className="" />)}
      {nearly.length > 0 && (
        <div role="status" className="flex items-start gap-3 rounded-lg bg-warning-soft px-4 py-3">
          <Icon name="bolt" className="mt-0.5 h-4 w-4 text-warning-fg" />
          <div className="text-body text-fg-muted">
            <p className="font-semibold text-fg">Nearly at your AI limit</p>
            {nearly.map((t) => (
              <p key={t.tool}>{t.label}: {t.used.toLocaleString()} of {t.limit.toLocaleString()} tokens used this {usage.period}.</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Maintenance mode, shown on every page while it is on. */
export function MaintenanceNotice() {
  const { status } = useAppStatus();
  if (!status.maintenance?.enabled) return null;
  return (
    <div role="alert" className="fixed bottom-4 left-1/2 z-[65] w-[min(90vw,36rem)] -translate-x-1/2 rounded-xl border border-warning/30 bg-overlay px-4 py-3 shadow-popover">
      <p className="text-sm font-semibold text-fg">Novard-AI is under maintenance</p>
      <p className="text-sm text-fg-muted">{status.maintenance.message || 'Some features are unavailable for a short while. Please check back soon.'}</p>
    </div>
  );
}
