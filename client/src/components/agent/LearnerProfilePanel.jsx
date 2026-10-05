import React, { useEffect, useState } from 'react';
import { Input, Select, Textarea } from '../ui/Field';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Icon from '../ui/Icon';
import { ErrorState, Skeleton } from '../ui/States';
import TagInput from './TagInput';
import { agentApi } from '../../lib/agentStream';

/**
 * What the Novard Agent remembers about the student between chats. It fills
 * in drafts from this, so it asks fewer questions. Values guessed from their
 * earlier roadmaps and analyses are marked until the student saves them.
 * Shown inside the agent's conversation pane (in place of the chat).
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

const LearnerProfilePanel = ({ open, onClose }) => {
  const [state, setState] = useState({ loading: true, error: null, values: {}, derivedKeys: [] });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setMessage(null);
    setState((s) => ({ ...s, loading: true, error: null }));
    agentApi.getProfile()
      .then((data) => { if (alive) setState({ loading: false, error: null, values: data.profile || {}, derivedKeys: data.derivedKeys || [] }); })
      .catch((err) => { if (alive) setState((s) => ({ ...s, loading: false, error: err.message })); });
    return () => { alive = false; };
  }, [open]);

  if (!open) return null;

  const set = (key, v) => setState((s) => ({ ...s, values: { ...s.values, [key]: v } }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const body = Object.fromEntries(FIELDS.map((f) => {
        const v = state.values[f.key];
        return [f.key, v === '' || v === undefined || (Array.isArray(v) && !v.length) ? null : v];
      }));
      const data = await agentApi.saveProfile(body);
      setState({ loading: false, error: null, values: data.profile || {}, derivedKeys: data.derivedKeys || [] });
      setMessage({ ok: true, text: 'Saved. New chats and drafts will use this.' });
    } catch (err) {
      setMessage({ ok: false, text: err.message || 'Could not save your profile.' });
    } finally {
      setSaving(false);
    }
  };

  const field = (f) => {
    const id = `profile-${f.key}`;
    const v = state.values[f.key];
    const wide = f.type === 'tags' || f.type === 'textarea' || f.key === 'goal';
    return (
      <div key={f.key} className={wide ? 'sm:col-span-2' : ''}>
        <label htmlFor={id} className="mb-1.5 flex items-center gap-2 text-small font-medium text-fg">
          {f.label}
          {state.derivedKeys.includes(f.key) && <Badge tone="warning">guessed</Badge>}
        </label>
        {f.type === 'tags' && <TagInput id={id} value={v || []} max={f.max} onChange={(next) => set(f.key, next)} />}
        {f.type === 'select' && (
          <Select id={id} value={v || ''} onChange={(e) => set(f.key, e.target.value)}>
            <option value="">Not set</option>
            {f.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        )}
        {f.type === 'int' && <Input id={id} type="number" min={f.min} max={f.max} value={v ?? ''} onChange={(e) => set(f.key, e.target.value === '' ? '' : Number(e.target.value))} />}
        {f.type === 'text' && <Input id={id} value={v || ''} maxLength={f.max} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />}
        {f.type === 'textarea' && <Textarea id={id} rows={3} value={v || ''} maxLength={f.max} onChange={(e) => set(f.key, e.target.value)} />}
      </div>
    );
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-labelledby="learner-profile-title">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line-subtle px-3 sm:px-4">
        <button type="button" onClick={onClose} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-body text-fg-muted transition-colors hover:bg-sunken hover:text-fg">
          <Icon name="arrowLeft" className="h-4 w-4" />
          <span>Back to chat</span>
        </button>
        <span className="h-5 w-px bg-line" aria-hidden="true" />
        <Icon name="user" className="h-5 w-5 shrink-0 text-accent-fg" />
        <span className="truncate text-body font-medium text-fg">Learner profile</span>
      </header>

      {state.loading ? (
        <div className="mx-auto w-full max-w-3xl space-y-4 px-5 py-8" role="status" aria-label="Loading your learner profile">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
          <div className="grid gap-5 pt-4 sm:grid-cols-2">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        </div>
      ) : state.error ? (
        <ErrorState title="Your learner profile didn’t load" text={state.error} />
      ) : (
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
              <h2 id="learner-profile-title" className="text-display font-semibold text-fg">Your learner profile</h2>
              <p className="mt-1.5 max-w-2xl text-body text-fg-muted">
                What Novard Agent remembers about you between chats. It uses this to fill in drafts, so it asks fewer questions.
              </p>
              {state.derivedKeys.length > 0 && (
                <p className="mt-5 flex items-start gap-2.5 rounded-lg bg-warning-soft px-4 py-3 text-body text-warning-fg">
                  <Icon name="info" className="mt-0.5 h-4 w-4" />
                  <span>Fields marked <strong>guessed</strong> come from your roadmaps and analyses. Save to confirm them.</span>
                </p>
              )}
              <div className="mt-8 grid gap-x-6 gap-y-5 sm:grid-cols-2">{FIELDS.map(field)}</div>
            </div>
          </div>
          <div className="shrink-0 border-t border-line-subtle px-5 py-3 sm:px-8">
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-end gap-2">
              {message && <p className={`mr-auto text-small ${message.ok ? 'text-success-fg' : 'text-danger-fg'}`} role="status">{message.text}</p>}
              <Button variant="ghost" onClick={onClose}>Back to chat</Button>
              <Button type="submit" loading={saving} loadingLabel="Saving…">Save profile</Button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
};

export default LearnerProfilePanel;
