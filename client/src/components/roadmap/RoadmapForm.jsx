import React, { useEffect, useRef, useState } from 'react';
import Icon from '../ui/Icon';
import Spinner from '../ui/Spinner';
import { buttonClass } from '../ui/Button';
import { fieldClass } from '../ui/Field';
import { ROLE_SUGGESTIONS } from '../../lib/referenceRoadmaps';

const LEVELS = [
  { value: 'beginner', label: 'Complete beginner', hint: 'New to programming and the field' },
  { value: 'intermediate', label: 'Know the basics', hint: 'Built small things, not job-ready yet' },
  { value: 'experienced', label: 'Switching roles', hint: 'Working professional changing tracks' },
];
const HOURS = [5, 10, 20, 40];
const MONTHS = [3, 6, 9, 12];
const DEFAULTS = { role: '', level: 'beginner', hoursPerWeek: 10, timelineMonths: 6, knownSkills: [], goal: '' };

// Shown while the roadmap is generated, so the wait reads as progress.
const PROGRESS = [
  'Mapping the skills this role needs…',
  'Ordering them into stages…',
  'Fitting the plan to your schedule…',
  'Adding a project for every stage…',
  'Drawing your roadmap…',
];

const Choice = ({ active, onClick, children, className = '' }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={`rounded text-left ring-1 ring-inset transition-colors duration-150 ${active
      ? 'bg-accent-soft ring-accent/40'
      : 'bg-raised ring-line hover:bg-sunken hover:ring-line-strong'} ${className}`}
  >
    {children}
  </button>
);

