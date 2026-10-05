import React, { useState } from 'react';
import Icon from '../ui/Icon';
import Badge from '../ui/Badge';
import { buttonClass } from '../ui/Button';
import RoadmapDiagram from './RoadmapDiagram';
import { ReportAction } from '../learning/LearningUI';
import { useReportProblem } from '../../context/ReportContext';

const LEVEL_LABEL = { beginner: 'Complete beginner', intermediate: 'Knows the basics', experienced: 'Switching roles' };

const LEGEND = [
  { label: 'Core topic', swatch: 'bg-sky-100 border-sky-600' },
  { label: 'Optional', swatch: 'bg-raised border-slate-400 border-dashed' },
  { label: 'You already know it', swatch: 'bg-success-soft border-green-600' },
  { label: 'Stage project', swatch: 'bg-fuchsia-50 border-fuchsia-600' },
];

const youtube = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
const weeks = (s) => (s.startWeek === s.endWeek ? `Week ${s.startWeek}` : `Weeks ${s.startWeek}–${s.endWeek}`);

const TopicRow = ({ topic }) => (
  <li className="py-3 first:pt-0 last:pb-0">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body font-medium text-fg">{topic.name}</span>
          {topic.known ? (
            <Badge tone="success">Already known</Badge>
          ) : topic.type === 'optional' ? (
            <Badge>Optional</Badge>
          ) : (
            <Badge tone="accent">Core</Badge>
          )}
        </div>
        {topic.description && <p className="mt-0.5 text-body text-fg-muted">{topic.description}</p>}
        {topic.why && <p className="mt-0.5 text-small text-fg-subtle"><span className="font-medium text-fg-muted">Why it matters:</span> {topic.why}</p>}
      </div>
      <a
        href={youtube(topic.searchQuery || `${topic.name} tutorial`)}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 whitespace-nowrap text-small font-medium text-accent-fg hover:underline"
      >
        Find tutorials ↗
      </a>
    </div>
  </li>
);

const StageCard = ({ stage, index, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen);
  const core = stage.topics.filter((t) => t.type === 'core' && !t.known).length;
  return (
    <section className="overflow-hidden rounded-lg ring-1 ring-line-subtle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        <span className="num w-6 shrink-0 pt-0.5 text-lead font-medium text-fg-subtle">{String(index + 1).padStart(2, '0')}</span>
        <span className="flex-1 min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-lead font-semibold text-fg">{stage.title}</span>
            <span className="text-small text-fg-subtle">{weeks(stage)} · {stage.weeks} {stage.weeks === 1 ? 'week' : 'weeks'}</span>
          </span>
          {stage.objective && <span className="mt-0.5 block text-body text-fg-muted">{stage.objective}</span>}
          <span className="mt-1 block text-small text-fg-subtle">{stage.topics.length} topics · {core} core to learn{stage.project ? ' · 1 project' : ''}</span>
        </span>
        <Icon name="chevronDown" className={`mt-1 h-4 w-4 shrink-0 text-fg-subtle transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="grid gap-5 border-t border-line-subtle p-4 pl-14 lg:grid-cols-5">
          <ul className="lg:col-span-3 divide-y divide-line-subtle">
            {stage.topics.map((t) => <TopicRow key={t.name} topic={t} />)}
          </ul>
          <div className="lg:col-span-2 space-y-3">
            {stage.project && (
              <div className="rounded-lg bg-sunken p-3">
                <div className="text-caption font-medium text-fg-subtle">Stage project</div>
                <div className="mt-0.5 text-body font-medium text-fg">{stage.project.title}</div>
                {stage.project.description && <p className="mt-1 text-body text-fg-muted">{stage.project.description}</p>}
                {stage.project.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {stage.project.skills.map((k) => (
                      <Badge key={k}>{k}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
            {stage.milestone && (
              <div className="rounded-lg bg-success-soft p-3">
                <div className="text-caption font-medium text-success-fg">Done with this stage when</div>
                <p className="mt-0.5 text-body text-fg">{stage.milestone}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

/** A generated roadmap: overview, the flow diagram, then the stage-by-stage plan. */
const RoadmapView = ({ roadmap, onDelete, onRegenerate, deleting = false }) => {
  const openReport = useReportProblem();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputs = roadmap.inputs || {};
  const projects = roadmap.stages.filter((s) => s.project).length;
  const topics = roadmap.stages.reduce((n, s) => n + s.topics.length, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-small text-fg-subtle">Roadmap</p>
          <h2 className="text-display font-semibold text-fg">{roadmap.role}</h2>
          <p className="mt-1 text-small text-fg-subtle">
            {[LEVEL_LABEL[inputs.level], `${inputs.timelineMonths} months`, `${inputs.hoursPerWeek} h/week`,
              `created ${new Date(roadmap.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`]
              .filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ReportAction
            label="Report a problem"
            onClick={() => openReport({ area: 'roadmap', source: { tool: 'roadmap', itemType: 'roadmap', itemId: roadmap._id, excerpt: roadmap.summary || roadmap.role } })}
          />
          <button type="button" onClick={onRegenerate} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
            Adjust & regenerate
          </button>
          {confirmDelete ? (
            <span className="flex items-center gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className={buttonClass({ variant: 'ghost', size: 'sm' })}>Cancel</button>
              <button type="button" onClick={onDelete} disabled={deleting} className={buttonClass({ variant: 'danger-solid', size: 'sm' })}>
                {deleting ? 'Deleting…' : 'Delete roadmap'}
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className={buttonClass({ variant: 'danger', size: 'sm' })}>
              Delete
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-line-subtle ring-1 ring-line-subtle sm:grid-cols-4">
        {[
          ['Stages', roadmap.stages.length],
          ['Weeks', roadmap.totalWeeks],
          ['Topics', topics],
          ['Projects', projects],
        ].map(([k, v]) => (
          <div key={k} className="bg-raised px-4 py-3">
            <div className="text-small text-fg-muted">{k}</div>
            <div className="num mt-0.5 text-title font-medium text-fg">{v}</div>
          </div>
        ))}
      </div>

      {roadmap.summary && <p className="max-w-3xl text-body leading-relaxed text-fg-muted">{roadmap.summary}</p>}

      <div className="space-y-2">
        <RoadmapDiagram source={roadmap.mermaid} fileName={roadmap.role} />
        <ul className="flex flex-wrap gap-x-5 gap-y-2 px-1" aria-label="Legend">
          {LEGEND.map((l) => (
            <li key={l.label} className="flex items-center gap-2 text-caption text-fg-muted">
              <span className={`w-4 h-3 rounded-sm border-2 ${l.swatch}`} aria-hidden="true" />
              {l.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <h3 className="text-lead font-semibold text-fg">Stage by stage</h3>
        {roadmap.stages.map((stage, i) => (
          <StageCard key={`${stage.title}-${i}`} stage={stage} index={i} defaultOpen={i === 0} />
        ))}
      </div>

      {roadmap.careerTips?.length > 0 && (
        <section className="rounded-lg bg-sunken p-5">
          <h3 className="mb-2 text-body font-semibold text-fg">Landing the role</h3>
          <ul className="list-disc space-y-1.5 pl-5 text-body text-fg-muted marker:text-fg-subtle">
            {roadmap.careerTips.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
};

export default RoadmapView;
