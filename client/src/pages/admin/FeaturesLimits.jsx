import React, { useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import SettingEditor from '../../components/admin/SettingEditor';
import { ErrorNote, Loading, PageHeader } from '../../components/admin/ui';
import { TabBar, btn, fieldClass } from '../../components/learning/LearningUI';
import useAdminData from '../../lib/useAdminData';
import { adminPut } from '../../lib/adminApi';

// The AI tasks an admin can route to a model (server/config/ai.js TASKS).
const AI_TASKS = ['report_enrich', 'report_transcribe', 'report_embed', 'risk_supervisor', 'risk_lane', 'risk_root_cause', 'risk_verifier', 'admin_assistant'];

const GROUPS = [
  { id: 'features', label: 'Features', icon: 'settings', text: 'Switch tools off (students see your message), post a "we know about this" notice, or put the whole app in maintenance.' },
  { id: 'limits', label: 'Rate limits', icon: 'bolt', text: 'Requests per minute and sign-in attempts. Applied on the next request, no restart.' },
  { id: 'reports', label: 'Reports & areas', icon: 'flag', text: 'The report quota, and the app areas reports and risk are counted against.' },
  { id: 'risk', label: 'Risk', icon: 'chart', text: 'Level thresholds, cold-start rules, investigation budget and automatic investigations.' },
  { id: 'tokens', label: 'Token limits', icon: 'bolt', text: 'How many AI tokens each student may use per tool. Empty means unlimited. A student at the limit is told so in the tool, on their dashboard and in the bell, and the rest of the app keeps working.' },
  { id: 'ai', label: 'AI', icon: 'sparkles', text: 'Models, fail-over and limits (also on the Groq and Gemini gateway pages).' },
];

const PERIODS = [['day', 'Per day'], ['week', 'Per week (resets Monday)'], ['month', 'Per month (resets on the 1st)']];

/** Tokens each student may use per tool, and over what period. */
function TokenLimitsEditor({ setting, save, reset }) {
  const [period, setPeriod] = useState(setting.value.period);
  const [limits, setLimits] = useState(() => Object.fromEntries(Object.entries(setting.value.perStudent).map(([tool, n]) => [tool, n ? String(n) : ''])));
  const tools = Object.keys(setting.value.perStudent);
  return (
    <SettingEditor
      title="Token limits per student"
      description={setting.description}
      source={setting.source}
      value={setting.value}
      editable={setting.editable}
      onSave={() => save({ period, perStudent: Object.fromEntries(tools.map((tool) => [tool, Number(limits[tool]) || 0])) })}
      onReset={reset}
    >
      <label className="block text-sm text-gray-700">Limit period (UTC)
        <select value={period} onChange={(e) => setPeriod(e.target.value)} disabled={!setting.editable} className={`${fieldClass(false)} mt-1 w-64 py-1.5`}>
          {PERIODS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-y border-gray-100 bg-gray-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500"><th className="px-3 py-2">Tool</th><th className="px-3 py-2">Tokens per student</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {tools.map((tool) => (
              <tr key={tool}>
                <td className="px-3 py-2 text-gray-800">{setting.labels?.[tool] || tool}</td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={limits[tool]}
                    placeholder="Unlimited"
                    onChange={(e) => setLimits((l) => ({ ...l, [tool]: e.target.value }))}
                    disabled={!setting.editable}
                    aria-label={`Token limit for ${setting.labels?.[tool] || tool}`}
                    className={`${fieldClass(false)} w-40 py-1`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-500">A summary of a long PDF can use 20,000 tokens or more; a chat reply usually uses 1,000-4,000. Problem reports are never limited.</p>
    </SettingEditor>
  );
}

/** The app areas list: rename, merge, or add an area. */
function AreasEditor({ setting, save }) {
  const [areas, setAreas] = useState(setting.value.areas);
  const [max, setMax] = useState(setting.value.maxOpenPerArea);
  const update = (i, patch) => setAreas((list) => list.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  return (
    <SettingEditor
      title="Reports"
      description={setting.description}
      source={setting.source}
      value={setting.value}
      editable={setting.editable}
      onSave={() => save({ maxOpenPerArea: Number(max), areas })}
    >
      <label className="block text-sm text-gray-700">Open reports a student may have per area
        <input type="number" min="1" max="20" value={max} onChange={(e) => setMax(e.target.value)} className={`${fieldClass(false)} mt-1 w-32 py-1.5`} />
      </label>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-y border-gray-100 bg-gray-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500"><th className="px-3 py-2">Id</th><th className="px-3 py-2">Label</th><th className="px-3 py-2">Merged into</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {areas.map((a, i) => (
              <tr key={a.id}>
                <td className="px-3 py-2 font-mono text-xs">{a.id}</td>
                <td className="px-3 py-2"><input value={a.label} onChange={(e) => update(i, { label: e.target.value })} className={`${fieldClass(false)} py-1`} aria-label={`Label for ${a.id}`} /></td>
                <td className="px-3 py-2">
                  <select value={a.mergedInto || ''} onChange={(e) => update(i, { mergedInto: e.target.value || null })} className={`${fieldClass(false)} py-1`} aria-label={`Merge ${a.id} into`}>
                    <option value="">(its own area)</option>
                    {areas.filter((b) => b.id !== a.id).map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => { const id = window.prompt('New area id (lowercase, e.g. "mock-tests")'); if (id) setAreas((l) => [...l, { id: id.trim(), label: id.trim(), mergedInto: null }]); }} className={`${btn.ghost} mt-2`}>Add an area</button>
    </SettingEditor>
  );
}

/** Every runtime setting, grouped. */
export default function FeaturesLimits() {
  const { data, error, loading, reload } = useAdminData('/api/admin/settings');
  const [group, setGroup] = useState('features');
  const save = (key) => async (value) => { await adminPut(`/api/admin/settings/${key}`, { value }); await reload(); };
  const reset = (key) => async () => { await adminPut(`/api/admin/settings/${key}`, { reset: true }); await reload(); };
  const settings = (data?.settings || []).filter((s) => (group === 'ai' ? ['ai', 'gateways'].includes(s.group) : s.group === group));
  const current = GROUPS.find((g) => g.id === group);

  return (
    <AdminLayout title="ADMIN · FEATURES & LIMITS">
      <PageHeader title="Features & limits" subtitle="Changes apply on every server within 30 seconds, and are audited." />
      <div className="mb-4 overflow-x-auto"><TabBar tabs={GROUPS.map(({ id, label, icon }) => ({ id, label, icon }))} active={group} onChange={setGroup} /></div>
      <p className="mb-4 text-sm text-gray-600">{current.text}</p>
      <ErrorNote error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {settings.map((s) => {
            if (s.key === 'reports') return <AreasEditor key={s.key} setting={s} save={save(s.key)} />;
            // Keyed by updatedAt so its form picks up a saved or reset value.
            if (s.key === 'ai.tokenLimits') return <TokenLimitsEditor key={`${s.key}-${s.updatedAt || 'default'}`} setting={s} save={save(s.key)} reset={reset(s.key)} />;
            return (
              <SettingEditor
                key={s.key}
                title={s.key.replace(/^features\./, '').replace(/^\w/, (c) => c.toUpperCase())}
                description={s.description}
                value={s.value}
                source={s.source}
                critical={s.critical}
                editable={s.editable}
                mapKeys={s.key === 'ai.routes' ? AI_TASKS : undefined}
                unlimited={s.unlimited}
                onSave={save(s.key)}
                onReset={reset(s.key)}
              />
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
