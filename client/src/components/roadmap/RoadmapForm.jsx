import React, { useEffect, useRef, useState } from 'react';
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
    className={`rounded-lg border-2 text-left transition-colors ${active
      ? 'border-blue-600 bg-blue-50'
      : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-gray-50'} ${className}`}
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

  const label = 'block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2';

  return (
    <form onSubmit={submit} className="max-w-3xl mx-auto space-y-7" noValidate>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Generate your personalised roadmap</h2>
        <p className="text-sm text-gray-600 mt-1">
          Tell us where you want to go and how much time you have. The AI designs a stage-by-stage path,
          fitted to your schedule, and draws it as a flow diagram.
        </p>
      </div>

      <div>
        <label htmlFor="roadmap-role" className="block text-sm font-semibold text-gray-900 mb-1.5">
          Which role do you want to reach? <span className="text-red-500">*</span>
        </label>
        <input
          id="roadmap-role"
          ref={roleRef}
          type="text"
          maxLength={80}
          value={form.role}
          onChange={(e) => set({ role: e.target.value })}
          placeholder="e.g. Frontend Developer"
          className={`w-full px-4 py-3 text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${roleError ? 'border-red-400' : 'border-gray-300'}`}
          aria-invalid={Boolean(roleError)}
        />
        {roleError && <p className="mt-1 text-xs text-red-600">{roleError}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {ROLE_SUGGESTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => set({ role: r })}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${form.role === r
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'}`}
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
              <div className="text-sm font-semibold text-gray-900">{l.label}</div>
              <div className="text-xs text-gray-500">{l.hint}</div>
            </Choice>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <fieldset>
          <legend className={label}>Hours per week</legend>
          <div className="flex gap-2">
            {HOURS.map((h) => (
              <Choice key={h} active={form.hoursPerWeek === h} onClick={() => set({ hoursPerWeek: h })} className="flex-1 py-2 text-center text-sm font-semibold text-gray-900">
                {h}h
              </Choice>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className={label}>Target timeline</legend>
          <div className="flex gap-2">
            {MONTHS.map((m) => (
              <Choice key={m} active={form.timelineMonths === m} onClick={() => set({ timelineMonths: m })} className="flex-1 py-2 text-center text-sm font-semibold text-gray-900">
                {m} mo
              </Choice>
            ))}
          </div>
        </fieldset>
      </div>

      <div>
        <label htmlFor="roadmap-skills" className={label}>
          Skills you already have <span className="normal-case font-normal text-gray-400">(optional - they will be marked, not re-taught)</span>
        </label>
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-500">
          {form.knownSkills.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-xs font-medium text-green-800">
              {s}
              <button
                type="button"
                aria-label={`Remove ${s}`}
                onClick={() => set({ knownSkills: form.knownSkills.filter((k) => k !== s) })}
                className="text-green-700 hover:text-green-900"
              >
                ×
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
            className="flex-1 min-w-[12rem] py-1 text-sm focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label htmlFor="roadmap-goal" className={label}>
          Your goal <span className="normal-case font-normal text-gray-400">(optional)</span>
        </label>
        <input
          id="roadmap-goal"
          type="text"
          maxLength={200}
          value={form.goal}
          onChange={(e) => set({ goal: e.target.value })}
          placeholder="e.g. Land a first job at a product startup, or start freelancing"
          className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
        />
      </div>

      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      <button
        type="submit"
        disabled={generating}
        className="w-full px-6 py-3.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-70 transition-colors flex items-center justify-center gap-2"
      >
        {generating ? (
          <>
            <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" />
            <span aria-live="polite">{PROGRESS[step]}</span>
          </>
        ) : 'Generate my roadmap'}
      </button>
    </form>
  );
};

export default RoadmapForm;
