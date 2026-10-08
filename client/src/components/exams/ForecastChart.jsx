import React from 'react';
import { useWidth } from '../profile/charts';
import { chart, tone } from '../../lib/statusColors';
import { dayLabel } from '../../lib/exams';

const DAY_MS = 864e5;
const t = (day) => Date.parse(`${day}T00:00:00Z`);

/**
 * Readiness over time: what the student has actually reached (solid), the
 * plan's projection to exam day (dashed) with a fan for slower and faster
 * progress, the target line, and today. Values are 0-1.
 */
export default function ForecastChart({ snapshots = [], series = [], low, high, target, today, examDate, height = 220 }) {
  const [ref, width] = useWidth();
  const pad = { top: 16, right: 16, bottom: 28, left: 40 };
  const w = Math.max(0, width - pad.left - pad.right);
  const h = height - pad.top - pad.bottom;

  const start = snapshots[0]?.date && snapshots[0].date < today ? snapshots[0].date : today;
  const span = Math.max(1, (t(examDate) - t(start)) / DAY_MS);
  const x = (day) => pad.left + ((t(day) - t(start)) / DAY_MS / span) * w;
  const y = (v) => pad.top + h - Math.max(0, Math.min(1, v)) * h;
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.readiness).toFixed(1)}`).join(' ');

  const actual = snapshots.filter((s) => s.date <= today);
  const projection = series.length ? series : [];
  const projected = projection.at(-1)?.readiness;
  const fanFrom = projection[0] || actual.at(-1);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const dateTicks = [start, today, examDate].filter((d, i, a) => a.indexOf(d) === i);

  const label = `Readiness ${Math.round((actual.at(-1)?.readiness || 0) * 100)}% today; forecast ${Math.round((projected || 0) * 100)}% on exam day (range ${Math.round((low || 0) * 100)}-${Math.round((high || 0) * 100)}%), target ${Math.round(target * 100)}%.`;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.left} x2={pad.left + w} y1={y(v)} y2={y(v)} style={{ stroke: chart.grid }} strokeWidth="1" />
              <text x={pad.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-fg-subtle text-micro tabular-nums">{Math.round(v * 100)}%</text>
            </g>
          ))}

          {/* Slower and faster progress: a fan from today to exam day. */}
          {fanFrom && Number.isFinite(low) && Number.isFinite(high) && (
            <polygon
              points={`${x(fanFrom.date)},${y(fanFrom.readiness)} ${x(examDate)},${y(high)} ${x(examDate)},${y(low)}`}
              style={{ fill: chart.brand }}
              fillOpacity="0.1"
            />
          )}

          {/* Target */}
          <line x1={pad.left} x2={pad.left + w} y1={y(target)} y2={y(target)} style={{ stroke: tone.success }} strokeWidth="1.5" strokeDasharray="2 4" />
          <text x={pad.left + 4} y={y(target) - 6} className="text-micro font-medium" style={{ fill: tone.success }}>Target {Math.round(target * 100)}%</text>

          {/* Today */}
          <line x1={x(today)} x2={x(today)} y1={pad.top} y2={pad.top + h} style={{ stroke: chart.axis }} strokeWidth="1" strokeDasharray="3 3" />

          {projection.length > 1 && (
            <path d={path(projection)} fill="none" style={{ stroke: chart.brand }} strokeWidth="2" strokeDasharray="6 5" strokeLinecap="round" />
          )}
          {actual.length > 1 && <path d={path(actual)} fill="none" style={{ stroke: chart.brand }} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
          {actual.map((p) => <circle key={p.date} cx={x(p.date)} cy={y(p.readiness)} r="3" style={{ fill: chart.brand }} />)}

          {Number.isFinite(projected) && (
            <g>
              <circle cx={x(examDate)} cy={y(projected)} r="4.5" style={{ fill: chart.surface, stroke: chart.brand }} strokeWidth="2" />
              <text x={x(examDate) - 8} y={y(projected) - 10} textAnchor="end" className="fill-fg text-caption font-semibold tabular-nums">{Math.round(projected * 100)}%</text>
            </g>
          )}

          {dateTicks.map((d) => (
            <text key={d} x={x(d)} y={height - 8} textAnchor={d === start ? 'start' : d === examDate ? 'end' : 'middle'} className="fill-fg-subtle text-micro">
              {d === today ? 'Today' : d === examDate ? `Exam · ${dayLabel(d, { day: 'numeric', month: 'short' })}` : dayLabel(d, { day: 'numeric', month: 'short' })}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}
