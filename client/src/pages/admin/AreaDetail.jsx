import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { DriverList, ErrorNote, LevelBadge, Loading, PageHeader, Section, pct, usd, when } from '../../components/admin/ui';
import DataTable from '../../components/ui/DataTable';
import { BarList, ColumnChart, LineChart } from '../../components/profile/charts';
import { Badge, Spinner, btn } from '../../components/learning/LearningUI';
import useAdminData from '../../lib/useAdminData';
import { adminPost } from '../../lib/adminApi';
import { errorMessage } from '../../lib/api';
import { LEVEL_COLORS } from '../../lib/statusColors';

const short = (d) => d.slice(5);

/** One area: 28 days of signals, what drives its score, its reports, and its investigations. */
const VERDICT = { severe: ['red', 'Severe complaint'], complaint: ['amber', 'Complaint'], none: ['gray', 'Not a risk'] };
/** What the report's text says, as the complaint rule reads it. */
const RiskVerdict = ({ risk }) => {
  const [tone, label] = VERDICT[risk] || VERDICT.none;
  return <Badge tone={tone}>{label}</Badge>;
};

/** "5 unresolved complaints in 7 days (3 severe) from 4 students: HIGH by the complaint rule." */
function complaintNote(c) {
  if (!c?.complaints) return '';
  const rule = c.level && c.level !== 'LOW' ? `: ${c.level} by the complaint rule` : '';
  return `${c.complaints} unresolved complaint${c.complaints === 1 ? '' : 's'} in ${c.windowDays} days${c.severe ? ` (${c.severe} severe)` : ''} from ${c.reporters} student${c.reporters === 1 ? '' : 's'}${rule}. Newest first.`;
}

