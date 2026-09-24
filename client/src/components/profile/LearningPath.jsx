import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Ring } from './charts';

const STATUS = {
  completed: { label: 'Completed', badge: 'bg-green-100 text-green-700', bar: 'bg-green-500' },
  'in-progress': { label: 'In progress', badge: 'bg-primary-100 text-primary-800', bar: 'bg-primary-500' },
  'not-started': { label: 'Not started', badge: 'bg-gray-100 text-gray-600', bar: 'bg-gray-300' },
};
const PRIORITY = { high: 'bg-red-50 text-red-700 border-red-100', medium: 'bg-amber-50 text-amber-800 border-amber-100', low: 'bg-gray-50 text-gray-600 border-gray-200' };
const readinessColor = (r) => (r >= 75 ? '#16a34a' : r >= 50 ? '#0284c7' : r >= 25 ? '#d97706' : '#dc2626');
// "Security – Secrets Management (HashiCorp Vault)" -> "Security – Secrets Management"
const shortSkill = (s) => String(s).replace(/\s*\([^)]*\)?/g, '').replace(/[\s&,–-]+$/, '').trim();
const shortDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');

const Column = ({ title, count, action, onAction, empty, children }) => (
  <div className="bg-white rounded-xl border border-gray-200 flex flex-col min-w-0">
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
      <h3 className="text-sm font-bold text-gray-900">
        {title} <span className="ml-1 text-xs font-semibold text-gray-400 tabular-nums">{count}</span>
      </h3>
      <button type="button" onClick={onAction} className="text-xs font-semibold text-primary-700 hover:underline whitespace-nowrap">{action} →</button>
    </div>
    <div className="p-5 flex-1">
      {count === 0 ? <p className="text-sm text-gray-500 text-center py-6">{empty}</p> : <ul className="space-y-4">{children}</ul>}
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
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-wrap items-center gap-6">
          <Ring value={planDays ? Math.round((doneDays / planDays) * 100) : 0} size={72} label="Skill plan days completed" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">{doneDays} of {planDays} plan days completed</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {plans.filter((p) => p.status === 'in-progress').length} in progress · {plans.filter((p) => p.status === 'completed').length} completed · {plans.filter((p) => p.status === 'not-started').length} not started
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Column title="Skill plans" count={plans.length} action="Skill Unlocker" onAction={() => navigate('/skill-unlocker')} empty="No skill plans yet. Create one in Skill Unlocker.">
          {plans.slice(0, 5).map((p) => {
            const s = STATUS[p.status];
            return (
              <li key={p.id}>
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 capitalize truncate">{p.name}</p>
                    <p className="text-xs text-gray-500 truncate" title={p.nextTopic || ''}>{p.nextTopic ? `Next: ${p.nextTopic}` : 'All days done'}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${s.badge}`}>{s.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-gray-100" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percentage} aria-label={`${p.name} progress`}>
                    <div className={`h-2 rounded-full ${s.bar}`} style={{ width: `${p.percentage}%` }} />
                  </div>
                  <span className="text-xs tabular-nums text-gray-600 w-14 text-right">{p.completedDays}/{p.totalDays} days</span>
                </div>
                {p.bestQuiz !== null && <p className="text-[11px] text-gray-400 mt-1">Best quiz {p.bestQuiz}% · {p.quizzes} taken</p>}
              </li>
            );
          })}
        </Column>

        <Column title="Career roadmaps" count={roadmaps.length} action="Smart Roadmap" onAction={() => navigate('/roadmap')} empty="No roadmaps yet. Generate one for the role you want.">
          {roadmaps.slice(0, 4).map((r) => (
            <li key={r.id} className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{r.role}</p>
                  <p className="text-xs text-gray-500">
                    {r.stages} stages · {r.topics} topics{r.totalWeeks ? ` · ${r.totalWeeks} weeks` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-gray-400">{shortDate(r.createdAt)}</span>
              </div>
              <ol className="mt-2.5 space-y-1.5 border-l-2 border-primary-100 ml-2">
                {r.stageTitles.map((t, i) => (
                  <li key={`${t}-${i}`} className="relative pl-4 text-xs text-gray-700" title={t}>
                    <span className="absolute -left-[7px] top-0.5 w-3 h-3 rounded-full bg-white border-2 border-primary-400" aria-hidden="true" />
                    <span className="block truncate"><span className="font-semibold text-primary-700 tabular-nums">{i + 1}.</span> {t}</span>
                  </li>
                ))}
              </ol>
              {r.topics > 0 && (
                <p className="text-[11px] text-gray-400 mt-1.5">{r.knownTopics} of {r.topics} topics already known when generated</p>
              )}
            </li>
          ))}
        </Column>

        <Column title="Skill gap analyses" count={gaps.length} action="Skill Gap coach" onAction={() => navigate('/skills-required')} empty="No analyses yet. Tell the coach your target role.">
          {gaps.slice(0, 4).map((g) => (
            <li key={g.id} className="flex gap-4">
              <Ring value={g.readiness} size={52} thickness={6} color={readinessColor(g.readiness)} label={`${g.targetRole} readiness`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{g.targetRole}</p>
                <p className="text-xs text-gray-500">{g.strengths} skills covered · {g.gaps} to learn · {Math.max(0, g.messages - 1)} messages</p>
                {g.topGaps.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1 min-w-0">
                    {g.topGaps.map((t) => (
                      <span key={t.skill} title={t.skill} className={`text-[11px] px-1.5 py-0.5 rounded border truncate max-w-full ${PRIORITY[t.priority] || PRIORITY.low}`}>{shortSkill(t.skill)}</span>
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
