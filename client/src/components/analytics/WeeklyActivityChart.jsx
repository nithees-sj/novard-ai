import React, { useMemo, useState } from 'react';

const formatMinutes = (minutes) => {
  const m = Math.round(minutes || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
};

const formatDate = (isoDay) =>
  new Date(`${isoDay}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

/** Round the axis up to a clean step so ticks read 0 / 15 / 30 / 45, never 0 / 13 / 26. */
function niceScale(maxValue) {
  const steps = [5, 10, 15, 30, 60, 120, 180, 240];
  const step = steps.find((s) => maxValue / s <= 4) || 240;
  const top = Math.max(step, Math.ceil(maxValue / step) * step);
  const ticks = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  return { top, ticks };
}

const PLOT_HEIGHT = 160;

/**
 * Study time for the last seven days, one column per day: the time actually
 * spent in the app (tracked while the student is active), or - for days from
 * before tracking existed - an estimate from saved activity, drawn lighter
 * and labelled as such. Every column has a hover/focus tooltip, and the same
 * numbers are in a visually hidden table for screen readers.
 */
const WeeklyActivityChart = ({ weekly }) => {
  const [active, setActive] = useState(null);
  const days = useMemo(() => weekly?.days || [], [weekly]);
  const maxMinutes = Math.max(0, ...days.map((d) => d.minutes));
  const { top, ticks } = niceScale(maxMinutes || 1);
  const peakIndex = maxMinutes > 0 ? days.findIndex((d) => d.minutes === maxMinutes) : -1;

  const total = weekly?.totalMinutes || 0;
  const previous = weekly?.previousTotalMinutes || 0;
  const delta = total - previous;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Study time this week</h3>
          <p className="text-sm text-gray-500">
            Time you spent active in the app, updated every minute
          </p>
          {weekly?.estimated && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary-200" aria-hidden="true" />
              Lighter bars: days before time tracking, estimated from your activity
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{formatMinutes(total)}</div>
          <div className="text-xs text-gray-500">
            {weekly?.activeDays || 0} of 7 days active
            {(total > 0 || previous > 0) && (
              <span className={delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-500'}>
                {' · '}
                {delta === 0 ? 'same as' : `${delta > 0 ? '+' : '−'}${formatMinutes(Math.abs(delta))} vs`} last week
              </span>
            )}
          </div>
        </div>
      </div>

      {maxMinutes === 0 ? (
        <div className="h-40 flex items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
          No study activity in the last 7 days yet
        </div>
      ) : (
        <div className="flex gap-3 pt-2">
          {/* y-axis */}
          <div className="relative w-10 shrink-0" style={{ height: PLOT_HEIGHT }} aria-hidden="true">
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute right-0 -translate-y-1/2 text-[11px] text-gray-400 tabular-nums"
                style={{ bottom: `${(t / top) * 100}%` }}
              >
                {t}m
              </span>
            ))}
          </div>

          <div className="flex-1 min-w-0">
            <div className="relative" style={{ height: PLOT_HEIGHT }}>
              {/* hairline gridlines */}
              {ticks.map((t) => (
                <div
                  key={t}
                  className="absolute left-0 right-0 border-t border-gray-100"
                  style={{ bottom: `${(t / top) * 100}%` }}
                  aria-hidden="true"
                />
              ))}

              <div className="absolute inset-0 flex items-end">
                {days.map((d, i) => {
                  const height = (d.minutes / top) * 100;
                  const isActive = active === i;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      className="relative flex-1 h-full flex items-end justify-center focus:outline-none group"
                      onMouseEnter={() => setActive(i)}
                      onMouseLeave={() => setActive(null)}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive(null)}
                      aria-label={`${formatDate(d.date)}: ${formatMinutes(d.minutes)}${d.tracked ? '' : ' (estimated)'}, ${d.activities} activities, ${d.quizzes} quizzes`}
                    >
                      {/* value on the peak column only - the tooltip carries the rest */}
                      {i === peakIndex && !isActive && (
                        <span
                          className="absolute text-[11px] font-semibold text-gray-700 tabular-nums"
                          style={{ bottom: `calc(${height}% + 4px)` }}
                        >
                          {formatMinutes(d.minutes)}
                        </span>
                      )}
                      <span
                        className={`block w-full max-w-[24px] rounded-t-[4px] transition-colors ${
                          d.tracked
                            ? (isActive ? 'bg-primary-700' : 'bg-primary-500 group-hover:bg-primary-600')
                            : (isActive ? 'bg-primary-400' : 'bg-primary-200 group-hover:bg-primary-300')
                        } group-focus-visible:ring-2 group-focus-visible:ring-primary-300`}
                        style={{ height: d.minutes > 0 ? `max(${height}%, 3px)` : 0 }}
                      />
                      {isActive && (
                        <span
                          role="tooltip"
                          className="absolute z-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-left shadow-lg pointer-events-none"
                          style={{ bottom: `calc(${height}% + 10px)` }}
                        >
                          <span className="block text-sm font-bold text-white">
                            {formatMinutes(d.minutes)}
                            <span className="ml-1.5 text-[10px] font-medium text-gray-400">{d.tracked ? 'in the app' : 'estimated'}</span>
                          </span>
                          <span className="block text-[11px] text-gray-300">{formatDate(d.date)}</span>
                          <span className="block text-[11px] text-gray-300">
                            {d.activities} {d.activities === 1 ? 'activity' : 'activities'}
                            {d.quizzes > 0 && ` · ${d.quizzes} ${d.quizzes === 1 ? 'quiz' : 'quizzes'}`}
                          </span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* baseline + day labels */}
            <div className="border-t border-gray-200 flex" aria-hidden="true">
              {days.map((d, i) => (
                <span
                  key={d.date}
                  className={`flex-1 pt-2 text-center text-xs ${
                    i === days.length - 1 ? 'font-semibold text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {i === days.length - 1 ? 'Today' : d.day}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <table className="sr-only">
        <caption>Study time per day, last 7 days (tracked time in the app; earlier days estimated)</caption>
        <thead>
          <tr><th>Day</th><th>Minutes</th><th>Source</th><th>Activities</th><th>Quizzes</th></tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <td>{formatDate(d.date)}</td>
              <td>{d.minutes}</td>
              <td>{d.tracked ? 'Tracked' : 'Estimated'}</td>
              <td>{d.activities}</td>
              <td>{d.quizzes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default WeeklyActivityChart;
