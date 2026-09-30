import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { ErrorNote, PageHeader, Section, ms, usd, when } from '../../components/admin/ui';
import DataTable from '../../components/ui/DataTable';
import { Icon, Spinner, btn } from '../../components/learning/LearningUI';
import useAdminData from '../../lib/useAdminData';
import { readAdminStream } from '../../lib/adminStream';

const SPINE = [['buildFeatures', 'Features'], ['scoreRisk', 'Score'], ['resolveRiskObject', 'Risk object']];
const LANES = [['temporal', 'Trend'], ['peers', 'Peers'], ['history', 'History'], ['semantic', 'What students say'], ['telemetry', 'AI, YouTube & PDF']];
const TAIL = [['rootCause', 'Root cause'], ['verifier', 'Review'], ['predictor', 'Outlook'], ['action', 'Action']];

function NodeBox({ label, steps }) {
  const done = steps.length > 0;
  const failed = steps.some((s) => s.error);
  const latency = steps.reduce((n, s) => n + (s.latencyMs || 0), 0);
  const cost = steps.reduce((n, s) => n + (s.usd || 0), 0);
  const tone = failed ? 'border-red-200 bg-red-50' : done ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white';
  return (
    <div className={`min-w-[120px] flex-1 rounded-lg border px-3 py-2 transition ${tone}`} aria-label={`${label}: ${failed ? 'failed' : done ? 'done' : 'waiting'}`}>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        {done ? <Icon name={failed ? 'x' : 'check'} className={`h-3.5 w-3.5 ${failed ? 'text-red-600' : 'text-blue-600'}`} strokeWidth={3} /> : <span className="h-2 w-2 rounded-full bg-gray-300" />}
        {label}{steps.length > 1 ? ` ×${steps.length}` : ''}
      </p>
      <p className="text-[11px] text-gray-500">{done ? `${ms(latency)}${cost ? ` · ${usd(cost)}` : ''}` : 'waiting'}</p>
    </div>
  );
}

const Arrow = () => <span className="hidden self-center text-gray-300 sm:block" aria-hidden="true">→</span>;

