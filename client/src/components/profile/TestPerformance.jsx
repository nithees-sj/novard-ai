import React, { useMemo, useState } from 'react';
import { EmptyState as UIEmptyState } from '../ui/States';
import { BarList, LineChart } from './charts';

const PAGE = 8;

const scoreTone = (p) => (p >= 80 ? 'text-success-fg bg-success-soft' : p >= 60 ? 'text-accent-fg bg-accent-soft' : p >= 40 ? 'text-warning-fg bg-warning-soft' : 'text-danger-fg bg-danger-soft');
const barTone = (p) => (p >= 80 ? 'bg-success' : p >= 60 ? 'bg-accent' : p >= 40 ? 'bg-warning' : 'bg-danger');
const BAND_COLORS = ['bg-red-400', 'bg-amber-400', 'bg-primary-400', 'bg-success'];
const shortDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const longDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

const Card = ({ title, subtitle, children, className = '' }) => (
  <div className={`rounded-xl bg-raised p-5 ring-1 ring-line-subtle ${className}`}>
    <h3 className="text-base font-bold text-fg">{title}</h3>
    {subtitle && <p className="text-xs text-fg-subtle mt-0.5">{subtitle}</p>}
    <div className="mt-5">{children}</div>
  </div>
);

/**
 * Every quiz the student has submitted anywhere in the app: a score trend,
 * breakdowns by where the quiz came from and how hard it was, the spread of
 * scores, and the full, filterable history.
 */
const TestPerformance = ({ tests }) => {
  const [source, setSource] = useState('all');
  const [shown, setShown] = useState(PAGE);
  const history = useMemo(() => tests?.history || [], [tests]);

  const trend = useMemo(() => [...history].slice(0, 20).reverse().map((t) => ({
    label: shortDate(t.at),
    value: t.percentage,
    sub: `${t.topic} · ${t.correct}/${t.questions} · ${shortDate(t.at)}`,
  })), [history]);

  const filtered = source === 'all' ? history : history.filter((t) => t.source === source);
  const bandTotal = (tests?.bands || []).reduce((n, b) => n + b.count, 0);

  if (!history.length) {
    return (
      <div className="rounded-xl bg-raised ring-1 ring-line-subtle">
        <UIEmptyState compact icon="quiz" title="No tests taken yet" text="Take a quiz on any note, video, doubt or skill plan and your results are charted here." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Test score trend" subtitle={`Your last ${trend.length} ${trend.length === 1 ? 'test' : 'tests'}, oldest to newest`} className="lg:col-span-2">
          <LineChart points={trend} max={100} unit="%" height={220} caption="Test scores over time" />
        </Card>
        <Card title="Score spread" subtitle="How your test scores are distributed">
          <div className="flex h-3 rounded-full overflow-hidden bg-sunken mb-5" aria-hidden="true">
            {tests.bands.map((b, i) => b.count > 0 && <div key={b.label} className={BAND_COLORS[i]} style={{ width: `${(b.count / bandTotal) * 100}%` }} />)}
          </div>
          <ul className="space-y-2.5">
            {tests.bands.slice().reverse().map((b, ri) => (
              <li key={b.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-fg-muted">
                  <span className={`w-2.5 h-2.5 rounded-sm ${BAND_COLORS[BAND_COLORS.length - 1 - ri]}`} aria-hidden="true" />
                  {b.label}
                </span>
                <span className="tabular-nums text-fg font-semibold">{b.count} <span className="font-normal text-fg-subtle">{b.count === 1 ? 'test' : 'tests'}</span></span>
              </li>
            ))}
          </ul>
          {tests.best && (
            <p className="mt-5 pt-4 border-t border-line-subtle text-xs text-fg-subtle">
              Best result: <strong className="text-fg">{Math.round(tests.best.percentage)}%</strong> on {tests.best.topic}
            </p>
          )}
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Accuracy by section" subtitle="Recent results count more than old ones">
          <BarList rows={tests.bySource.map((s) => ({ label: s.label, value: s.accuracy, note: `${s.attempts} ${s.attempts === 1 ? 'test' : 'tests'}`, color: barTone(s.accuracy) }))} />
        </Card>
        <Card title="Accuracy by difficulty" subtitle="From the difficulty you chose when setting up each quiz">
          <BarList
            rows={tests.byDifficulty.map((s) => ({ label: s.label, value: s.accuracy, note: `${s.attempts} ${s.attempts === 1 ? 'test' : 'tests'}`, color: barTone(s.accuracy) }))}
            emptyText="Quizzes taken before difficulty settings existed have no difficulty recorded."
          />
        </Card>
      </div>

      <div className="overflow-hidden rounded-xl bg-raised ring-1 ring-line-subtle">
        <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-4">
          <div>
            <h3 className="text-base font-bold text-fg">Test history</h3>
            <p className="text-xs text-fg-subtle mt-0.5">{history.length} {history.length === 1 ? 'test' : 'tests'} across the app</p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by section">
            {[{ key: 'all', label: 'All' }, ...tests.bySource.map((s) => ({ key: s.key, label: s.label }))].map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={source === f.key}
                onClick={() => { setSource(f.key); setShown(PAGE); }}
                className={`rounded-full px-3 py-1 text-small font-medium ring-1 ring-inset transition-colors ${source === f.key ? 'bg-accent-soft text-accent-fg ring-accent/40' : 'text-fg-muted ring-line hover:bg-sunken hover:text-fg'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-line-subtle bg-sunken/60 text-left text-caption font-medium text-fg-subtle">
                <th className="px-6 py-2.5">Topic</th>
                <th className="px-4 py-2.5">Section</th>
                <th className="px-4 py-2.5">Difficulty</th>
                <th className="px-4 py-2.5 text-right">Correct</th>
                <th className="px-4 py-2.5 text-right">Score</th>
                <th className="px-6 py-2.5 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {filtered.slice(0, shown).map((t, i) => (
                <tr key={`${t.at}-${i}`} className="hover:bg-sunken/60">
                  <td className="px-6 py-3 max-w-xs">
                    <p className="font-medium text-fg truncate" title={t.topic}>{t.topic}</p>
                    <p className="text-xs text-fg-subtle">{t.domain}</p>
                  </td>
                  <td className="px-4 py-3 text-fg-muted whitespace-nowrap">{t.sourceLabel}</td>
                  <td className="px-4 py-3 text-fg-muted capitalize whitespace-nowrap">{t.difficulty || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-fg-muted whitespace-nowrap">{t.correct}/{t.questions}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-block min-w-[3.25rem] text-center px-2 py-0.5 rounded-md text-xs font-bold tabular-nums ${scoreTone(t.percentage)}`}>{t.percentage}%</span>
                  </td>
                  <td className="px-6 py-3 text-right text-fg-subtle whitespace-nowrap" title={longDate(t.at)}>{shortDate(t.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > shown && (
          <div className="p-4 border-t border-line-subtle text-center">
            <button type="button" onClick={() => setShown((n) => n + PAGE * 2)} className="text-sm font-semibold text-accent-fg hover:underline">
              Show more ({filtered.length - shown} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestPerformance;
