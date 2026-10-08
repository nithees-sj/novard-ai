import React from 'react';
import { Icon } from '../learning/LearningUI';
import { SectionHeader } from '../ui/Headers';
import { Stat } from '../ui/Stat';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import cx from '../ui/cx';
import { pct, TASK_TYPES, PHASES, dayLabel } from '../../lib/exams';

const STATUS = { done: { label: 'Done', tone: 'success' }, skipped: { label: 'Skipped', tone: 'neutral' }, missed: { label: 'Missed', tone: 'danger' } };

/** One task: what it is, why it was chosen, what it is worth, and its actions. */
function TaskRow({ task, next, busy, passPercent, onStart, onCheck, onStatus }) {
  const meta = TASK_TYPES[task.type];
  const open = task.status === 'todo';
  return (
    <li className={cx('flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:gap-4', next && 'bg-accent-soft/40')}>
      <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', open ? 'bg-accent-soft text-accent-fg' : task.status === 'done' ? 'bg-success-soft text-success-fg' : 'bg-sunken text-fg-subtle')}>
        <Icon name={task.status === 'done' ? 'check' : meta.icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {next && <span className="text-caption font-semibold text-accent-fg">Up next</span>}
          <p className={cx('text-body font-medium', open ? 'text-fg' : 'text-fg-muted')}>
            {meta.label}<span className="text-fg-subtle"> · </span>{task.topic}
          </p>
          {!open && <Badge tone={STATUS[task.status].tone}>{STATUS[task.status].label}</Badge>}
        </div>
        <p className={cx('mt-0.5 text-small', open ? 'text-fg-muted' : 'text-fg-subtle')}>{task.reason}</p>
        <p className="num mt-1.5 flex flex-wrap items-center gap-x-3 text-caption text-fg-subtle">
          <span className="inline-flex items-center gap-1"><Icon name="clock" className="h-3 w-3" />{task.minutes} min</span>
          {open && task.gain > 0 && <span className="inline-flex items-center gap-1" title="Expected gain in exam-day readiness"><Icon name="trend" className="h-3 w-3" />+{task.gain} readiness pts</span>}
          {open && task.type !== 'mock' && (
            <span className="inline-flex items-center gap-1"><Icon name="target" className="h-3 w-3" />{task.type === 'teach' ? `Completes at ${passPercent}/100` : task.type === 'learn' ? `Completes when the check is passed (${passPercent}%)` : `Pass mark ${passPercent}%`}</span>
          )}
        </p>
      </div>
      {open && (
        <div className="flex shrink-0 items-center gap-1 sm:pt-0.5">
          <Button size="sm" variant={next ? 'primary' : 'secondary'} onClick={() => onStart(task)} loading={busy} loadingLabel="Preparing…" icon="play">
            {meta.action}
          </Button>
          {task.type === 'learn' && <Button size="sm" variant="secondary" icon="quiz" onClick={() => onCheck(task)} disabled={busy}>Take the check</Button>}
          <Button size="sm" variant="ghost" onClick={() => onStatus(task, 'skipped')} disabled={busy} title="Autopilot moves it to another day">Skip</Button>
        </div>
      )}
    </li>
  );
}

/** The week ahead: load and topics per day. A list on phones, a strip of days from `md` up. */
function WeekAhead({ days, dailyMinutes }) {
  if (!days.length) return <p className="text-small text-fg-muted">No study days left before the exam.</p>;
  return (
    <ol className="grid gap-px overflow-hidden rounded-xl bg-line-subtle ring-1 ring-line-subtle md:grid-cols-7">
      {days.map((d) => {
        const topics = [...new Set(d.tasks.map((t) => t.topic))];
        return (
          <li key={d.date} className={cx('flex gap-3 bg-raised px-3 py-3 md:flex-col md:gap-2', d.rest && 'bg-sunken/60')}>
            <div className="w-20 shrink-0 md:w-auto">
              <p className="text-small font-medium text-fg">{dayLabel(d.date, { weekday: 'short' })}</p>
              <p className="num text-caption text-fg-subtle">{dayLabel(d.date, { day: 'numeric', month: 'short' })}</p>
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              {d.rest ? <p className="text-caption text-fg-subtle">Rest</p> : (
                <>
                  <div className="h-1 rounded-full bg-chart-track" aria-hidden="true">
                    <div className="h-1 rounded-full bg-accent" style={{ width: `${Math.min(100, Math.round((d.minutes / Math.max(1, dailyMinutes)) * 100))}%` }} />
                  </div>
                  <p className="num text-caption text-fg-subtle">{d.minutes} min</p>
                  {d.phase === 'mock' && <Badge tone="accent">Mock exam</Badge>}
                  {d.phase === 'light' && <Badge tone="neutral">Light review</Badge>}
                  <ul className="space-y-0.5">
                    {topics.filter((t) => t !== 'All topics').slice(0, 3).map((t) => <li key={t} className="truncate text-caption text-fg-muted" title={t}>{t}</li>)}
                    {topics.length > 3 && <li className="text-caption text-fg-subtle">+{topics.length - 3} more</li>}
                  </ul>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Today: where the student stands, the verdict, today's plan and the week ahead. */
export default function TodayTab({ exam, busyTask, saving, onStart, onCheck, onStatus, onApplyMinutes, onDiagnostic }) {
  const fc = exam.forecast;
  const advice = fc?.advice;
  const todo = exam.today.tasks.filter((t) => t.status === 'todo');
  const nextId = todo[0]?._id;
  const noEvidence = exam.topics.every((t) => !t.evidenceCount);
  const openDiagnostic = exam.openQuizzes.some((q) => q.kind === 'diagnostic');
  const reached = fc?.reached;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-8 px-5 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-line-subtle ring-1 ring-line-subtle sm:grid-cols-3">
          <Stat label="Readiness now" value={pct(fc?.now)} sub="Each topic’s mastery, weighted by its share of the exam" />
          <Stat
            label="Exam-day forecast"
            value={pct(fc?.projected)}
            tone={advice ? (advice.onTrack ? 'success' : 'warning') : undefined}
            sub={`Likely ${pct(fc?.low)}–${pct(fc?.high)} · target ${exam.targetReadiness}%`}
          />
          <Stat
            label="Today"
            value={exam.today.rest ? 'Rest day' : todo.length ? `${todo.reduce((m, t) => m + t.minutes, 0)} min` : 'All done'}
            sub={exam.today.rest ? 'Rest is part of the plan' : `${PHASES[exam.today.phase] || ''}${todo.length ? ` · ${todo.length} task${todo.length === 1 ? '' : 's'} left` : ''}`}
          />
        </div>

        {advice && exam.daysLeft > 0 && (
          advice.onTrack ? (
            <p className="flex items-start gap-2.5 rounded-lg bg-success-soft px-4 py-3 text-small text-success-fg">
              <Icon name="success" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>On track: following this plan reaches your {exam.targetReadiness}% target{reached ? ` by ${dayLabel(reached)}` : ''}.</span>
            </p>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg bg-warning-soft px-4 py-3 sm:flex-row sm:items-center">
              <Icon name="warning" className="h-4 w-4 shrink-0 text-warning-fg" />
              <p className="flex-1 text-small text-warning-fg">
                At {exam.dailyMinutes} min a day you’d reach about {pct(fc.projected)}, short of your {exam.targetReadiness}% target.
                {advice.minutes ? ` ${advice.minutes} min a day would reach ${pct(advice.projected)}.` : ' Even four hours a day falls short: consider a lower target or fewer topics.'}
              </p>
              {advice.minutes && (
                <Button size="sm" variant="secondary" loading={saving} loadingLabel="Re-planning…" onClick={() => onApplyMinutes(advice.minutes)}>
                  Use {advice.minutes} min a day
                </Button>
              )}
            </div>
          )
        )}

        {noEvidence && exam.daysLeft > 0 && (
          <div className="flex flex-col gap-3 rounded-xl px-4 py-4 ring-1 ring-inset ring-line sm:flex-row sm:items-center">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-fg"><Icon name="target" className="h-4 w-4" /></span>
            <div className="flex-1">
              <p className="text-body font-medium text-fg">Calibrate with a 10-question diagnostic</p>
              <p className="text-small text-fg-muted">Autopilot is planning from scratch. A quick test across every topic shows what you already know, so you don’t relearn it.</p>
            </div>
            <Button variant="secondary" onClick={onDiagnostic} loading={busyTask === 'diagnostic'} loadingLabel="Writing it…" icon="sparkles">
              {openDiagnostic ? 'Continue diagnostic' : 'Take the diagnostic'}
            </Button>
          </div>
        )}

        <section>
          <SectionHeader
            title="Today’s plan"
            description={exam.today.rest ? 'A planned rest day.' : exam.today.tasks.length ? `Chosen for the most exam-day readiness per minute. A task is completed only by passing it (${exam.passPercent ?? 50}% or more).` : undefined}
          />
          {exam.today.tasks.length ? (
            <ul className="divide-y divide-line-subtle overflow-hidden rounded-xl bg-raised ring-1 ring-line-subtle">
              {exam.today.tasks.map((t) => <TaskRow key={t._id} task={t} next={t._id === nextId} busy={busyTask === t._id} passPercent={exam.passPercent ?? 50} onStart={onStart} onCheck={onCheck} onStatus={onStatus} />)}
            </ul>
          ) : (
            <p className="rounded-xl bg-sunken px-4 py-8 text-center text-body text-fg-muted">
              {exam.today.phase === 'exam' ? 'It’s exam day. You’ve done the work - good luck.' : exam.today.rest ? 'Rest today. The plan picks up tomorrow.' : 'Nothing planned for today.'}
            </p>
          )}
          {exam.today.tasks.length > 0 && !todo.length && (
            <p className="mt-3 flex items-center gap-2 text-small font-medium text-success-fg"><Icon name="success" className="h-4 w-4" /> Today’s plan is done. Ask the tutor anything, or rest.</p>
          )}
        </section>

        <section>
          <SectionHeader title="The week ahead" description="Autopilot re-plans these days after every result, so they may change." />
          <WeekAhead days={exam.upcoming} dailyMinutes={exam.dailyMinutes} />
        </section>
      </div>
    </div>
  );
}
