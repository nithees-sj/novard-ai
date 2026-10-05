import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Ring } from './charts';
import { readinessColor } from '../../lib/statusColors';

const STATUS = {
  completed: { label: 'Completed', badge: 'bg-success-soft text-success-fg', bar: 'bg-success' },
  'in-progress': { label: 'In progress', badge: 'bg-accent-soft text-accent-fg', bar: 'bg-accent' },
  'not-started': { label: 'Not started', badge: 'bg-sunken text-fg-muted', bar: 'bg-fg-disabled' },
};
const PRIORITY = { high: 'bg-danger-soft text-danger-fg border-transparent', medium: 'bg-warning-soft text-warning-fg border-transparent', low: 'bg-sunken text-fg-muted border-transparent' };
// "Security – Secrets Management (HashiCorp Vault)" -> "Security – Secrets Management"
const shortSkill = (s) => String(s).replace(/\s*\([^)]*\)?/g, '').replace(/[\s&,–-]+$/, '').trim();
const shortDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');

const Column = ({ title, count, action, onAction, empty, children }) => (
  <div className="flex min-w-0 flex-col rounded-xl bg-raised ring-1 ring-line-subtle">
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line-subtle">
      <h3 className="text-sm font-bold text-fg">
        {title} <span className="ml-1 text-xs font-semibold text-fg-subtle tabular-nums">{count}</span>
      </h3>
      <button type="button" onClick={onAction} className="text-xs font-semibold text-accent-fg hover:underline whitespace-nowrap">{action} →</button>
    </div>
    <div className="p-5 flex-1">
      {count === 0 ? <p className="text-sm text-fg-subtle text-center py-6">{empty}</p> : <ul className="space-y-4">{children}</ul>}
    </div>
  </div>
);

/**
 * Where the student is on each path they have started: day-by-day skill
 * plans, AI roadmaps towards a role, and skill-gap analyses.
 */
const LearningPath = ({ path }) => {
  const navigate = useNavigate();
  const plans = path?.plans || [];
  const roadmaps = path?.roadmaps || [];
  const gaps = path?.skillGaps || [];
  const planDays = plans.reduce((n, p) => n + p.totalDays, 0);
  const doneDays = plans.reduce((n, p) => n + p.completedDays, 0);

  return (
    <div className="space-y-6">
      {plans.length > 0 && (
        <div className="flex flex-wrap items-center gap-6 rounded-xl bg-raised p-5 ring-1 ring-line-subtle">
          <Ring value={planDays ? Math.round((doneDays / planDays) * 100) : 0} size={72} label="Skill plan days completed" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-fg">{doneDays} of {planDays} plan days completed</p>
            <p className="text-xs text-fg-subtle mt-0.5">
              {plans.filter((p) => p.status === 'in-progress').length} in progress · {plans.filter((p) => p.status === 'completed').length} completed · {plans.filter((p) => p.status === 'not-started').length} not started
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Column title="Skill plans" count={plans.length} action="Skill Plans" onAction={() => navigate('/skill-unlocker')} empty="No skill plans yet. Create one in Skill Plans.">
          {plans.slice(0, 5).map((p) => {
            const s = STATUS[p.status];
            return (
              <li key={p.id}>
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-fg capitalize truncate">{p.name}</p>
                    <p className="text-xs text-fg-subtle truncate" title={p.nextTopic || ''}>{p.nextTopic ? `Next: ${p.nextTopic}` : 'All days done'}</p>
                  </div>
                  <span className={`shrink-0 rounded-sm px-1.5 py-0.5 text-caption font-medium ${s.badge}`}>{s.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-sunken" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percentage} aria-label={`${p.name} progress`}>
                    <div className={`h-2 rounded-full ${s.bar}`} style={{ width: `${p.percentage}%` }} />
                  </div>
                  <span className="text-xs tabular-nums text-fg-muted w-14 text-right">{p.completedDays}/{p.totalDays} days</span>
                </div>
                {p.bestQuiz !== null && <p className="text-micro text-fg-subtle mt-1">Best quiz {p.bestQuiz}% · {p.quizzes} taken</p>}
              </li>
            );
          })}
        </Column>

        <Column title="Career roadmaps" count={roadmaps.length} action="Smart Roadmap" onAction={() => navigate('/career?tool=roadmap')} empty="No roadmaps yet. Generate one for the role you want.">
          {roadmaps.slice(0, 4).map((r) => (
            <li key={r.id} className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg truncate">{r.role}</p>
                  <p className="text-xs text-fg-subtle">
                    {r.stages} stages · {r.topics} topics{r.totalWeeks ? ` · ${r.totalWeeks} weeks` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-micro text-fg-subtle">{shortDate(r.createdAt)}</span>
              </div>
              <ol className="mt-2.5 space-y-1.5 border-l border-line ml-2">
                {r.stageTitles.map((t, i) => (
                  <li key={`${t}-${i}`} className="relative pl-4 text-xs text-fg-muted" title={t}>
                    <span className="absolute -left-[7px] top-0.5 w-3 h-3 rounded-full bg-raised border-2 border-primary-400" aria-hidden="true" />
                    <span className="block truncate"><span className="font-semibold text-accent-fg tabular-nums">{i + 1}.</span> {t}</span>
                  </li>
                ))}
              </ol>
              {r.topics > 0 && (
                <p className="text-micro text-fg-subtle mt-1.5">{r.knownTopics} of {r.topics} topics already known when generated</p>
              )}
            </li>
          ))}
        </Column>

        <Column title="Skill gap analyses" count={gaps.length} action="Skill Gap coach" onAction={() => navigate('/career?tool=skills')} empty="No analyses yet. Tell the coach your target role.">
          {gaps.slice(0, 4).map((g) => (
            <li key={g.id} className="flex gap-4">
              <Ring value={g.readiness} size={52} thickness={6} color={readinessColor(g.readiness)} label={`${g.targetRole} readiness`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg truncate">{g.targetRole}</p>
                <p className="text-xs text-fg-subtle">{g.strengths} skills covered · {g.gaps} to learn · {Math.max(0, g.messages - 1)} messages</p>
                {g.topGaps.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1 min-w-0">
                    {g.topGaps.map((t) => (
                      <span key={t.skill} title={t.skill} className={`text-micro px-1.5 py-0.5 rounded border truncate max-w-full ${PRIORITY[t.priority] || PRIORITY.low}`}>{shortSkill(t.skill)}</span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </Column>
      </div>
    </div>
  );
};

export default LearningPath;
