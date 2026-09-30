import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { ErrorNote, LevelBadge, Loading, PageHeader, Section, StatusLight, usd, when } from '../../components/admin/ui';
import { Stat } from '../../components/profile/blocks';
import { Donut } from '../../components/profile/charts';
import { btn } from '../../components/learning/LearningUI';
import useAdminData from '../../lib/useAdminData';

const LEVEL_COLORS = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444', CRITICAL: '#b91c1c' };
const GATEWAY_NAMES = { groq: 'Groq (AI)', gemini: 'Gemini (AI)', youtube: 'YouTube', oauth: 'Google sign-in', mongodb: 'MongoDB' };

/** Platform health at a glance. */
export default function Overview() {
  const { data, error, loading, reload } = useAdminData('/api/admin/overview');
  const navigate = useNavigate();

  return (
    <AdminLayout title="ADMIN · OVERVIEW">
      <PageHeader
        title="Overview"
        subtitle={data?.risk?.lastRescanAt ? `Risk scores from ${when(data.risk.lastRescanAt)}` : 'Platform health at a glance'}
        actions={<button type="button" onClick={reload} className={btn.secondary}>Refresh</button>}
      />
      <ErrorNote error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Users" value={data.users.total} sub={`${data.users.activeToday} active today · ${data.users.newToday} new`} accent="bg-primary-500" />
            <Stat label="Open reports" value={data.reports.open} sub={`${data.reports.urgent} urgent · ${data.reports.today} today`} accent={data.reports.urgent ? 'bg-red-500' : 'bg-primary-500'} />
            <Stat label="AI spend today" value={usd(data.ai.spendToday)} sub={data.ai.dailyCap ? `of ${usd(data.ai.dailyCap)} daily cap` : 'no daily cap set'} accent="bg-primary-500" />
            <Stat label="Areas at risk" value={data.risk.levels.HIGH + data.risk.levels.CRITICAL} sub={`${data.risk.levels.MEDIUM} medium · ${data.risk.levels.LOW} low`} accent={data.risk.levels.CRITICAL ? 'bg-red-500' : data.risk.levels.HIGH ? 'bg-amber-500' : 'bg-emerald-500'} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Section title="Risk by area" subtitle="Latest level of every app area" right={<Link to="/admin/risk" className="text-xs font-semibold text-blue-600 hover:underline">Risk board</Link>} className="lg:col-span-2">
              <div className="flex flex-col items-center gap-6 px-6 pb-6 sm:flex-row sm:items-start">
                <Donut
                  segments={Object.entries(data.risk.levels).map(([label, value]) => ({ label, value, color: LEVEL_COLORS[label] }))}
                  centerValue={data.risk.areas.length}
                  centerLabel="areas"
                />
                <ul className="grid flex-1 gap-2 sm:grid-cols-2">
                  {data.risk.areas.map((a) => (
                    <li key={a.area}>
                      <button type="button" onClick={() => navigate(`/admin/risk/${a.area}`)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-50">
                        <span className="truncate text-gray-800">{a.label}</span>
                        <LevelBadge level={a.level} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </Section>

            <Section title="Gateways" subtitle="Last hour" right={<Link to="/admin/gateways" className="text-xs font-semibold text-blue-600 hover:underline">Details</Link>}>
              <ul className="divide-y divide-gray-100 px-6 pb-4">
                {Object.entries(data.gateways).map(([id, status]) => (
                  <li key={id} className="flex items-center justify-between py-2.5 text-sm">
                    <Link to={`/admin/gateways/${id}`} className="text-gray-800 hover:text-blue-600">{GATEWAY_NAMES[id] || id}</Link>
                    <StatusLight status={status} />
                  </li>
                ))}
              </ul>
            </Section>
          </div>

          <Section title="Recent investigations" right={<Link to="/admin/runs" className="text-xs font-semibold text-blue-600 hover:underline">All runs</Link>}>
            {data.runs.length === 0 ? <p className="px-6 pb-6 text-sm text-gray-500">No investigations yet. Open an area on the risk board and run one.</p> : (
              <ul className="divide-y divide-gray-100 px-6 pb-4">
                {data.runs.map((r) => (
                  <li key={r.runId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <Link to={`/admin/runs/${r.runId}`} className="font-medium text-gray-900 hover:text-blue-600">{r.area}</Link>
                    <span className="text-xs text-gray-500">{r.outcome ? r.outcome.replace(/_/g, ' ') : r.status} · {usd(r.budget?.usdUsed)} · {when(r.startedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </AdminLayout>
  );
}
