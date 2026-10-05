import React, { useEffect, useId, useRef, useState } from 'react';
import { chart } from '../../lib/statusColors';

/**
 * Small SVG chart primitives for the profile page. No chart library: each is a
 * few dozen lines, matches the dashboard's hand-built charts, and keeps the
 * bundle small. All take plain arrays and render an accessible data table.
 */

/** Width of an element, kept current on resize, so SVG text and dots never stretch. */
export function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

const niceMax = (v, steps = [10, 20, 25, 50, 100, 200, 250, 500, 1000]) => steps.find((s) => s >= v) || Math.ceil(v / 1000) * 1000;

/**
 * Line/area chart with hover. points: [{ label, value, sub? }].
 * `max` fixes the y-axis (e.g. 100 for percentages); otherwise it rounds up.
 * `thresholds` draws dashed reference lines: [{ value, label, color }].
 * `decimals` keeps fractional axis ticks (for 0-1 scores).
 */
export const LineChart = ({ points, height = 200, max, unit = '', color = chart.brand, emptyText = 'No data yet', caption, thresholds = [], decimals = 0 }) => {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { top: 16, right: 12, bottom: 26, left: 36 };
  const w = Math.max(0, width - pad.left - pad.right);
  const h = height - pad.top - pad.bottom;
  const top = max || niceMax(Math.max(1, ...points.map((p) => p.value)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => (decimals ? Number((top * f).toFixed(decimals)) : Math.round(top * f)));
  const x = (i) => pad.left + (points.length <= 1 ? w / 2 : (i / (points.length - 1)) * w);
  const y = (v) => pad.top + h - (v / top) * h;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');
  const area = points.length > 1 ? `${line} L${x(points.length - 1)},${pad.top + h} L${x(0)},${pad.top + h} Z` : '';
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(w / 64))));
  // Colours are CSS variables (rgb(var(--…))), so the id cannot be built from them.
  const gradientId = `lc-${useId().replace(/:/g, '')}`;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {points.length === 0 ? (
        <div className="h-full flex items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">{emptyText}</div>
      ) : width > 0 && (
        <svg width={width} height={height} role="img" aria-label={caption} onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" style={{ stopColor: color }} stopOpacity="0.22" />
              <stop offset="100%" style={{ stopColor: color }} stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={pad.left + w} y1={y(t)} y2={y(t)} className="stroke-chart-grid" />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-gray-400 text-[10px] tabular-nums">{t}{unit}</text>
            </g>
          ))}
          {area && <path d={area} fill={`url(#${gradientId})`} />}
          {thresholds.filter((t) => t.value <= top).map((t) => (
            <g key={t.label}>
              <line x1={pad.left} x2={pad.left + w} y1={y(t.value)} y2={y(t.value)} style={{ stroke: t.color || chart.axis }} strokeDasharray="4 4" />
              <text x={pad.left + w} y={y(t.value) - 3} textAnchor="end" className="fill-gray-500 text-[10px]" style={t.color ? { fill: t.color } : undefined}>{t.label}</text>
            </g>
          ))}
          <path d={line} fill="none" style={{ stroke: color }} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <g key={i}>
              {(i === points.length - 1 || (i % labelEvery === 0 && points.length - 1 - i >= labelEvery)) && (
                <text x={x(i)} y={height - 6} textAnchor={i === points.length - 1 && points.length > 1 ? 'end' : i === 0 && points.length > 1 ? 'start' : 'middle'} className="fill-gray-500 text-[10px]">{p.label}</text>
              )}
              <circle cx={x(i)} cy={y(p.value)} r={hover === i ? 5 : 3} style={{ fill: chart.surface, stroke: color }} strokeWidth="2" />
              <rect
                x={x(i) - (points.length > 1 ? w / (points.length - 1) / 2 : w / 2)}
                width={points.length > 1 ? w / (points.length - 1) : w}
                y={pad.top}
                height={h}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + h} className="stroke-chart-line" strokeDasharray="3 3" pointerEvents="none" />}
        </svg>
      )}
      {hover !== null && points[hover] && (
        <div
          role="tooltip"
          className="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-full rounded-lg bg-tooltip px-3 py-2 shadow-lg whitespace-nowrap"
          style={{ left: x(hover), top: y(points[hover].value) - 10 }}
        >
          <span className="block text-sm font-bold text-tooltip-fg tabular-nums">{points[hover].value}{unit}</span>
          <span className="block text-[11px] text-tooltip-muted">{points[hover].sub || points[hover].label}</span>
        </div>
      )}
      <table className="sr-only">
        {caption && <caption>{caption}</caption>}
        <tbody>{points.map((p, i) => <tr key={i}><td>{p.sub || p.label}</td><td>{p.value}{unit}</td></tr>)}</tbody>
      </table>
    </div>
  );
};

