import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { ErrorNote, LevelBadge, Loading, PageHeader, Section, StatusLight, usd, when } from '../../components/admin/ui';
import { Stat } from '../../components/profile/blocks';
import { Donut } from '../../components/profile/charts';
import { btn } from '../../components/learning/LearningUI';
import useAdminData from '../../lib/useAdminData';
import { LEVEL_COLORS } from '../../lib/statusColors';

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
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line-subtle ring-1 ring-line-subtle lg:grid-cols-4">
            <Stat label="Users" value={data.users.total} sub={`${data.users.activeToday} active today · ${data.users.newToday} new`} accent="bg-accent" />
            <Stat label="Open reports" value={data.reports.open} sub={`${data.reports.urgent} urgent · ${data.reports.today} today`} accent={data.reports.urgent ? 'bg-danger' : 'bg-accent'} />
            <Stat label="AI spend today" value={usd(data.ai.spendToday)} sub={data.ai.dailyCap ? `of ${usd(data.ai.dailyCap)} daily cap` : 'no daily cap set'} accent="bg-accent" />
            <Stat label="Areas at risk" value={data.risk.levels.HIGH + data.risk.levels.CRITICAL} sub={`${data.risk.levels.MEDIUM} medium · ${data.risk.levels.LOW} low`} accent={data.risk.levels.CRITICAL ? 'bg-danger' : data.risk.levels.HIGH ? 'bg-warning' : 'bg-success'} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Section title="Risk by area" subtitle="Latest level of every app area" right={<Link to="/admin/risk" className="text-xs font-semibold text-accent-fg hover:underline">Risk board</Link>} className="lg:col-span-2">
              <div className="flex flex-col items-center gap-6 px-6 pb-6 sm:flex-row sm:items-start">
                <Donut
                  segments={Object.entries(data.risk.levels).map(([label, value]) => ({ label, value, color: LEVEL_COLORS[label] }))}
                  centerValue={data.risk.areas.length}
                  centerLabel="areas"
                />
                <ul className="grid flex-1 gap-2 sm:grid-cols-2">
                  {data.risk.areas.map((a) => (
                    <li key={a.area}>
                      <button type="button" onClick={() => navigate(`/admin/risk/${a.area}`)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm hover:bg-sunken">
                        <span className="truncate text-fg">{a.label}</span>
                        <LevelBadge level={a.level} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </Section>

            <Section title="Gateways" subtitle="Last hour" right={<Link to="/admin/gateways" className="text-xs font-semibold text-accent-fg hover:underline">Details</Link>}>
              <ul className="divide-y divide-line-subtle px-6 pb-4">
                {Object.entries(data.gateways).map(([id, status]) => (
                  <li key={id} className="flex items-center justify-between py-2.5 text-sm">
                    <Link to={`/admin/gateways/${id}`} className="text-fg hover:text-accent-fg">{GATEWAY_NAMES[id] || id}</Link>
                    <StatusLight status={status} />
                  </li>
                ))}
              </ul>
            </Section>
          </div>

          <Section title="Recent investigations" right={<Link to="/admin/runs" className="text-xs font-semibold text-accent-fg hover:underline">All runs</Link>}>
            {data.runs.length === 0 ? <p className="px-6 pb-6 text-sm text-fg-subtle">No investigations yet. Open an area on the risk board and run one.</p> : (
              <ul className="divide-y divide-line-subtle px-6 pb-4">
                {data.runs.map((r) => (
                  <li key={r.runId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <Link to={`/admin/runs/${r.runId}`} className="font-medium text-fg hover:text-accent-fg">{r.area}</Link>
                    <span className="text-xs text-fg-subtle">{r.outcome ? r.outcome.replace(/_/g, ' ') : r.status} · {usd(r.budget?.usdUsed)} · {when(r.startedAt)}</span>
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
