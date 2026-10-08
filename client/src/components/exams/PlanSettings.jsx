import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import cx from '../ui/cx';
import { localToday } from '../../lib/todos';
import { WEEKDAYS } from '../../lib/exams';

const MINUTES = [30, 45, 60, 90, 120, 150, 180, 240];
const TARGETS = [60, 65, 70, 75, 80, 85, 90];

/** The plan's settings in one dialog; saving re-plans every day from today. */
export default function PlanSettings({ exam, open, onClose, onSave, saving }) {
  const [form, setForm] = useState(exam);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setForm(exam); setError(''); } }, [open, exam]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleRest = (d) => set({ restDays: form.restDays.includes(d) ? form.restDays.filter((x) => x !== d) : [...form.restDays, d].sort() });

  const save = async () => {
    if (!form.examDate || form.examDate <= localToday()) return setError('The exam date must be after today.');
    if (form.restDays.length > 5) return setError('Keep at least two study days a week.');
    const patch = {};
    ['title', 'examDate', 'dailyMinutes', 'targetReadiness'].forEach((k) => { if (form[k] !== exam[k]) patch[k] = form[k]; });
    if (form.restDays.join() !== exam.restDays.join()) patch.restDays = form.restDays;
    if (!Object.keys(patch).length) return onClose();
    return onSave(patch).then((ok) => ok && onClose());
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Plan settings"
      description="Autopilot re-plans every day from today when you save."
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving} loadingLabel="Re-planning…">Save and re-plan</Button>
        </>
      )}
    >
      <div className="space-y-5">
        <Field id="ps-title" label="Exam">
          <Input id="ps-title" value={form.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field id="ps-date" label="Exam date">
            <Input id="ps-date" type="date" value={form.examDate} onChange={(e) => set({ examDate: e.target.value })} />
          </Field>
          <Field id="ps-minutes" label="Study time a day">
            <Select id="ps-minutes" value={form.dailyMinutes} onChange={(e) => set({ dailyMinutes: Number(e.target.value) })}>
              {MINUTES.map((m) => <option key={m} value={m}>{m} min</option>)}
            </Select>
          </Field>
          <Field id="ps-target" label="Target readiness">
            <Select id="ps-target" value={form.targetReadiness} onChange={(e) => set({ targetReadiness: Number(e.target.value) })}>
              {TARGETS.map((t) => <option key={t} value={t}>{t}%</option>)}
            </Select>
          </Field>
        </div>
        <Field id="ps-rest" label="Rest days" hint="No study is planned on these days.">
          <div id="ps-rest" className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((d, i) => (
              <button
                key={d}
                type="button"
                aria-pressed={form.restDays.includes(i)}
                onClick={() => toggleRest(i)}
                className={cx('h-9 rounded-md text-small ring-1 ring-inset transition-colors', form.restDays.includes(i) ? 'bg-accent-soft font-medium text-accent-fg ring-accent' : 'text-fg-muted ring-line hover:bg-sunken')}
              >
                {d}
              </button>
            ))}
          </div>
        </Field>
        {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-small text-danger-fg">{error}</p>}
      </div>
    </Modal>
  );
}