/** An investigation as it runs: the graph's nodes light up, with timing and cost per node and every model call. */
export default function LiveRun() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const [steps, setSteps] = useState([]);
  const [calls, setCalls] = useState([]);
  const [meta, setMeta] = useState(null);
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setSteps([]);
    setCalls([]);
    setDone(null);
    readAdminStream(`/api/admin/risk/runs/${runId}/stream`, {
      snapshot: setMeta,
      step: (s) => setSteps((list) => [...list, s]),
      call: (c) => setCalls((list) => [...list, c]),
      done: setDone,
    }, { signal: controller.signal }).catch((err) => {
      if (err.name !== 'AbortError') setError(err.message);
    });
    return () => controller.abort();
  }, [runId]);

  const byNode = useMemo(() => {
    const map = {};
    steps.forEach((s) => {
      const key = s.node === 'lane' ? `lane:${s.lane}` : s.node;
      map[key] = [...(map[key] || []), s];
    });
    return map;
  }, [steps]);
  const total = calls.reduce((n, c) => ({ usd: n.usd + (c.usd || 0), tokens: n.tokens + (c.tokensIn || 0) + (c.tokensOut || 0) }), { usd: 0, tokens: 0 });
  const monitored = Boolean(byNode.updateMonitor);

  return (
    <AdminLayout title="ADMIN · LIVE INVESTIGATION">
      <PageHeader
        title={meta ? `Investigating ${meta.area}` : 'Investigation'}
        subtitle={`${runId}${meta ? ` · started ${when(meta.startedAt)}` : ''} · ${calls.length} model call(s) · ${usd(total.usd)} · ${total.tokens.toLocaleString()} tokens`}
        actions={done?.assessmentId && <button type="button" onClick={() => navigate(`/admin/risk/assessments/${done.assessmentId}`)} className={btn.primary}>Open the findings</button>}
      />
      <ErrorNote error={error} />
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-600" role="status">
        {done ? (
          <><Icon name="check" className="h-4 w-4 text-blue-600" strokeWidth={3} /> Finished: {(done.outcome || done.status).replace(/_/g, ' ')}{done.degraded ? ' (degraded)' : ''}</>
        ) : <><Spinner className="h-4 w-4 text-blue-600" /> Running…</>}
      </div>

      <Section title="The graph" subtitle="Rules first (no tokens); models only for HIGH or CRITICAL risk">
        <div className="space-y-4 px-6 pb-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            {SPINE.map(([key, label], i) => (
              <React.Fragment key={key}>{i > 0 && <Arrow />}<NodeBox label={label} steps={byNode[key] || []} /></React.Fragment>
            ))}
          </div>
          {monitored ? (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">The risk is below HIGH: monitored, no investigation and no model call needed.</p>
          ) : (
            <>
              <NodeBox label="Supervisor" steps={byNode.supervisor || []} />
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {LANES.map(([lane, label]) => <NodeBox key={lane} label={label} steps={byNode[`lane:${lane}`] || []} />)}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {TAIL.map(([key, label], i) => (
                  <React.Fragment key={key}>{i > 0 && <Arrow />}<NodeBox label={label} steps={byNode[key] || []} /></React.Fragment>
                ))}
              </div>
            </>
          )}
        </div>
      </Section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="Steps">
          <DataTable
            rows={steps}
            rowKey={(s) => s._id || s.seq}
            empty="Waiting for the first step…"
            columns={[
              { key: 'seq', label: '#', className: 'tabular-nums text-gray-500' },
              { key: 'node', label: 'Node', render: (s) => `${s.node}${s.lane ? ` · ${s.lane}` : ''}` },
              { key: 'out', label: 'Result', render: (s) => <span className={`line-clamp-2 ${s.error ? 'text-red-600' : 'text-gray-700'}`}>{s.error || s.outputSummary || '–'}</span> },
              { key: 'ms', label: 'Time', className: 'tabular-nums', render: (s) => ms(s.latencyMs) },
            ]}
          />
        </Section>
        <Section title="Model calls">
          <DataTable
            rows={calls}
            rowKey={(c) => c._id}
            empty="No model calls yet."
            columns={[
              { key: 'model', label: 'Model', render: (c) => <span className="font-mono text-xs">{c.model}</span> },
              { key: 'task', label: 'Task', render: (c) => c.task || '–' },
              { key: 'outcome', label: 'Outcome' },
              { key: 'tokens', label: 'Tokens', className: 'tabular-nums', render: (c) => (c.tokensIn || 0) + (c.tokensOut || 0) },
              { key: 'usd', label: 'Cost', className: 'tabular-nums', render: (c) => usd(c.usd) },
              { key: 'ms', label: 'Time', className: 'tabular-nums', render: (c) => ms(c.latencyMs) },
            ]}
          />
        </Section>
      </div>
    </AdminLayout>
  );
}

/** Investigation history. */
export function Runs() {
  const { data, error, loading, reload } = useAdminData('/api/admin/risk/runs', { limit: 50 });
  const navigate = useNavigate();
  return (
    <AdminLayout title="ADMIN · INVESTIGATIONS">
      <PageHeader title="Investigations" subtitle="Every run, newest first" actions={<Link to="/admin/risk" className={btn.secondary}>Risk board</Link>} />
      <ErrorNote error={error} onRetry={reload} />
      <Section>
        <DataTable
          rows={data?.runs || []}
          rowKey={(r) => r.runId}
          empty={loading ? 'Loading…' : 'No investigations yet.'}
          onRowClick={(r) => navigate(r.status === 'running' ? `/admin/runs/${r.runId}` : `/admin/risk/assessments/${r._id}`)}
          columns={[
            { key: 'startedAt', label: 'Started', render: (r) => when(r.startedAt) },
            { key: 'area', label: 'Area', render: (r) => <span className="font-semibold text-gray-900">{r.area}</span> },
            { key: 'trigger', label: 'Trigger' },
            { key: 'outcome', label: 'Outcome', render: (r) => (r.outcome || r.status).replace(/_/g, ' ') + (r.degraded ? ' (degraded)' : '') },
            { key: 'lanes', label: 'Lanes', render: (r) => (r.lanesDone || []).length },
            { key: 'cost', label: 'Cost', className: 'tabular-nums', render: (r) => usd(r.budget?.usdUsed) },
            { key: 'tokens', label: 'Tokens', className: 'tabular-nums', render: (r) => (r.budget?.tokensUsed || 0).toLocaleString() },
          ]}
        />
      </Section>
    </AdminLayout>
  );
}
