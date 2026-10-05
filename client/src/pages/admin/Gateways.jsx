import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import SettingEditor from '../../components/admin/SettingEditor';
import { ErrorNote, Loading, PageHeader, Section, StatusLight, ms, pct, usd } from '../../components/admin/ui';
import DataTable from '../../components/ui/DataTable';
import { ColumnChart, LineChart } from '../../components/profile/charts';
import { Spinner, btn } from '../../components/learning/LearningUI';
import useAdminData from '../../lib/useAdminData';
import { adminPost, adminPut } from '../../lib/adminApi';
import { errorMessage } from '../../lib/api';
import { useAdminAuth } from '../../AdminAuthContext';

const KEY_NOTE = 'API keys are never shown or changed here. They live in the server environment (server/.env, or Secret Manager on Cloud Run); only whether one is set and its last 4 characters are shown.';

/** Every outside service, its status and key state. */
export default function Gateways() {
  const { data, error, loading, reload } = useAdminData('/api/admin/gateways');
  const navigate = useNavigate();
  return (
    <AdminLayout title="ADMIN · GATEWAYS">
      <PageHeader title="Gateways" subtitle="The outside services Novard-AI depends on (status from the last hour)" />
      <ErrorNote error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(data?.gateways || []).map((g) => (
              <button key={g.id} type="button" onClick={() => navigate(`/admin/gateways/${g.id}`)} className="rounded-xl border border-line bg-raised p-5 text-left transition hover:border-accent/30 hover:bg-accent-soft/30">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-fg">{g.name}</h2>
                  <StatusLight status={g.status} />
                </div>
                <p className="mt-1 text-xs text-fg-subtle">{g.kind === 'ai' ? 'AI provider' : g.kind === 'database' ? 'Database' : 'Outside service'}</p>
                {g.key && <p className="mt-3 text-xs text-fg-muted">API key: {g.key.configured ? <>set, ends in <span className="font-mono">…{g.key.last4}</span></> : <span className="text-danger-fg">missing</span>}</p>}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-fg-subtle">{KEY_NOTE}</p>
        </>
      )}
    </AdminLayout>
  );
}

function TestButton({ id }) {
  const [state, setState] = useState(null);
  const run = async () => {
    setState({ busy: true });
    try {
      setState(await adminPost(`/api/admin/gateways/${id}/test`));
    } catch (err) {
      setState({ ok: false, result: errorMessage(err, 'The test failed.') });
    }
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={run} disabled={state?.busy} className={btn.secondary}>{state?.busy ? <Spinner /> : null}Test</button>
      {state && !state.busy && <span role="status" className={`text-xs ${state.ok ? 'text-success-fg' : 'text-danger-fg'}`}>{state.ok ? 'Working' : 'Failed'}{state.latencyMs !== undefined ? ` in ${ms(state.latencyMs)}` : ''}: {state.result}</span>}
    </span>
  );
}

const WindowTable = ({ windows, ai, rejected }) => (
  <DataTable
    rowKey={(r) => r.range}
    rows={Object.entries(windows || {}).map(([range, w]) => ({ range, ...w }))}
    columns={ai ? [
      { key: 'range', label: 'Window' },
      { key: 'calls', label: 'Calls', className: 'tabular-nums' },
      { key: 'errorRate', label: 'Errors', render: (w) => pct(w.errorRate, 1) },
      { key: 'rateLimited', label: '429s', className: 'tabular-nums' },
      { key: 'dailyQuota', label: 'Daily quota hit', className: 'tabular-nums' },
      { key: 'p50Ms', label: 'p50', render: (w) => ms(w.p50Ms) },
      { key: 'p95Ms', label: 'p95', render: (w) => ms(w.p95Ms) },
      { key: 'usd', label: 'Spend', render: (w) => usd(w.usd) },
    ] : [
      { key: 'range', label: 'Window' },
      { key: 'events', label: 'Calls', className: 'tabular-nums' },
      { key: 'ok', label: 'OK', className: 'tabular-nums' },
      { key: 'failed', label: 'Failed', className: 'tabular-nums' },
      ...(rejected ? [{ key: 'rejected', label: 'Rejected tokens', className: 'tabular-nums' }] : []),
      { key: 'failureRate', label: 'Failure rate', render: (w) => pct(w.failureRate, 1) },
      { key: 'p95Ms', label: 'p95', render: (w) => ms(w.p95Ms) },
    ]}
  />
);

const SETTING_TITLES = {
  'ai.providers': ['Providers', 'Switch a provider off: its features show "temporarily unavailable".'],
  'ai.tiers': ['Models for the existing features', 'The REASONING and FAST models every tool uses.'],
  'ai.routes': ['Model per task', 'Early-warning and assistant tasks. Empty = the default in config/ai.js.'],
  'ai.failover': ['Fail-over order', 'Models to try when one has used up its daily quota.'],
  'ai.params': ['Parameters', 'reasoning_effort for gpt-oss, a multiplier on every max_tokens, and an optional temperature for all calls.'],
  'ai.limits': ['Limits', 'Per-student AI requests per day and a global daily USD cap (0 = off). At the cap, non-essential features pause.'],
  'risk.budget': ['Investigation budget', 'Per run; lanes calling a model at once (Groq allows ~8k tokens/minute per model).'],
  assistant: ['Admin assistant', 'USD cap and model steps per turn.'],
  'gateways.youtube': ['YouTube', 'Switch YouTube search, captions and metadata off.'],
};