/** Inputs for a personalised roadmap: the role, starting point, time, known skills and goal. */
const RoadmapForm = ({ onSubmit, generating = false, error = null, initial = null }) => {
  const [form, setForm] = useState({ ...DEFAULTS, ...(initial || {}) });
  const [skillDraft, setSkillDraft] = useState('');
  const [touched, setTouched] = useState(false);
  const [step, setStep] = useState(0);
  const roleRef = useRef(null);

  useEffect(() => { setForm({ ...DEFAULTS, ...(initial || {}) }); }, [initial]);
  useEffect(() => { roleRef.current?.focus(); }, []);

  useEffect(() => {
    if (!generating) { setStep(0); return undefined; }
    const t = setInterval(() => setStep((s) => Math.min(PROGRESS.length - 1, s + 1)), 4500);
    return () => clearInterval(t);
  }, [generating]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const roleError = touched && form.role.trim().length < 2 ? 'Enter the role you want to reach.' : null;

  const addSkill = (raw) => {
    const parts = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    setForm((f) => {
      const existing = new Set(f.knownSkills.map((s) => s.toLowerCase()));
      const next = [...f.knownSkills];
      parts.forEach((p) => { if (!existing.has(p.toLowerCase()) && next.length < 20) { next.push(p.slice(0, 40)); existing.add(p.toLowerCase()); } });
      return { ...f, knownSkills: next };
    });
    setSkillDraft('');
  };

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (form.role.trim().length < 2 || generating) return;
    const pending = skillDraft.trim();
    const knownSkills = pending ? [...form.knownSkills, ...pending.split(',').map((s) => s.trim()).filter(Boolean)] : form.knownSkills;
    onSubmit({ ...form, role: form.role.trim(), goal: form.goal.trim(), knownSkills });
  };

  const label = 'mb-2 block text-small font-medium text-fg';

  return (
    <form onSubmit={submit} className="space-y-7" noValidate>
      <div>
        <h2 className="text-display font-semibold text-fg">New roadmap</h2>
        <p className="mt-1.5 max-w-2xl text-body text-fg-muted">
          Say where you want to go and how much time you have. You get a stage-by-stage path that fits
          your schedule, drawn as a diagram.
        </p>
      </div>

      <div>
        <label htmlFor="roadmap-role" className="mb-1.5 block text-small font-medium text-fg">
          Which role do you want to reach? <span className="text-danger-fg" aria-hidden="true">*</span>
        </label>
        <input
          id="roadmap-role"
          ref={roleRef}
          type="text"
          maxLength={80}
          value={form.role}
          onChange={(e) => set({ role: e.target.value })}
          placeholder="e.g. Frontend Developer"
          className={`${fieldClass(Boolean(roleError))} h-10`}
          aria-invalid={Boolean(roleError)}
        />
        {roleError && <p className="mt-1 text-xs text-danger-fg">{roleError}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {ROLE_SUGGESTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => set({ role: r })}
              aria-pressed={form.role === r}
              className={`rounded-full px-2.5 py-1 text-caption font-medium ring-1 ring-inset transition-colors ${form.role === r
                ? 'bg-accent-soft text-accent-fg ring-accent/40'
                : 'text-fg-muted ring-line hover:text-fg hover:ring-line-strong'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <fieldset>
        <legend className={label}>Your starting point</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {LEVELS.map((l) => (
            <Choice key={l.value} active={form.level === l.value} onClick={() => set({ level: l.value })} className="px-3 py-2.5">
              <div className="text-sm font-semibold text-fg">{l.label}</div>
              <div className="text-xs text-fg-subtle">{l.hint}</div>
            </Choice>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <fieldset>
          <legend className={label}>Hours per week</legend>
          <div className="flex gap-2">
            {HOURS.map((h) => (
              <Choice key={h} active={form.hoursPerWeek === h} onClick={() => set({ hoursPerWeek: h })} className="flex-1 py-2 text-center text-sm font-semibold text-fg">
                {h}h
              </Choice>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className={label}>Target timeline</legend>
          <div className="flex gap-2">
            {MONTHS.map((m) => (
              <Choice key={m} active={form.timelineMonths === m} onClick={() => set({ timelineMonths: m })} className="flex-1 py-2 text-center text-sm font-semibold text-fg">
                {m} mo
              </Choice>
            ))}
          </div>
        </fieldset>
      </div>

      <div>
        <label htmlFor="roadmap-skills" className={label}>
          Skills you already have <span className="font-normal text-fg-subtle">(optional: marked as known, not taught again)</span>
        </label>
        <div className="flex min-h-[2.75rem] flex-wrap items-center gap-1.5 rounded bg-raised px-2.5 py-1.5 ring-1 ring-inset ring-line transition-shadow hover:ring-line-strong focus-within:ring-2 focus-within:ring-focus">
          {form.knownSkills.map((s) => (
            <span key={s} className="inline-flex h-6 items-center gap-1 rounded-sm bg-sunken pl-2 pr-1 text-small text-fg ring-1 ring-inset ring-line-subtle">
              {s}
              <button
                type="button"
                aria-label={`Remove ${s}`}
                onClick={() => set({ knownSkills: form.knownSkills.filter((k) => k !== s) })}
                className="rounded-sm p-0.5 text-fg-subtle hover:bg-line hover:text-fg"
              >
                <Icon name="x" className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            id="roadmap-skills"
            type="text"
            value={skillDraft}
            onChange={(e) => (e.target.value.includes(',') ? addSkill(e.target.value) : setSkillDraft(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); addSkill(skillDraft); }
              if (e.key === 'Backspace' && !skillDraft && form.knownSkills.length) set({ knownSkills: form.knownSkills.slice(0, -1) });
            }}
            onBlur={() => addSkill(skillDraft)}
            placeholder={form.knownSkills.length ? 'Add another…' : 'e.g. HTML, Git, Python - press Enter after each'}
            className="min-w-[12rem] flex-1 bg-transparent py-1 text-body text-fg placeholder:text-fg-subtle focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label htmlFor="roadmap-goal" className={label}>
          Your goal <span className="font-normal text-fg-subtle">(optional)</span>
        </label>
        <input
          id="roadmap-goal"
          type="text"
          maxLength={200}
          value={form.goal}
          onChange={(e) => set({ goal: e.target.value })}
          placeholder="e.g. Land a first job at a product startup, or start freelancing"
          className={`${fieldClass(false)} h-9`}
        />
      </div>

      {error && <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-body text-danger-fg">{error}</p>}

      <button
        type="submit"
        disabled={generating}
        className={buttonClass({ variant: 'primary', size: 'lg', block: true, className: 'sm:w-auto' })}
      >
        {generating ? (
          <>
            <Spinner className="h-4 w-4" />
            <span aria-live="polite">{PROGRESS[step]}</span>
          </>
        ) : 'Generate my roadmap'}
      </button>
    </form>
  );
};

export default RoadmapForm;
