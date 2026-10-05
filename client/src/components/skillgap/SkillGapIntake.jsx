import React, { useEffect, useRef, useState } from 'react';
import Icon from '../ui/Icon';
import Spinner from '../ui/Spinner';
import { buttonClass } from '../ui/Button';
import { fieldClass } from '../ui/Field';
import { ROLE_SUGGESTIONS } from '../../lib/referenceRoadmaps';

const EXPERIENCE = [
  { value: 'student', label: 'Student / beginner' },
  { value: 'junior', label: 'Early career (0-2 yrs)' },
  { value: 'switching', label: 'Switching fields' },
  { value: 'experienced', label: 'Experienced engineer' },
];
const HOURS = [5, 10, 20, 30];
const DEFAULTS = { targetRole: '', currentSkills: [], experience: 'student', goal: '', hoursPerWeek: 10 };

const PROGRESS = ['Reading your profile…', 'Listing what the role needs…', 'Comparing it with your skills…', 'Ranking your gaps…'];

/** A few quick questions that start a skill-gap coaching chat. */
const SkillGapIntake = ({ onStart, starting = false, error = null, initial = null }) => {
  const [form, setForm] = useState({ ...DEFAULTS, ...(initial || {}) });
  const [draft, setDraft] = useState('');
  const [touched, setTouched] = useState(false);
  const [step, setStep] = useState(0);
  const roleRef = useRef(null);

  useEffect(() => { setForm({ ...DEFAULTS, ...(initial || {}) }); }, [initial]);
  useEffect(() => { roleRef.current?.focus(); }, []);
  useEffect(() => {
    if (!starting) { setStep(0); return undefined; }
    const t = setInterval(() => setStep((s) => Math.min(PROGRESS.length - 1, s + 1)), 3500);
    return () => clearInterval(t);
  }, [starting]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const addSkills = (raw) => {
    const parts = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    setForm((f) => {
      const have = new Set(f.currentSkills.map((s) => s.toLowerCase()));
      const next = [...f.currentSkills];
      parts.forEach((p) => { if (!have.has(p.toLowerCase()) && next.length < 30) { next.push(p.slice(0, 40)); have.add(p.toLowerCase()); } });
      return { ...f, currentSkills: next };
    });
    setDraft('');
  };

  const roleError = touched && form.targetRole.trim().length < 2;

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (form.targetRole.trim().length < 2 || starting) return;
    const pending = draft.split(',').map((s) => s.trim()).filter(Boolean);
    onStart({ ...form, targetRole: form.targetRole.trim(), goal: form.goal.trim(), currentSkills: [...form.currentSkills, ...pending] });
  };

  const label = 'mb-2 block text-small font-medium text-fg';
  const chip = (active) =>
    `rounded ring-1 ring-inset text-small font-medium transition-colors duration-150 ${active
      ? 'bg-accent-soft text-accent-fg ring-accent/40'
      : 'bg-raised text-fg-muted ring-line hover:text-fg hover:ring-line-strong'}`;

  return (
    <form onSubmit={submit} className="space-y-7" noValidate>
      <div>
        <h2 className="text-display font-semibold text-fg">New skill gap analysis</h2>
        <p className="mt-1.5 max-w-2xl text-body text-fg-muted">
          Answer a few questions. The coach compares your skills with what the role needs, ranks the gaps,
          then you can talk through what to learn and how.
        </p>
      </div>

      <div>
        <label htmlFor="gap-role" className="mb-1.5 block text-small font-medium text-fg">
          What role are you aiming for? <span className="text-danger-fg" aria-hidden="true">*</span>
        </label>
        <input
          id="gap-role"
          ref={roleRef}
          type="text"
          maxLength={80}
          value={form.targetRole}
          onChange={(e) => set({ targetRole: e.target.value })}
          placeholder="e.g. Backend Developer"
          className={`${fieldClass(roleError)} h-10`}
          aria-invalid={roleError}
        />
        {roleError && <p className="mt-1 text-xs text-danger-fg">Tell me which role you're aiming for.</p>}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {ROLE_SUGGESTIONS.slice(0, 10).map((r) => (
            <button key={r} type="button" onClick={() => set({ targetRole: r })}
              aria-pressed={form.targetRole === r}
              className={`rounded-full px-2.5 py-1 text-caption font-medium ring-1 ring-inset transition-colors ${form.targetRole === r ? 'bg-accent-soft text-accent-fg ring-accent/40' : 'text-fg-muted ring-line hover:text-fg hover:ring-line-strong'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="gap-skills" className="mb-1.5 block text-small font-medium text-fg">
          Which skills do you have right now?
        </label>
        <div className="flex min-h-[2.75rem] flex-wrap items-center gap-1.5 rounded bg-raised px-2.5 py-1.5 ring-1 ring-inset ring-line transition-shadow hover:ring-line-strong focus-within:ring-2 focus-within:ring-focus">
          {form.currentSkills.map((s) => (
            <span key={s} className="inline-flex h-6 items-center gap-1 rounded-sm bg-sunken pl-2 pr-1 text-small text-fg ring-1 ring-inset ring-line-subtle">
              {s}
              <button type="button" aria-label={`Remove ${s}`} onClick={() => set({ currentSkills: form.currentSkills.filter((k) => k !== s) })} className="rounded-sm p-0.5 text-fg-subtle hover:bg-line hover:text-fg"><Icon name="x" className="h-3 w-3" /></button>
            </span>
          ))}
          <input
            id="gap-skills"
            type="text"
            value={draft}
            onChange={(e) => (e.target.value.includes(',') ? addSkills(e.target.value) : setDraft(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); addSkills(draft); }
              if (e.key === 'Backspace' && !draft && form.currentSkills.length) set({ currentSkills: form.currentSkills.slice(0, -1) });
            }}
            onBlur={() => addSkills(draft)}
            placeholder={form.currentSkills.length ? 'Add another…' : 'e.g. Python, SQL, Git - press Enter after each'}
            className="min-w-[12rem] flex-1 bg-transparent py-1 text-body text-fg placeholder:text-fg-subtle focus:outline-none"
          />
        </div>
        <p className="mt-1.5 text-caption text-fg-subtle">Include languages, tools and frameworks. Leave it empty if you're starting from zero.</p>
      </div>

      <fieldset>
        <legend className={label}>Your background</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {EXPERIENCE.map((x) => (
            <button key={x.value} type="button" aria-pressed={form.experience === x.value} onClick={() => set({ experience: x.value })} className={`${chip(form.experience === x.value)} px-2 py-2.5 text-xs`}>
              {x.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <fieldset>
          <legend className={label}>Hours per week to learn</legend>
          <div className="flex gap-2">
            {HOURS.map((h) => (
              <button key={h} type="button" aria-pressed={form.hoursPerWeek === h} onClick={() => set({ hoursPerWeek: h })} className={`${chip(form.hoursPerWeek === h)} flex-1 py-2`}>{h}h</button>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="gap-goal" className={label}>Goal <span className="font-normal text-fg-subtle">(optional)</span></label>
          <input
            id="gap-goal"
            type="text"
            maxLength={240}
            value={form.goal}
            onChange={(e) => set({ goal: e.target.value })}
            placeholder="e.g. First job in 6 months"
            className={`${fieldClass(false)} h-9`}
          />
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-body text-danger-fg">{error}</p>}

      <button
        type="submit"
        disabled={starting}
        className={buttonClass({ variant: 'primary', size: 'lg', block: true, className: 'sm:w-auto' })}
      >
        {starting ? (
          <>
            <Spinner className="h-4 w-4" />
            <span aria-live="polite">{PROGRESS[step]}</span>
          </>
        ) : 'Analyse my skills'}
      </button>
    </form>
  );
};

export default SkillGapIntake;
