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
  { id: 'ai', label: 'AI', icon: 'sparkles', text: 'Models, fail-over and limits (also on the Groq and Gemini gateway pages).' },
];

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
          {settings.map((s) => (s.key === 'reports'
            ? <AreasEditor key={s.key} setting={s} save={save(s.key)} />
            : (
              <SettingEditor
                key={s.key}
                title={s.key.replace(/^features\./, '').replace(/^\w/, (c) => c.toUpperCase())}
                description={s.description}
                value={s.value}
                source={s.source}
                critical={s.critical}
                editable={s.editable}
                mapKeys={s.key === 'ai.routes' ? AI_TASKS : undefined}
                onSave={save(s.key)}
                onReset={reset(s.key)}
              />
            )))}
        </div>
      )}
    </AdminLayout>
  );
}
