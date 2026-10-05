import React, { useEffect, useRef, useState } from 'react';
import { buttonClass } from '../ui/Button';
import { fieldClass } from '../ui/Field';
import Spinner from '../ui/Spinner';
import { api } from '../../lib/api';
import {
  QUIZ_DIFFICULTIES, QUIZ_STYLES, QUIZ_COUNTS, QUIZ_MIN, QUIZ_MAX, QUIZ_DEFAULTS, difficultyLabel,
} from '../../lib/quiz';
import { currentEmail } from '../../lib/session';


const scoreTone = (p) =>
  p >= 85 ? { bar: 'bg-success', text: 'text-success-fg' }
    : p >= 70 ? { bar: 'bg-accent', text: 'text-accent-fg' }
      : p >= 50 ? { bar: 'bg-warning', text: 'text-warning-fg' }
        : { bar: 'bg-danger', text: 'text-danger-fg' };

const formatWhen = (value) =>
  new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const Stat = ({ label, value, sub, subTone }) => (
  <div className="bg-raised px-3 py-2.5">
    <div className="text-small text-fg-muted">{label}</div>
    <div className="num text-title font-medium text-fg">{value}</div>
    {sub && <div className={`text-caption ${subTone || 'text-fg-subtle'}`}>{sub}</div>}
  </div>
);

