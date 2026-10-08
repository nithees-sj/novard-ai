import React from 'react';
import MermaidDiagram from '../MermaidDiagram';
import Badge from '../ui/Badge';
import { buttonClass } from '../ui/Button';
import cx from '../ui/cx';
import { Icon, ReportAction } from '../learning/LearningUI';
import { STEP_STATUS, scoreTone } from '../../lib/teachBack';

const RING = { success: 'stroke-success', accent: 'stroke-accent', warning: 'stroke-warning' };
const TEXT = { success: 'text-success-fg', accent: 'text-accent-fg', warning: 'text-warning-fg' };
const HEADLINE = { success: 'You really get this', accent: 'Getting there', warning: 'Worth another go' };

function ScoreRing({ score, tone }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <svg width="104" height="104" viewBox="0 0 104 104" className="shrink-0" role="img" aria-label={`${score} out of 100`}>
      <circle cx="52" cy="52" r={r} fill="none" className="stroke-chart-track" strokeWidth="9" />
      <circle cx="52" cy="52" r={r} fill="none" className={cx(RING[tone], 'transition-all duration-700')} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 52 52)" />
      <text x="52" y="48" textAnchor="middle" className="fill-fg text-title font-semibold">{score}</text>
      <text x="52" y="66" textAnchor="middle" className="fill-fg-subtle text-caption">/ 100</text>
    </svg>
  );
}

const Section = ({ icon, title, children, aside }) => (
  <section className="space-y-3">
    <div className="flex items-center gap-2">
      <Icon name={icon} className="h-4 w-4 text-fg-subtle" />
      <h3 className="flex-1 text-lead font-semibold text-fg">{title}</h3>
      {aside}
    </div>
    {children}
  </section>
);

/**
 * The marks: a score, the concept drawn as a flow with each step coloured by
 * how the student explained it, feedback per step, and corrections to their
 * understanding. Then: let Novard teach the weak steps, or teach it again.
 */
export default function Results({ session, onCoach, onRetry, onReport }) {
  const { result } = session;
  const tone = scoreTone(result.score);
  const delta = session.previousScore === null || session.previousScore === undefined ? null : result.score - session.previousScore;
  const weak = result.flow.filter((s) => s.status !== 'good').length;
  const counts = Object.keys(STEP_STATUS).map((k) => [k, result.flow.filter((s) => s.status === k).length]).filter(([, n]) => n);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-8 px-6 py-6">
        <div className="flex flex-col items-center gap-5 border-b border-line-subtle pb-6 sm:flex-row sm:items-center">
          <ScoreRing score={result.score} tone={tone} />
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h3 className={cx('text-title font-semibold', TEXT[tone])}>{HEADLINE[tone]}</h3>
              {delta !== null && (
                <Badge tone={delta > 0 ? 'success' : delta < 0 ? 'danger' : 'neutral'}>
                  <Icon name={delta >= 0 ? 'trend' : 'arrowDown'} className="h-3 w-3" />
                  {delta > 0 ? `+${delta}` : delta} since last time ({session.previousScore} → {result.score})
                </Badge>
              )}
            </div>
            {result.verdict && <p className="mt-1 text-body text-fg-muted">{result.verdict}</p>}
            <p className="mt-1 text-caption text-fg-subtle">Only your understanding is marked - never your grammar, accent or wording.</p>
          </div>
          <ReportAction onClick={onReport} label="Report" className="self-start" />
        </div>

        <div className="flex flex-col gap-3 rounded-xl bg-accent-soft p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-body font-semibold text-accent-fg">{weak ? `Get stronger on ${weak} step${weak === 1 ? '' : 's'}` : 'Go deeper'}</p>
            <p className="text-small text-fg-muted">{weak ? 'Novard teaches exactly the steps you lagged on, with examples and quick checks.' : 'You covered every step. Novard can stretch you further.'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onCoach} className={buttonClass({ variant: 'primary' })}><Icon name="graduation" /> Teach me my weak spots</button>
            <button type="button" onClick={onRetry} className={buttonClass({ variant: 'secondary' })}><Icon name="refresh" /> Teach it back again</button>
          </div>
        </div>

        <Section
          icon="flow"
          title={`The flow of ${session.concept}`}
          aside={(
            <div className="hidden flex-wrap gap-1.5 sm:flex">
              {counts.map(([k, n]) => <Badge key={k} tone={STEP_STATUS[k].tone}>{n} {STEP_STATUS[k].label.toLowerCase()}</Badge>)}
            </div>
          )}
        >
          {session.flowChart && <MermaidDiagram chart={session.flowChart} />}
          <ol className="space-y-2">
            {result.flow.map((s, i) => {
              const meta = STEP_STATUS[s.status] || STEP_STATUS.missed;
              return (
                <li key={i} className="flex gap-3 rounded-lg p-3 ring-1 ring-inset ring-line-subtle">
                  <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sunken text-caption font-semibold text-fg-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-body font-medium text-fg">{s.step}</p>
                      <Badge tone={meta.tone} dot>{meta.label}</Badge>
                    </div>
                    {s.feedback && <p className="mt-1 text-small text-fg-muted">{s.feedback}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>

        {result.corrections.length > 0 && (
          <Section icon="edit" title="Corrections to your understanding">
            <div className="grid gap-3 md:grid-cols-2">
              {result.corrections.map((c, i) => (
                <article key={i} className="space-y-2 rounded-xl p-4 ring-1 ring-inset ring-line">
                  {c.youSaid && (
                    <p className="text-small text-danger-fg">
                      <span className="font-semibold">You said: </span>
                      <span className="italic">“{c.youSaid}”</span>
                    </p>
                  )}
                  <p className="text-small text-success-fg"><span className="font-semibold">Actually: </span>{c.actually}</p>
                  {c.why && <p className="text-small text-fg-muted"><span className="font-semibold text-fg">Why: </span>{c.why}</p>}
                </article>
              ))}
            </div>
          </Section>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {result.strengths.length > 0 && (
            <Section icon="star" title="What you did well">
              <ul className="space-y-1.5">
                {result.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-small text-fg-muted"><Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-success-fg" />{s}</li>
                ))}
              </ul>
            </Section>
          )}
          {result.nextStep && (
            <Section icon="target" title="Work on this first">
              <p className="text-small text-fg-muted">{result.nextStep}</p>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
