import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  QUIZ_DIFFICULTIES, QUIZ_STYLES, QUIZ_COUNTS, QUIZ_MIN, QUIZ_MAX, QUIZ_DEFAULTS, difficultyLabel,
} from '../../lib/quiz';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;

const scoreTone = (p) =>
  p >= 85 ? { bar: 'bg-green-500', text: 'text-green-700' }
    : p >= 70 ? { bar: 'bg-blue-500', text: 'text-blue-700' }
      : p >= 50 ? { bar: 'bg-yellow-500', text: 'text-yellow-700' }
        : { bar: 'bg-red-500', text: 'text-red-700' };

const formatWhen = (value) =>
  new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const Stat = ({ label, value, sub, subTone }) => (
  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
    <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</div>
    <div className="text-xl font-bold text-gray-900 tabular-nums">{value}</div>
    {sub && <div className={`text-[11px] font-semibold ${subTone || 'text-gray-500'}`}>{sub}</div>}
  </div>
);

/** Previous marks on this exact topic, newest first. */
const PreviousMarks = ({ state, onRetry }) => {
  const [showAll, setShowAll] = useState(false);

  if (state.loading) {
    return <div className="h-24 rounded-lg bg-gray-100 animate-pulse" aria-label="Loading previous marks" />;
  }
  if (state.error) {
    return (
      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">
        Couldn't load your previous marks.{' '}
        <button type="button" onClick={onRetry} className="text-blue-600 font-medium hover:underline">Retry</button>
      </p>
    );
  }
  const { attempts = [], stats } = state.data || {};
  if (!stats) {
    return (
      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">
        No quizzes taken on this topic yet - this will be your first.
      </p>
    );
  }

  const change = stats.change;
  const visible = showAll ? attempts : attempts.slice(0, 4);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Attempts" value={stats.count} />
        <Stat label="Best" value={`${stats.best}%`} />
        <Stat label="Average" value={`${stats.average}%`} />
        <Stat
          label="Latest"
          value={`${stats.latest}%`}
          sub={change === null ? null : change === 0 ? 'same as before' : `${change > 0 ? '▲ +' : '▼ '}${change} pts vs previous`}
          subTone={change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'}
        />
      </div>

      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
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
                  <div className="text-sm font-medium text-gray-900">
                    {a.correct}/{a.total} correct
                    <span className="ml-2 text-xs font-normal text-gray-500">{formatWhen(a.attemptedAt)}</span>
                  </div>
                  <div className="text-xs text-gray-500 truncate">{details || 'Settings not recorded (older quiz)'}</div>
                </div>
                <span className={`text-sm font-bold tabular-nums ${tone.text}`}>{a.percentage}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-100" aria-hidden="true">
                <div className={`h-1.5 rounded-full ${tone.bar}`} style={{ width: `${a.percentage}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      {attempts.length > 4 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-blue-600 hover:underline">
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
    const userId = localStorage.getItem('email');
    if (!itemId || !userId) {
      setHistory({ loading: false, error: null, data: null });
      return;
    }
    setHistory((h) => ({ ...h, loading: true, error: null }));
    try {
      const { data } = await axios.get(`${apiUrl}/api/quiz-history/${source}/${itemId}`, { params: { userId } });
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
    `rounded-lg border-2 text-left transition-colors ${active
      ? 'border-indigo-600 bg-indigo-50'
      : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-gray-50'}`;

  return (
    <form onSubmit={submit} className="max-w-3xl mx-auto space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900">Quiz on {topic}</h3>
        <p className="text-sm text-gray-500">Review how you've done before, then set up your next quiz.</p>
      </div>

      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Your previous marks on this topic</h4>
        <PreviousMarks state={history} onRetry={loadHistory} />
      </section>

      <section className="space-y-5 border-t border-gray-100 pt-5">
        <h4 className="text-sm font-semibold text-gray-900">Customise your quiz</h4>

        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Difficulty</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {QUIZ_DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                type="button"
                aria-pressed={settings.difficulty === d.value}
                onClick={() => update({ difficulty: d.value })}
                className={`${choice(settings.difficulty === d.value)} px-3 py-2.5`}
              >
                <div className="text-sm font-semibold text-gray-900">{d.label}</div>
                <div className="text-xs text-gray-500">{d.hint}</div>
              </button>
            ))}
          </div>
          {nextLevel && settings.difficulty === last.difficulty && (
            <p className="mt-2 text-xs text-indigo-700">
              You scored {last.percentage}% on {difficultyLabel(last.difficulty)} last time - try{' '}
              <button type="button" onClick={() => update({ difficulty: nextLevel })} className="font-semibold underline">
                {difficultyLabel(nextLevel)}
              </button>?
            </p>
          )}
        </fieldset>

        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Number of questions</legend>
          <div className="flex flex-wrap items-center gap-2">
            {QUIZ_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={!isCustom && settings.questionCount === n}
                onClick={() => { setCustomCount(''); update({ questionCount: n }); }}
                className={`${choice(!isCustom && settings.questionCount === n)} px-4 py-2 text-sm font-semibold text-gray-900`}
              >
                {n}
              </button>
            ))}
            <label className="flex items-center gap-2 text-sm text-gray-600">
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
                className={`w-24 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${customInvalid ? 'border-red-400' : 'border-gray-300'}`}
              />
            </label>
          </div>
          {customInvalid && <p className="mt-1 text-xs text-red-600">Choose between {QUIZ_MIN} and {QUIZ_MAX} questions.</p>}
        </fieldset>

        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Question style</legend>
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1" role="radiogroup" aria-label="Question style">
            {QUIZ_STYLES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={settings.style === s.value}
                onClick={() => update({ style: s.value })}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${settings.style === s.value
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {settings.style === 'conceptual' ? 'Ideas, definitions and why things work.'
              : settings.style === 'practical' ? 'Scenarios, code and "what would you do" questions.'
                : 'A mix of both.'}
          </p>
        </fieldset>

        <div>
          <label htmlFor={`quiz-focus-${source}`} className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Focus on <span className="normal-case font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id={`quiz-focus-${source}`}
            type="text"
            maxLength={200}
            value={settings.focus}
            onChange={(e) => update({ focus: e.target.value })}
            placeholder="e.g. a sub-topic you want to practise"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
      </section>

      {(error || blockedReason) && (
        <p role="alert" className={`text-sm rounded-lg px-4 py-3 ${blockedReason ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {blockedReason || error}
        </p>
      )}

      <button
        type="submit"
        disabled={starting || Boolean(blockedReason) || customInvalid}
        className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {starting ? (
          <>
            <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" />
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
