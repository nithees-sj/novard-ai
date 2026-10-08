import React from 'react';
import ForecastChart from './ForecastChart';
import { SectionHeader, Card } from '../ui/Headers';
import { Stat } from '../ui/Stat';
import Badge from '../ui/Badge';
import { pct, dayLabel } from '../../lib/exams';
import { chart, tone } from '../../lib/statusColors';

const LegendItem = ({ dash, label, color = chart.brand }) => (
  <span className="inline-flex items-center gap-1.5 text-caption text-fg-subtle">
    <svg width="18" height="4" aria-hidden="true"><line x1="1" x2="17" y1="2" y2="2" style={{ stroke: color }} strokeWidth="2" strokeLinecap="round" strokeDasharray={dash} /></svg>
    {label}
  </span>
);

/** How it is going: readiness over time and the forecast, the work done, why the plan changed, and every quiz. */
export default function ProgressTab({ exam }) {
  const fc = exam.forecast;
  const quizzes = exam.quizzes || [];
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-8 px-5 py-6 sm:px-6">
        <Card
          title="Readiness and forecast"
          description="Your readiness so far, and where this plan takes you by exam day. The shaded fan is the likely range if you learn slower or faster."
          actions={(
            <div className="hidden flex-wrap gap-3 sm:flex">
              <LegendItem label="You" />
              <LegendItem dash="4 3" label="The plan" />
              <LegendItem dash="1 3" label="Target" color={tone.success} />
            </div>
          )}
        >
          {fc ? (
            <ForecastChart snapshots={exam.snapshots} series={fc.series} low={fc.low} high={fc.high} target={exam.targetReadiness / 100} today={exam.today.date} examDate={exam.examDate} height={260} />
          ) : <p className="text-small text-fg-muted">The forecast appears once the plan is built.</p>}
        </Card>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line-subtle ring-1 ring-line-subtle lg:grid-cols-4">
          <Stat label="Tasks done" value={exam.stats.done} sub={`${exam.stats.minutesDone} minutes studied`} />
          <Stat label="Missed" value={exam.stats.missed} tone={exam.stats.missed ? 'warning' : undefined} sub="Rescheduled automatically" />
          <Stat label="Topics completed" value={`${exam.stats.topicsCompleted ?? 0} of ${exam.topics.length}`} tone={exam.stats.topicsCompleted === exam.topics.length ? 'success' : undefined} sub={`Passed with ${exam.passPercent ?? 50}% or more`} />
          <Stat label="Quizzes taken" value={quizzes.length} sub={quizzes.length ? `Last: ${quizzes[0].correct}/${quizzes[0].total}` : 'None yet'} />
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <SectionHeader title="Why the plan changed" description="Every re-plan, and what it did." />
            <ol className="relative space-y-4 border-l border-line-subtle pl-5">
              {exam.planLog.map((l, i) => (
                <li key={`${l.at}-${i}`} className="relative">
                  <span className={`absolute -left-[1.6875rem] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-canvas ${i === 0 ? 'bg-accent' : 'bg-line-strong'}`} aria-hidden="true" />
                  <p className="text-small font-medium text-fg">{l.trigger}</p>
                  <p className="text-small text-fg-muted">{l.summary}</p>
                  <p className="num mt-0.5 text-caption text-fg-subtle">{dayLabel(l.at)}</p>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <SectionHeader title="Quiz results" description="Graded on the server; every answer updates your mastery." />
            {quizzes.length ? (
              <ul className="divide-y divide-line-subtle overflow-hidden rounded-xl bg-raised ring-1 ring-line-subtle">
                {quizzes.map((q) => {
                  const score = q.total ? q.correct / q.total : 0;
                  return (
                    <li key={q._id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-small font-medium text-fg">{q.label}</p>
                        <p className="num text-caption text-fg-subtle">{new Date(q.submittedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</p>
                      </div>
                      <span className="num text-small text-fg-muted">{q.correct}/{q.total}</span>
                      <Badge tone={score >= 0.7 ? 'success' : score >= 0.4 ? 'warning' : 'danger'}>{pct(score)}</Badge>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="rounded-xl bg-sunken px-4 py-6 text-center text-small text-fg-muted">No quizzes yet. Today’s plan has the first one.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
