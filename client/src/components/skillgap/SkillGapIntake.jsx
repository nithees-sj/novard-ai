import React, { useEffect, useRef, useState } from 'react';
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

  const label = 'block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2';
  const chip = (active) =>
    `rounded-lg border-2 text-sm font-semibold transition-colors ${active
      ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
      : 'border-gray-200 bg-white text-gray-800 hover:border-indigo-200'}`;

  return (
    <form onSubmit={submit} className="max-w-2xl mx-auto space-y-6" noValidate>
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 shrink-0 rounded-full bg-indigo-600 text-white flex items-center justify-center text-lg" aria-hidden="true">🧭</div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Skill gap coach</h2>
          <p className="text-sm text-gray-600 mt-1">
            Answer a few quick questions. I'll compare your skills with what the role needs, show you the gaps,
            and then we can chat about what to learn and how.
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="gap-role" className="block text-sm font-semibold text-gray-900 mb-1.5">
          What role are you aiming for? <span className="text-red-500">*</span>
        </label>
        <input
          id="gap-role"
          ref={roleRef}
          type="text"
          maxLength={80}
          value={form.targetRole}
          onChange={(e) => set({ targetRole: e.target.value })}
          placeholder="e.g. Backend Developer"
          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 ${roleError ? 'border-red-400' : 'border-gray-300'}`}
          aria-invalid={roleError}
        />
        {roleError && <p className="mt-1 text-xs text-red-600">Tell me which role you're aiming for.</p>}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {ROLE_SUGGESTIONS.slice(0, 10).map((r) => (
            <button key={r} type="button" onClick={() => set({ targetRole: r })}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border ${form.targetRole === r ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-400'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="gap-skills" className="block text-sm font-semibold text-gray-900 mb-1.5">
          Which skills do you have right now?
        </label>
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 min-h-[48px] border border-gray-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500">
          {form.currentSkills.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-xs font-medium text-green-800">
              {s}
              <button type="button" aria-label={`Remove ${s}`} onClick={() => set({ currentSkills: form.currentSkills.filter((k) => k !== s) })} className="text-green-700 hover:text-green-900">×</button>
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
            className="flex-1 min-w-[12rem] py-1 text-sm focus:outline-none"
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">Include languages, tools and frameworks. Leave it empty if you're starting from zero.</p>
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
          <label htmlFor="gap-goal" className={label}>Goal <span className="normal-case font-normal text-gray-400">(optional)</span></label>
          <input
            id="gap-goal"
            type="text"
            maxLength={240}
            value={form.goal}
            onChange={(e) => set({ goal: e.target.value })}
            placeholder="e.g. First job in 6 months"
            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
          />
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      <button
        type="submit"
        disabled={starting}
        className="w-full px-6 py-3.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-70 flex items-center justify-center gap-2"
      >
        {starting ? (
          <>
            <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" />
            <span aria-live="polite">{PROGRESS[step]}</span>
          </>
        ) : 'Analyse my skills & start chatting'}
      </button>
    </form>
  );
};

export default SkillGapIntake;