/** Previous marks on this exact topic, newest first. */
const PreviousMarks = ({ state, onRetry }) => {
  const [showAll, setShowAll] = useState(false);

  if (state.loading) {
    return <div className="h-24 animate-pulse rounded-lg bg-sunken" role="status" aria-label="Loading previous marks" />;
  }
  if (state.error) {
    return (
      <p className="text-body text-fg-muted">
        Couldn't load your previous marks.{' '}
        <button type="button" onClick={onRetry} className="text-accent-fg font-medium hover:underline">Retry</button>
      </p>
    );
  }
  const { attempts = [], stats } = state.data || {};
  if (!stats) {
    return (
      <p className="text-body text-fg-muted">
        No quizzes taken on this topic yet - this will be your first.
      </p>
    );
  }

  const change = stats.change;
  const visible = showAll ? attempts : attempts.slice(0, 4);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-line-subtle ring-1 ring-line-subtle sm:grid-cols-4">
        <Stat label="Attempts" value={stats.count} />
        <Stat label="Best" value={`${stats.best}%`} />
        <Stat label="Average" value={`${stats.average}%`} />
        <Stat
          label="Latest"
          value={`${stats.latest}%`}
          sub={change === null ? null : change === 0 ? 'same as before' : `${change > 0 ? '▲ +' : '▼ '}${change} pts vs previous`}
          subTone={change > 0 ? 'text-success-fg' : change < 0 ? 'text-danger-fg' : 'text-fg-subtle'}
        />
      </div>

      <ul className="divide-y divide-line-subtle">
        {visible.map((a, i) => {
          const tone = scoreTone(a.percentage);
          const details = [
            difficultyLabel(a.difficulty),
            a.style && a.style[0].toUpperCase() + a.style.slice(1),
            a.focus && `focus: ${a.focus}`,
          ].filter(Boolean).join(' · ');
          return (
            <li key={`${a.attemptedAt}-${i}`} className="px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-fg">
                    {a.correct}/{a.total} correct
                    <span className="ml-2 text-xs font-normal text-fg-subtle">{formatWhen(a.attemptedAt)}</span>
                  </div>
                  <div className="text-xs text-fg-subtle truncate">{details || 'Settings not recorded (older quiz)'}</div>
                </div>
                <span className={`text-sm font-bold tabular-nums ${tone.text}`}>{a.percentage}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-sunken" aria-hidden="true">
                <div className={`h-1.5 rounded-full ${tone.bar}`} style={{ width: `${a.percentage}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      {attempts.length > 4 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-accent-fg hover:underline">
          {showAll ? 'Show fewer' : `Show all ${attempts.length} attempts`}
        </button>
      )}
    </div>
  );
};

/**
 * Shown when a student clicks "Quiz": their previous marks on this topic, then
 * the options for a new quiz (difficulty, number of questions, style, focus).
 * Settings start from the student's last attempt on this topic.
 *
 * source: 'notes' | 'youtube' | 'doubt' | 'plan'
 */
const QuizSetup = ({ source, itemId, topic, onStart, starting = false, error = null, blockedReason = null }) => {
  const [history, setHistory] = useState({ loading: true, error: null, data: null });
  const [settings, setSettings] = useState(QUIZ_DEFAULTS);
  const [customCount, setCustomCount] = useState('');
  const touched = useRef(false);

  const loadHistory = async () => {
    const userId = currentEmail();
    if (!itemId || !userId) {
      setHistory({ loading: false, error: null, data: null });
      return;
    }
    setHistory((h) => ({ ...h, loading: true, error: null }));
    try {
      const { data } = await api.get(`/api/quiz-history/${source}/${itemId}`, { params: { userId } });
      setHistory({ loading: false, error: null, data });
      // Start from the student's last choices on this topic, unless they have already changed something.
      const last = data.attempts?.[0];
      if (last && !touched.current) {
        const n = last.questionCount;
        if (n && n >= QUIZ_MIN && n <= QUIZ_MAX && !QUIZ_COUNTS.includes(n)) setCustomCount(String(n));
        setSettings((s) => ({
          difficulty: last.difficulty || s.difficulty,
          questionCount: last.questionCount && last.questionCount >= QUIZ_MIN && last.questionCount <= QUIZ_MAX ? last.questionCount : s.questionCount,
          style: last.style || s.style,
          focus: '',
        }));
      }
    } catch (err) {
      setHistory({ loading: false, error: err.message, data: null });
    }
  };

  useEffect(() => {
    touched.current = false;
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, itemId]);

  const update = (patch) => {
    touched.current = true;
    setSettings((s) => ({ ...s, ...patch }));
  };

  const isCustom = !QUIZ_COUNTS.includes(settings.questionCount) || customCount !== '';
  const customValue = parseInt(customCount, 10);
  const customInvalid = customCount !== '' && (!Number.isFinite(customValue) || customValue < QUIZ_MIN || customValue > QUIZ_MAX);
  const count = customCount !== '' && !customInvalid ? customValue : settings.questionCount;

  // Nudge: last attempt was strong at this level - suggest stepping up.
  const last = history.data?.attempts?.[0];
  const levels = QUIZ_DIFFICULTIES.map((d) => d.value);
  const nextLevel = last && last.percentage >= 85 && last.difficulty && levels[levels.indexOf(last.difficulty) + 1];

  const submit = (e) => {
    e.preventDefault();
    if (starting || blockedReason || customInvalid) return;
    onStart({ ...settings, questionCount: count, focus: settings.focus.trim() });
  };

  const choice = (active) =>
    `rounded text-left ring-1 ring-inset transition-colors duration-150 ${active
      ? 'bg-accent-soft ring-accent/40'
      : 'bg-raised ring-line hover:bg-sunken hover:ring-line-strong'}`;

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-7">
      <div>
        <h3 className="text-title font-semibold text-fg">Quiz on {topic}</h3>
        <p className="mt-0.5 text-body text-fg-muted">See how you did before, then set up the next one.</p>
      </div>

      <section>
        <h4 className="mb-2 text-small font-medium text-fg-muted">Previous marks on this topic</h4>
        <PreviousMarks state={history} onRetry={loadHistory} />
      </section>

      <section className="space-y-5 border-t border-line-subtle pt-5">
        <h4 className="text-small font-medium text-fg-muted">Your next quiz</h4>

        <fieldset>
          <legend className="mb-2 block text-small font-medium text-fg">Difficulty</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {QUIZ_DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                type="button"
                aria-pressed={settings.difficulty === d.value}
                onClick={() => update({ difficulty: d.value })}
                className={`${choice(settings.difficulty === d.value)} px-3 py-2.5`}
              >
                <div className="text-sm font-semibold text-fg">{d.label}</div>
                <div className="text-xs text-fg-subtle">{d.hint}</div>
              </button>
            ))}
          </div>
          {nextLevel && settings.difficulty === last.difficulty && (
            <p className="mt-2 text-xs text-accent-fg">
              You scored {last.percentage}% on {difficultyLabel(last.difficulty)} last time - try{' '}
              <button type="button" onClick={() => update({ difficulty: nextLevel })} className="font-semibold underline">
                {difficultyLabel(nextLevel)}
              </button>?
            </p>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-2 block text-small font-medium text-fg">Number of questions</legend>
          <div className="flex flex-wrap items-center gap-2">
            {QUIZ_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={!isCustom && settings.questionCount === n}
                onClick={() => { setCustomCount(''); update({ questionCount: n }); }}
                className={`${choice(!isCustom && settings.questionCount === n)} px-4 py-2 text-sm font-semibold text-fg`}
              >
                {n}
              </button>
            ))}
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              or
              <input
                type="number"
                min={QUIZ_MIN}
                max={QUIZ_MAX}
                inputMode="numeric"
                value={customCount}
                onChange={(e) => { touched.current = true; setCustomCount(e.target.value); }}
                placeholder={`${QUIZ_MIN}–${QUIZ_MAX}`}
                aria-label="Custom number of questions"
                className={`${fieldClass(customInvalid)} h-9 w-24`}
              />
            </label>
          </div>
          {customInvalid && <p className="mt-1 text-xs text-danger-fg">Choose between {QUIZ_MIN} and {QUIZ_MAX} questions.</p>}
        </fieldset>

        <fieldset>
          <legend className="mb-2 block text-small font-medium text-fg">Question style</legend>
          <div className="inline-flex rounded-lg bg-sunken p-0.5 ring-1 ring-inset ring-line-subtle" role="radiogroup" aria-label="Question style">
            {QUIZ_STYLES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={settings.style === s.value}
                onClick={() => update({ style: s.value })}
                className={`h-8 rounded-md px-3 text-body font-medium transition-colors ${settings.style === s.value
                  ? 'bg-raised text-fg shadow-raised ring-1 ring-line-subtle'
                  : 'text-fg-muted hover:text-fg'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-fg-subtle">
            {settings.style === 'conceptual' ? 'Ideas, definitions and why things work.'
              : settings.style === 'practical' ? 'Scenarios, code and "what would you do" questions.'
                : 'A mix of both.'}
          </p>
        </fieldset>

        <div>
          <label htmlFor={`quiz-focus-${source}`} className="mb-2 block text-small font-medium text-fg">
            Focus on <span className="font-normal text-fg-subtle">(optional)</span>
          </label>
          <input
            id={`quiz-focus-${source}`}
            type="text"
            maxLength={200}
            value={settings.focus}
            onChange={(e) => update({ focus: e.target.value })}
            placeholder="e.g. a sub-topic you want to practise"
            className={`${fieldClass(false)} h-9`}
          />
        </div>
      </section>

      {(error || blockedReason) && (
        <p role="alert" className={`rounded-lg px-4 py-3 text-body ${blockedReason ? 'bg-warning-soft text-warning-fg' : 'bg-danger-soft text-danger-fg'}`}>
          {blockedReason || error}
        </p>
      )}

      <button
        type="submit"
        disabled={starting || Boolean(blockedReason) || customInvalid}
        className={buttonClass({ variant: 'primary', size: 'lg' })}
      >
        {starting ? (
          <>
            <Spinner className="h-4 w-4" />
            Generating {count} {difficultyLabel(settings.difficulty)?.toLowerCase()} questions…
          </>
        ) : (
          `Start quiz · ${count} questions`
        )}
      </button>
    </form>
  );
};

export default QuizSetup;