/** Donut with a centre label. segments: [{ label, value, color }]. */
export const Donut = ({ segments, size = 168, thickness = 22, centerValue, centerLabel }) => {
  const total = segments.reduce((n, s) => n + s.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(', ')} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-chart-grid" strokeWidth={thickness} />
      {total > 0 && segments.map((s) => {
        const len = (s.value / total) * c;
        const el = (
          <circle
            key={s.label}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            style={{ stroke: s.color }}
            strokeWidth={thickness}
            strokeDasharray={`${Math.max(0, len - (segments.length > 1 ? 2 : 0))} ${c}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          >
            <title>{`${s.label}: ${s.value}`}</title>
          </circle>
        );
        offset += len;
        return el;
      })}
      <text x="50%" y="47%" textAnchor="middle" className="fill-gray-900 text-xl font-bold">{centerValue}</text>
      <text x="50%" y="60%" textAnchor="middle" className="fill-gray-500 text-[11px]">{centerLabel}</text>
    </svg>
  );
};

/** Circular progress ring, 0-100. */
export const Ring = ({ value, size = 64, thickness = 7, color = chart.brand, label }) => {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label || `${v}%`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-chart-track" strokeWidth={thickness} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        style={{ stroke: color }}
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeDasharray={`${(v / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle" className="fill-gray-900 text-[13px] font-bold tabular-nums">{v}%</text>
    </svg>
  );
};

/** Horizontal bars. rows: [{ label, value, max?, note?, color? }]. */
export const BarList = ({ rows, max = 100, unit = '%', emptyText = 'No data yet' }) => {
  if (!rows.length) return <p className="text-sm text-gray-500 py-4">{emptyText}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <span className="text-sm font-medium text-gray-800 truncate">{r.label}</span>
            <span className="text-sm tabular-nums shrink-0">
              <span className="font-bold text-gray-900">{r.value}{unit}</span>
              {r.note && <span className="text-xs text-gray-500"> · {r.note}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100" role="meter" aria-valuemin={0} aria-valuemax={r.max || max} aria-valuenow={r.value} aria-label={r.label}>
            <div className={`h-2 rounded-full ${r.color || 'bg-blue-500'}`} style={{ width: `${Math.min(100, (r.value / (r.max || max)) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
};

// Opacity steps of one blue, so "more" reads as stronger on both a white and a dark page.
const HEAT = ['bg-gray-100', 'bg-blue-500/25', 'bg-blue-500/50', 'bg-blue-500/75', 'bg-blue-600'];
const heatLevel = (count, peak) => (count === 0 ? 0 : Math.min(4, Math.ceil((count / Math.max(1, peak)) * 4)));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** GitHub-style calendar: one column per week, Sunday at the top. days: [{ date, count, minutes }]. */
export const Heatmap = ({ days }) => {
  const [hover, setHover] = useState(null);
  const peak = Math.max(1, ...days.map((d) => d.count));
  const weeks = [];
  days.forEach((d, i) => {
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push(d);
  });
  const month = (week) => Number(week[0].date.slice(5, 7)) - 1;
  const fmt = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  // Column-major grid: a label column, then one column per week (month label + 7 days).
  const cells = [<span key="corner" />];
  ['', 'Mon', '', 'Wed', '', 'Fri', ''].forEach((l, i) => cells.push(
    <span key={`wd${i}`} className="self-center text-[10px] leading-none text-gray-500" aria-hidden="true">{l}</span>
  ));
  weeks.forEach((week, wi) => {
    const showMonth = wi === 0 ? week[0].date.slice(8) <= '21' : month(week) !== month(weeks[wi - 1]);
    cells.push(
      <span key={`m${week[0].date}`} className="text-[10px] leading-[14px] text-gray-500 whitespace-nowrap overflow-visible" aria-hidden="true">
        {showMonth ? MONTHS[month(week)] : ''}
      </span>
    );
    for (let i = 0; i < 7; i += 1) {
      const d = week[i];
      cells.push(d ? (
        <span
          key={d.date}
          tabIndex={0}
          onMouseEnter={() => setHover(d)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(d)}
          onBlur={() => setHover(null)}
          aria-label={`${fmt(d.date)}: ${d.count} activities`}
          className={`block w-full aspect-square rounded-sm ${HEAT[heatLevel(d.count, peak)]} outline-none focus-visible:ring-2 focus-visible:ring-primary-400 hover:ring-1 hover:ring-gray-400`}
        />
      ) : <span key={`pad${wi}-${i}`} />);
    }
  });

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div
          className="grid gap-[3px] min-w-[640px]"
          style={{ gridTemplateColumns: `28px repeat(${weeks.length}, minmax(0, 1fr))`, gridTemplateRows: '14px repeat(7, auto)', gridAutoFlow: 'column' }}
        >
          {cells}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span className="min-h-[1rem]" aria-live="polite">
          {hover ? <><strong className="text-gray-800">{hover.count} {hover.count === 1 ? 'activity' : 'activities'}</strong> on {fmt(hover.date)}{hover.minutes ? ` · ~${hover.minutes} min` : ''}</> : 'Hover a day to see what you did'}
        </span>
        <span className="flex items-center gap-1">
          Less {HEAT.map((c) => <span key={c} className={`w-3 h-3 rounded-sm ${c}`} aria-hidden="true" />)} More
        </span>
      </div>
    </div>
  );
};

/** A tiny trend line for tables and cards. values: numbers (oldest first). */
export const Sparkline = ({ values = [], width = 96, height = 28, max, color = chart.brand, label }) => {
  if (!values.length) return <span className="text-xs text-gray-500">no data</span>;
  const top = max ?? Math.max(...values, 0.0001);
  const x = (i) => (values.length === 1 ? width / 2 : (i / (values.length - 1)) * (width - 4) + 2);
  const y = (v) => height - 3 - (Math.min(v, top) / top) * (height - 6);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} role="img" aria-label={label || `trend, latest ${values[values.length - 1]}`} className="shrink-0 overflow-visible">
      <path d={d} fill="none" style={{ stroke: color }} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="2.5" style={{ fill: color }} />
    </svg>
  );
};

/** Vertical bars with hover. bars: [{ label, value, sub?, color? }]. */
export const ColumnChart = ({ bars = [], height = 180, unit = '', color = chart.brand, emptyText = 'No data yet', caption, format = (v) => v }) => {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { top: 12, right: 8, bottom: 24, left: 8 };
  const w = Math.max(0, width - pad.left - pad.right);
  const h = height - pad.top - pad.bottom;
  const top = Math.max(...bars.map((b) => b.value), 0) || 1;
  const slot = bars.length ? w / bars.length : 0;
  const barW = Math.max(2, Math.min(28, slot * 0.7));
  const labelEvery = Math.max(1, Math.ceil(bars.length / Math.max(1, Math.floor(w / 56))));
  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {!bars.length ? (
        <div className="flex h-full items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">{emptyText}</div>
      ) : width > 0 && (
        <svg width={width} height={height} role="img" aria-label={caption} onMouseLeave={() => setHover(null)}>
          <line x1={pad.left} x2={pad.left + w} y1={pad.top + h} y2={pad.top + h} className="stroke-chart-track" />
          {bars.map((b, i) => {
            const bh = (b.value / top) * h;
            const cx = pad.left + slot * i + slot / 2;
            return (
              <g key={`${b.label}-${i}`} onMouseEnter={() => setHover(i)}>
                <rect x={cx - slot / 2} y={pad.top} width={slot} height={h} fill="transparent" />
                <rect x={cx - barW / 2} y={pad.top + h - bh} width={barW} height={Math.max(bh, b.value ? 1 : 0)} rx="2" style={{ fill: b.color || color }} opacity={hover === null || hover === i ? 1 : 0.55} />
                {(i % labelEvery === 0 || i === bars.length - 1) && <text x={cx} y={height - 6} textAnchor="middle" className="fill-gray-500 text-[10px]">{b.label}</text>}
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && bars[hover] && (
        <div role="tooltip" className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-tooltip px-3 py-2 shadow-lg" style={{ left: pad.left + slot * hover + slot / 2 }}>
          <span className="block text-sm font-bold tabular-nums text-tooltip-fg">{format(bars[hover].value)}{unit}</span>
          <span className="block text-[11px] text-tooltip-muted">{bars[hover].sub || bars[hover].label}</span>
        </div>
      )}
      <table className="sr-only">
        {caption && <caption>{caption}</caption>}
        <tbody>{bars.map((b, i) => <tr key={i}><td>{b.sub || b.label}</td><td>{format(b.value)}{unit}</td></tr>)}</tbody>
      </table>
    </div>
  );
};
