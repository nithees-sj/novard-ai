import React, { useState } from 'react';
import Badge from '../ui/Badge';
import { toneForLevel } from '../../lib/levels';

// Wider than tall: axis labels sit outside the rings and need horizontal room
// ("DevOps & Cloud" at 12px is ~95px) or they are clipped by the viewBox.
const WIDTH = 440;
const HEIGHT = 340;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;
const MAX_RADIUS = 118;
const LABEL_OFFSET = 16;
const RINGS = [20, 40, 60, 80, 100];


const point = (index, count, value) => {
  const angle = ((Math.PI * 2) / count) * index - Math.PI / 2;
  const r = (value / 100) * MAX_RADIUS;
  return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle), angle };
};

const describe = (s) =>
  s.score === null
    ? `${s.name}: not assessed yet (${s.items} ${s.items === 1 ? 'item' : 'items'} studied)`
    : `${s.name}: ${s.score}% quiz accuracy over ${s.questions} questions, ${s.level}`;

/**
 * Quiz accuracy per subject the student has actually studied.
 *
 * Subjects come from the student's own material, not a fixed list, and a
 * subject with no quiz results is shown as "not assessed" rather than being
 * given a made-up value (the previous version used Math.random()). A radar
 * needs at least three axes to mean anything, so with fewer subjects only the
 * list is shown. The list doubles as the accessible table view.
 */
const SkillProficiencyRadar = ({ skills = [] }) => {
  const [active, setActive] = useState(null);
  const showRadar = skills.length >= 3;
  const n = skills.length;

  const points = skills.map((s, i) => ({ ...point(i, n, s.score ?? 0), skill: s }));
  const polygon = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <div className="flex flex-col rounded-xl bg-raised p-5 ring-1 ring-line-subtle">
      <div className="mb-4">
        <h3 className="text-body font-semibold text-fg">Proficiency by subject</h3>
        <p className="mt-0.5 text-small text-fg-subtle">Quiz accuracy by subject · recent results count more</p>
      </div>

      {n === 0 ? (
        <div className="flex-1 min-h-[8rem] flex items-center justify-center px-6 text-center text-body text-fg-subtle">
          Study a topic and take a quiz on it to see your proficiency here.
        </div>
      ) : (
        <>
          {showRadar && (
            <div className="relative mx-auto w-full max-w-[440px]">
              <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto overflow-visible" role="img" aria-label="Skill proficiency by subject">
                {RINGS.map((r) => (
                  <circle key={r} cx={CX} cy={CY} r={(r / 100) * MAX_RADIUS} fill="none" className="stroke-chart-track" strokeWidth="1" />
                ))}
                {points.map((_, i) => {
                  const end = point(i, n, 100);
                  return <line key={i} x1={CX} y1={CY} x2={end.x} y2={end.y} className="stroke-chart-track" strokeWidth="1" />;
                })}

                <path d={polygon} className="fill-accent/10 stroke-accent" strokeWidth="2" strokeLinejoin="round" />

                {points.map((p, i) => {
                  const assessed = p.skill.score !== null;
                  const label = point(i, n, 100);
                  const lx = CX + (MAX_RADIUS + LABEL_OFFSET) * Math.cos(label.angle);
                  const ly = CY + (MAX_RADIUS + LABEL_OFFSET) * Math.sin(label.angle);
                  const anchor = Math.abs(Math.cos(label.angle)) < 0.2 ? 'middle' : Math.cos(label.angle) > 0 ? 'start' : 'end';
                  // Labels above the chart stack upward so the value line never runs into the rings.
                  const lift = Math.sin(label.angle) < -0.3 ? -14 : 0;
                  return (
                    <g key={p.skill.name}>
                      <text x={lx} y={ly + lift} textAnchor={anchor} dominantBaseline="middle" className="fill-fg-muted" fontSize="12" fontWeight="600">
                        {p.skill.name}
                      </text>
                      <text x={lx} y={ly + lift + 14} textAnchor={anchor} dominantBaseline="middle" className="fill-fg-subtle" fontSize="11">
                        {assessed ? `${p.skill.score}%` : 'not assessed'}
                      </text>
                      {/* visible marker: filled when assessed, hollow when not */}
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={active === i ? 6 : 4.5}
                        className={assessed ? 'fill-accent stroke-raised' : 'fill-raised stroke-fg-subtle'}
                        strokeWidth="2"
                      />
                      {/* hit target larger than the mark */}
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="14"
                        fill="transparent"
                        tabIndex={0}
                        role="button"
                        aria-label={describe(p.skill)}
                        className="cursor-pointer focus:outline-none"
                        onMouseEnter={() => setActive(i)}
                        onMouseLeave={() => setActive(null)}
                        onFocus={() => setActive(i)}
                        onBlur={() => setActive(null)}
                      />
                    </g>
                  );
                })}
              </svg>

              {active !== null && (
                <div
                  role="tooltip"
                  className="absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-tooltip px-3 py-2 shadow-popover pointer-events-none"
                  style={{ left: `${(points[active].x / WIDTH) * 100}%`, top: `calc(${(points[active].y / HEIGHT) * 100}% - 12px)` }}
                >
                  <span className="block text-small font-semibold text-tooltip-fg tabular">
                    {points[active].skill.score === null ? 'Not assessed' : `${points[active].skill.score}%`}
                  </span>
                  <span className="block text-micro text-tooltip-muted">{points[active].skill.name}</span>
                  <span className="block text-micro text-tooltip-muted">
                    {points[active].skill.questions} questions · {points[active].skill.items} studied
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Always-visible values (also the table view) */}
          <ul className={`space-y-2 ${showRadar ? 'mt-4 pt-4 border-t border-line-subtle' : ''}`}>
            {skills.map((s) => (
              <li key={s.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body sm:flex-nowrap">
                <span className="min-w-0 flex-1 truncate font-medium text-fg sm:w-32 sm:flex-none" title={s.name}>{s.name}</span>
                <span className="order-last h-1.5 w-full overflow-hidden rounded-full bg-chart-track sm:order-none sm:w-auto sm:flex-1" aria-hidden="true">
                  {s.score !== null && (
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${s.score}%` }} />
                  )}
                </span>
                <span className="num shrink-0 text-right text-small text-fg-muted sm:w-24">
                  {s.score === null ? <span className="text-fg-subtle">—</span> : `${s.score}%`}
                  <span className="text-xs text-fg-subtle"> · {s.questions}q</span>
                </span>
                <Badge tone={toneForLevel(s.level)} className="shrink-0">
                  {s.score === null ? 'Take a quiz' : s.level}
                </Badge>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default SkillProficiencyRadar;
