import React, { useEffect, useState } from 'react';
import TagInput from './TagInput';
import { agentApi } from '../../lib/agentStream';

/**
 * What the Novard Agent remembers about the student between chats. It fills
 * in drafts from this, so it asks fewer questions. Values guessed from their
 * earlier roadmaps and analyses are marked until the student saves them.
 */

const FIELDS = [
  { key: 'targetRole', label: 'Target role', type: 'text', max: 80, placeholder: 'e.g. DevOps Engineer' },
  { key: 'level', label: 'Level', type: 'select', options: [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['experienced', 'Experienced']] },
  { key: 'experience', label: 'Experience', type: 'select', options: [['student', 'Student'], ['junior', 'Junior (0-2 years)'], ['switching', 'Switching careers'], ['experienced', 'Experienced professional']] },
  { key: 'knownSkills', label: 'Skills you have', type: 'tags', max: 40 },
  { key: 'interests', label: 'Interests', type: 'tags', max: 20 },
  { key: 'hoursPerWeek', label: 'Hours per week', type: 'int', min: 1, max: 60 },
  { key: 'timelineMonths', label: 'Timeline (months)', type: 'int', min: 1, max: 24 },
  { key: 'goal', label: 'Goal', type: 'text', max: 240, placeholder: 'e.g. land a job at a product company' },
  { key: 'language', label: 'Preferred language', type: 'select', options: ['English', 'Spanish', 'French', 'Hindi', 'Tamil'].map((l) => [l, l]) },
  { key: 'teachingStyle', label: 'Teaching style', type: 'select', options: ['Standard', 'Fast-paced', 'In-depth', 'Practical'].map((s) => [s, s]) },
  { key: 'notes', label: 'Anything else the agent should know', type: 'textarea', max: 500 },
];

const inputClass = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

const LearnerProfilePanel = ({ open, onClose }) => {
  const [state, setState] = useState({ loading: true, error: null, values: {}, derivedKeys: [] });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setMessage('');
    setState((s) => ({ ...s, loading: true, error: null }));
    agentApi.getProfile()
      .then((data) => { if (alive) setState({ loading: false, error: null, values: data.profile || {}, derivedKeys: data.derivedKeys || [] }); })
      .catch((err) => { if (alive) setState((s) => ({ ...s, loading: false, error: err.message })); });
    return () => { alive = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = (key, v) => setState((s) => ({ ...s, values: { ...s.values, [key]: v } }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const body = Object.fromEntries(FIELDS.map((f) => {
        const v = state.values[f.key];
        return [f.key, v === '' || v === undefined || (Array.isArray(v) && !v.length) ? null : v];
      }));
      const data = await agentApi.saveProfile(body);
      setState({ loading: false, error: null, values: data.profile || {}, derivedKeys: data.derivedKeys || [] });
      setMessage('Saved. New chats and drafts will use this.');
    } catch (err) {
      setMessage(err.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close learner profile" />
      <aside role="dialog" aria-modal="true" aria-labelledby="learner-profile-title" className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id="learner-profile-title" className="text-base font-semibold text-gray-900">Your learner profile</h2>
            <p className="mt-0.5 text-xs text-gray-500">Novard Agent uses this to fill in drafts and ask fewer questions.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Close">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {state.loading ? (
          <div className="space-y-4 p-5" aria-label="Loading profile">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-gray-100" />)}
          </div>
        ) : state.error ? (
          <p className="p-5 text-sm text-red-600" role="alert">{state.error}</p>
        ) : (
          <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {state.derivedKeys.length > 0 && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Fields marked <strong>guessed</strong> come from your roadmaps and analyses. Save to confirm them.</p>
              )}
              {FIELDS.map((f) => {
                const id = `profile-${f.key}`;
                const v = state.values[f.key];
                return (
                  <div key={f.key}>
                    <label htmlFor={id} className="mb-1 flex items-center gap-2 text-xs font-semibold text-gray-600">
                      {f.label}
                      {state.derivedKeys.includes(f.key) && <span className="rounded bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">guessed</span>}
                    </label>
                    {f.type === 'tags' && <TagInput id={id} value={v || []} max={f.max} onChange={(next) => set(f.key, next)} />}
                    {f.type === 'select' && (
                      <select id={id} value={v || ''} onChange={(e) => set(f.key, e.target.value)} className={inputClass}>
                        <option value="">Not set</option>
                        {f.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    )}
                    {f.type === 'int' && <input id={id} type="number" min={f.min} max={f.max} value={v ?? ''} onChange={(e) => set(f.key, e.target.value === '' ? '' : Number(e.target.value))} className={`${inputClass} w-32`} />}
                    {f.type === 'text' && <input id={id} value={v || ''} maxLength={f.max} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} className={inputClass} />}
                    {f.type === 'textarea' && <textarea id={id} rows={3} value={v || ''} maxLength={f.max} onChange={(e) => set(f.key, e.target.value)} className={`${inputClass} resize-y`} />}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-5 py-3">
              {message && <p className="mr-auto text-xs text-gray-600" role="status">{message}</p>}
              <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100">Close</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
};

export default LearnerProfilePanel;