/** One gateway: health numbers, charts, its settings and a Test call. */
export function GatewayDetail() {
  const { id } = useParams();
  const { admin } = useAdminAuth();
  const { data: g, error, loading, reload } = useAdminData(`/api/admin/gateways/${id}`);
  const ai = g?.kind === 'ai';
  const critical = ['ai.limits', 'risk.budget'];
  const save = (key) => async (value) => { await adminPut(`/api/admin/gateways/${id}/settings`, { key, value }); await reload(); };

  return (
    <AdminLayout title="ADMIN · GATEWAYS">
      <PageHeader title={g?.name || 'Gateway'} subtitle={g ? <StatusLight status={g.status} /> : ''} actions={<><Link to="/admin/gateways" className={btn.secondary}>All gateways</Link><TestButton id={id} /></>} />
      <ErrorNote error={error} onRetry={reload} />
      {loading && !g ? <Loading /> : g && (
        <div className="space-y-6">
          {g.key && <p className="text-sm text-fg-muted">API key: {g.key.configured ? <>set, ends in <span className="font-mono">…{g.key.last4}</span></> : <span className="text-danger-fg">missing</span>}. {KEY_NOTE}</p>}
          {g.windows && <Section title="Health"><WindowTable windows={g.windows} ai={ai} rejected={g.id === 'oauth'} /></Section>}

          {ai && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Section title="Calls per day" subtitle="Last 30 days"><div className="px-6 pb-6"><ColumnChart bars={g.daily.map((d) => ({ label: d.d.slice(5), value: d.calls, sub: d.d }))} caption="Calls per day" /></div></Section>
              <Section title="Error rate" subtitle="Last 30 days"><div className="px-6 pb-6"><LineChart points={g.daily.map((d) => ({ label: d.d.slice(5), value: Math.round(d.errorRate * 100), sub: d.d }))} max={100} unit="%" caption="Error rate" /></div></Section>
              <Section title="By model" subtitle="Last 7 days"><DataTable rowKey={(r) => r.model} rows={g.byModel} empty="No calls." columns={[{ key: 'model', label: 'Model', render: (r) => <span className="font-mono text-xs">{r.model}</span> }, { key: 'calls', label: 'Calls' }, { key: 'errorRate', label: 'Errors', render: (r) => pct(r.errorRate, 1) }, { key: 'p95Ms', label: 'p95', render: (r) => ms(r.p95Ms) }, { key: 'usd', label: 'Spend', render: (r) => usd(r.usd) }]} /></Section>
              <Section title="By feature" subtitle="Last 7 days"><DataTable rowKey={(r) => r.feature} rows={g.byFeature} empty="No calls." columns={[{ key: 'feature', label: 'Feature' }, { key: 'calls', label: 'Calls' }, { key: 'errorRate', label: 'Errors', render: (r) => pct(r.errorRate, 1) }, { key: 'usd', label: 'Spend', render: (r) => usd(r.usd) }]} /></Section>
            </div>
          )}
          {g.byOperation && <Section title="By operation" subtitle="Last 7 days"><DataTable rowKey={(r) => r.operation} rows={g.byOperation} empty="No calls." columns={[{ key: 'operation', label: 'Operation' }, { key: 'events', label: 'Calls' }, { key: 'failed', label: 'Failed' }, { key: 'missing', label: 'No captions' }, { key: 'failureRate', label: 'Failure rate', render: (r) => pct(r.failureRate, 1) }]} /></Section>}
          {g.clientIds && <Section title="OAuth client IDs" subtitle={g.note}><ul className="px-6 pb-6 font-mono text-xs text-fg-muted">{g.clientIds.map((c) => <li key={c}>{c}</li>)}</ul></Section>}
          {g.collections && <Section title={`Database ${g.database} (${g.state})`}><DataTable rowKey={(r) => r.name} rows={g.collections} columns={[{ key: 'name', label: 'Collection' }, { key: 'documents', label: 'Documents', className: 'tabular-nums' }]} /></Section>}

          {g.editableSettings?.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              {g.editableSettings.filter((key) => !(id === 'gemini' && key === 'ai.routes')).map((key) => (
                <SettingEditor
                  key={key}
                  title={SETTING_TITLES[key]?.[0] || key}
                  description={SETTING_TITLES[key]?.[1]}
                  value={g.settings[key]}
                  critical={critical.includes(key)}
                  editable={!critical.includes(key) || admin?.role === 'superadmin'}
                  mapKeys={key === 'ai.routes' ? g.reference?.tasks : undefined}
                  unlimited={g.reference?.unlimited?.[key]}
                  onSave={save(key)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
