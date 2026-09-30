import React from 'react';
import { Icon } from './learning/LearningUI';
import { useAppStatus, useFeature } from '../context/AppStatusContext';

/**
 * What the admins say about a tool: switched off ("temporarily unavailable",
 * with their message), or a known issue while it still works.
 */
export default function FeatureNotice({ tool, className = 'mb-4' }) {
  const feature = useFeature(tool);
  if (!tool) return null;
  if (!feature.enabled) {
    return (
      <div role="status" className={`flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm ${className}`}>
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500"><Icon name="x" className="h-3.5 w-3.5" strokeWidth={2.5} /></span>
        <div className="text-sm">
          <p className="font-semibold text-gray-900">{feature.label || 'This tool'} is temporarily unavailable</p>
          <p className="text-gray-600">{feature.message || 'We are working on it. Please try again later; everything you saved is safe.'}</p>
        </div>
      </div>
    );
  }
  if (feature.notice) {
    return (
      <div role="status" className={`flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 ${className}`}>
        <span className="mt-0.5 text-amber-600"><Icon name="flag" className="h-4 w-4" /></span>
        <p className="text-sm text-amber-900"><strong>We know about this: </strong>{feature.notice}</p>
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
    <div role="status" className="mb-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-5 py-4">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 ring-1 ring-blue-100"><Icon name="sparkles" className="h-4 w-4" /></span>
      <div className="text-sm">
        {status.banner.title && <p className="font-semibold text-gray-900">{status.banner.title}</p>}
        {status.banner.body && <p className="text-gray-700">{status.banner.body}</p>}
      </div>
    </div>
  );
}

/** Maintenance mode, shown on every page while it is on. */
export function MaintenanceNotice() {
  const { status } = useAppStatus();
  if (!status.maintenance?.enabled) return null;
  return (
    <div role="alert" className="fixed bottom-4 left-1/2 z-[65] w-[min(90vw,36rem)] -translate-x-1/2 rounded-xl border border-amber-200 bg-white px-4 py-3 shadow-lg">
      <p className="text-sm font-semibold text-gray-900">Novard-AI is under maintenance</p>
      <p className="text-sm text-gray-600">{status.maintenance.message || 'Some features are unavailable for a short while. Please check back soon.'}</p>
    </div>
  );
}
