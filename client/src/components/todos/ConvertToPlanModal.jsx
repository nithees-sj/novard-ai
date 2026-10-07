import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { Field, Input, Select, Textarea } from '../ui/Field';
import { SegmentedControl } from '../ui/Tabs';
import { todosApi } from '../../lib/todos';

const MIN_DAYS = 10;
const MAX_DAYS = 60;
const LEVELS = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
];

/** The tasks the plan will follow: the open ones, or all when everything is ticked off. */
const planTasks = (items) => {
  const open = items.filter((i) => !i.done);
  return open.length ? open : items;
};

function initialForm(list) {
  const tasks = planTasks(list.items);
  const goal = list.description || `Work through: ${tasks.map((t) => t.text).join('; ')}`;
  return {
    skillName: list.title.slice(0, 100),
    level: 'beginner',
    duration: String(Math.min(MAX_DAYS, Math.max(MIN_DAYS, tasks.length))),
    description: goal.slice(0, 1000),
    language: 'English',
    teachingStyle: 'Standard',
  };
}

/**
 * Turn a todo list into a Skill Unlocker plan: a day-by-day plan with a video
 * per day whose days follow the list's tasks, in order.
 */
export default function ConvertToPlanModal({ open, list, onClose, onConverted }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => initialForm(list));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [existingPlan, setExistingPlan] = useState(null);
  const [done, setDone] = useState(null); // the new plan

  useEffect(() => {
    if (!open) return;
    setForm(initialForm(list)); setBusy(false); setError(''); setExistingPlan(null); setDone(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only when it opens

  const tasks = useMemo(() => planTasks(list.items), [list.items]);
  const days = Number(form.duration);
  const daysError = !Number.isInteger(days) || days < MIN_DAYS || days > MAX_DAYS ? `Choose ${MIN_DAYS} to ${MAX_DAYS} days.` : '';
  const invalid = !form.skillName.trim() || !form.description.trim() || Boolean(daysError);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));

  const submit = async (e) => {
    e.preventDefault();
    if (invalid || busy) return;
    setBusy(true); setError(''); setExistingPlan(null);
    try {
      const result = await todosApi.toSkillPlan(list._id, {
        skillName: form.skillName.trim(),
        duration: days,
        description: form.description.trim(),
        preferences: { level: form.level, language: form.language, teachingStyle: form.teachingStyle },
      });
      setDone(result.plan);
      onConverted(result.list, result.plan);
    } catch (err) {
      if (err.data?.code === 'ALREADY_CONVERTED') setExistingPlan(err.data.details?.planId || null);
      setError(err.message || 'The plan could not be created. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const openPlan = (id) => navigate(`/skill-unlocker?open=${id}`);

  if (done) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Your Skill Plan is ready"
        footer={(
          <>
            <Button variant="ghost" onClick={onClose}>Stay here</Button>
            <Button icon="plan" onClick={() => openPlan(done._id)}>Open the plan</Button>
          </>
        )}
      >
        <div className="flex items-start gap-3">
          <Icon name="success" className="mt-0.5 h-5 w-5 text-success-fg" />
          <p className="text-body text-fg-muted">
            <span className="font-medium text-fg">{done.skillName}</span> is now a {done.duration}-day plan in Skill Plans, with a video for each day.
            This list stays here and links to it.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!busy}
      size="lg"
      title="Turn this list into a Skill Plan"
      description="Skill Unlocker builds a day-by-day plan, with a video for each day, that works through your tasks in order."
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="todo-to-plan" icon="plan" loading={busy} loadingLabel="Building your plan…" disabled={invalid}>Create plan</Button>
        </>
      )}
    >
      <form id="todo-to-plan" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <Field id="plan-skill" label="Skill or subject" required>
            <Input id="plan-skill" value={form.skillName} onChange={set('skillName')} maxLength={100} data-autofocus />
          </Field>
          <Field id="plan-days" label="Days" required error={daysError}>
            <Input id="plan-days" type="number" min={MIN_DAYS} max={MAX_DAYS} value={form.duration} onChange={set('duration')} invalid={Boolean(daysError)} />
          </Field>
        </div>
        <Field id="plan-goal" label="By the end I want to" required count={form.description.length} max={1000}>
          <Textarea id="plan-goal" rows={3} value={form.description} onChange={set('description')} maxLength={1000} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="mb-1.5 text-small font-medium text-fg">Level</p>
            <SegmentedControl options={LEVELS} value={form.level} onChange={set('level')} label="Level" size="sm" className="w-full" />
          </div>
          <Field id="plan-language" label="Language">
            <Select id="plan-language" value={form.language} onChange={set('language')}>
              {['English', 'Spanish', 'French', 'Hindi', 'Tamil'].map((l) => <option key={l} value={l}>{l}</option>)}
            </Select>
          </Field>
          <Field id="plan-style" label="Teaching style">
            <Select id="plan-style" value={form.teachingStyle} onChange={set('teachingStyle')}>
              <option value="Standard">Standard · balanced</option>
              <option value="Fast-paced">Fast-paced · crash course</option>
              <option value="In-depth">Deep dive · theory first</option>
              <option value="Practical">Hands-on · project based</option>
            </Select>
          </Field>
        </div>

        <div className="rounded-lg bg-sunken px-3 py-2.5">
          <p className="text-small font-medium text-fg">The plan follows {tasks.length === 1 ? 'this task' : `these ${tasks.length} tasks`}</p>
          <ol className="mt-1.5 max-h-40 list-decimal space-y-0.5 overflow-y-auto pl-5 text-small text-fg-muted">
            {tasks.map((t) => <li key={t._id}>{t.text}</li>)}
          </ol>
          {tasks.length > MAX_DAYS && <p className="mt-1.5 text-caption text-fg-subtle">Only the first {MAX_DAYS} tasks fit in a plan.</p>}
        </div>

        {busy && <p role="status" className="text-small text-fg-muted">This takes up to a minute: each day gets its own video.</p>}
        {error && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg bg-danger-soft px-3 py-2 text-body text-danger-fg">
            <span className="min-w-0 flex-1">{error}</span>
            {existingPlan && <Button size="sm" variant="secondary" onClick={() => openPlan(existingPlan)}>Open it</Button>}
          </div>
        )}
      </form>
    </Modal>
  );
}
