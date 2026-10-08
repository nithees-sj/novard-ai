import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ring } from '../profile/charts';
import Icon from '../ui/Icon';
import Badge from '../ui/Badge';
import { buttonClass } from '../ui/Button';
import { chart } from '../../lib/statusColors';
import { examsApi, pct, dayLabel } from '../../lib/exams';

/**
 * The home dashboard's view of Exam Autopilot: the nearest exam, how ready the
 * student is, the forecast and what is planned today. Hidden when there is no
 * upcoming exam (or the tool is unavailable).
 */
export default function NextExamCard() {
  const [exam, setExam] = useState(null);

  useEffect(() => {
    let live = true;
    examsApi.list()
      .then((list) => {
        const next = list.filter((e) => e.status === 'active' && e.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft)[0];
        if (live) setExam(next || null);
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  if (!exam) return null;
  return (
    <section className="mt-6 flex flex-col gap-4 rounded-xl bg-raised p-5 ring-1 ring-line-subtle sm:flex-row sm:items-center" aria-label="Your next exam">
      <Ring value={Math.round(exam.readiness * 100)} size={64} color={chart.brand} label={`Readiness ${pct(exam.readiness)}`} />
      <div className="min-w-0 flex-1">
        <p className="text-caption font-medium text-fg-subtle">Exam Autopilot</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-lead font-semibold text-fg">
          {exam.title}
          <span className="text-small font-normal text-fg-muted">
            {exam.daysLeft === 0 ? 'today' : `in ${exam.daysLeft} day${exam.daysLeft === 1 ? '' : 's'} · ${dayLabel(exam.examDate)}`}
          </span>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-small text-fg-muted">
          Forecast {pct(exam.projected)} on the day
          {exam.onTrack !== null && <Badge tone={exam.onTrack ? 'success' : 'warning'} dot>{exam.onTrack ? 'On track' : 'Needs more time'}</Badge>}
          <span aria-hidden="true">·</span>
          {exam.todayTasks ? `${exam.todayTasks} task${exam.todayTasks === 1 ? '' : 's'} today (${exam.todayMinutes} min)` : 'Nothing left today'}
        </p>
      </div>
      <Link to={`/exams?open=${exam._id}`} className={buttonClass({ variant: exam.todayTasks ? 'primary' : 'secondary' })}>
        <Icon name="exam" /> {exam.todayTasks ? 'Today’s plan' : 'Open plan'}
      </Link>
    </section>
  );
}