export default function AreaDetail() {
  const { area } = useParams();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useAdminData(`/api/admin/risk/areas/${area}`);
  const [starting, setStarting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const investigate = async () => {
    setStarting(true);
    setActionError(null);
    try {
      const { runId } = await adminPost(`/api/admin/risk/areas/${area}/assess`);
      navigate(`/admin/runs/${runId}`);
    } catch (err) {
      setActionError(errorMessage(err, 'The investigation could not start.'));
      setStarting(false);
    }
  };

  const t = data?.thresholds;
  const thresholdLines = t ? [
    { value: t.MEDIUM, label: 'MEDIUM', color: LEVEL_COLORS.MEDIUM },
    { value: t.HIGH, label: 'HIGH', color: LEVEL_COLORS.HIGH },
    { value: t.CRITICAL, label: 'CRITICAL', color: LEVEL_COLORS.CRITICAL },
  ] : [];

  return (
    <AdminLayout title="ADMIN · RISK BOARD">
      <PageHeader
        title={data ? data.label : 'Area'}
        subtitle={data?.latest ? `Window ending ${data.latest.windowEnd?.slice(0, 10)} · score ${data.latest.score.toFixed(3)} · thresholds from ${t?.from}` : 'Risk detail'}
        actions={(
          <>
            <Link to="/admin/risk" className={btn.secondary}>All areas</Link>
            <button type="button" onClick={investigate} disabled={starting} className={btn.primary}>{starting ? <><Spinner /> Starting…</> : 'Run investigation'}</button>
          </>
        )}
      />
      <ErrorNote error={error || actionError} onRetry={error ? reload : undefined} />
      {loading && !data ? <Loading /> : data && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <LevelBadge level={data.latest?.level} />
            {data.latest?.status === 'insufficient_baseline' && <Badge tone="blue">Too little history yet: fixed thresholds</Badge>}
            <DriverList drivers={data.latest?.drivers || []} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Risk score" subtitle="Last 28 days, with the level thresholds in force">
              <div className="px-6 pb-6"><LineChart points={data.scores.map((s) => ({ label: short(s.d), value: Number(s.score.toFixed(3)), sub: `${s.d} · ${s.level}` }))} max={1} decimals={2} thresholds={thresholdLines} caption="Risk score" /></div>
            </Section>
            <Section title="Reports per day">
              <div className="px-6 pb-6"><ColumnChart bars={data.series.map((d) => ({ label: short(d.d), value: d.reports, sub: d.d }))} caption="Reports per day" /></div>
            </Section>
            <Section title="AI error rate" subtitle="Share of this area's AI calls that failed">
              <div className="px-6 pb-6"><LineChart points={data.series.filter((d) => d.aiErrorRate !== null).map((d) => ({ label: short(d.d), value: Math.round(d.aiErrorRate * 100), sub: `${d.d} · ${d.aiCalls} calls` }))} max={100} unit="%" caption="AI error rate" emptyText="This area makes no AI calls" /></div>
            </Section>
            <Section title="What drives the score" subtitle="Each signal's deviation from this area's own baseline (σ)">
              <div className="px-6 pb-6">
                <BarList
                  rows={(data.latest?.attribution || []).filter((a) => a.z > 0).slice(0, 8).map((a) => ({ label: a.label, value: Number(a.z.toFixed(1)), max: 6, note: pct(a.share), color: a.z >= 3 ? 'bg-red-500' : a.z >= 1.5 ? 'bg-amber-500' : 'bg-primary-500' }))}
                  max={6}
                  unit="σ"
                  emptyText="Nothing unusual in this window."
                />
              </div>
            </Section>
          </div>

          <Section title="Open reports" subtitle={complaintNote(data.latest?.complaints) || 'Newest first'} right={<Link to={`/admin/reports?area=${area}`} className="text-xs font-semibold text-blue-600 hover:underline">Inbox</Link>}>
            <DataTable
              rowKey={(r) => r.ref}
              onRowClick={(r) => navigate(`/admin/reports/${r.ref}`)}
              empty="No open reports in this area."
              rows={data.openReports}
              columns={[
                { key: 'ref', label: 'Report', render: (r) => <span className="font-semibold text-gray-900">{r.ref}</span> },
                { key: 'text', label: 'What they said', render: (r) => <span className="line-clamp-2 max-w-xl text-gray-700">{r.text}</span> },
                { key: 'risk', label: 'Counts as', render: (r) => <RiskVerdict risk={r.risk} /> },
                { key: 'urgency', label: 'Urgency', render: (r) => r.enrichment?.urgency || '–' },
                { key: 'topic', label: 'Topic', render: (r) => r.enrichment?.topic || '–' },
                { key: 'createdAt', label: 'Sent', render: (r) => when(r.createdAt) },
              ]}
            />
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Investigations">
              <DataTable
                rowKey={(r) => r.runId}
                onRowClick={(r) => navigate(r.status === 'running' ? `/admin/runs/${r.runId}` : `/admin/risk/assessments/${r._id}`)}
                empty="No investigations yet."
                rows={data.assessments}
                columns={[
                  { key: 'startedAt', label: 'Started', render: (r) => when(r.startedAt) },
                  { key: 'outcome', label: 'Outcome', render: (r) => (r.outcome || r.status).replace(/_/g, ' ') + (r.degraded ? ' (degraded)' : '') },
                  { key: 'cause', label: 'Top cause', render: (r) => <span className="line-clamp-2 text-gray-700">{r.topCause || '–'}</span> },
                  { key: 'cost', label: 'Cost', render: (r) => usd(r.budget?.usdUsed) },
                ]}
              />
            </Section>
            <Section title="Tracked risks and precedents">
              <ul className="divide-y divide-gray-100 px-6 pb-4 text-sm">
                {data.riskObjects.map((o) => (
                  <li key={o._id} className="py-2.5">
                    <p className="font-medium text-gray-900">{o.topic} <span className="text-xs font-normal text-gray-500">· {o.state}{o.flagged ? ' · flagged' : ''} · peak {o.peakScore.toFixed(2)}</span></p>
                    <p className="text-xs text-gray-500">first seen {when(o.firstDetectedAt)}, last {when(o.lastSeenAt)}</p>
                  </li>
                ))}
                {data.precedents.map((p) => (
                  <li key={p._id} className="py-2.5">
                    <p className="text-gray-800">Before: {p.cause}</p>
                    <p className="text-xs text-gray-500">{p.resolution} ({when(p.closedAt)})</p>
                  </li>
                ))}
                {!data.riskObjects.length && !data.precedents.length && <li className="py-4 text-gray-500">Nothing tracked yet.</li>}
              </ul>
            </Section>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
