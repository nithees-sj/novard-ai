import React, { useState } from 'react';
import RoadmapDiagram from './RoadmapDiagram';

const LEVEL_LABEL = { beginner: 'Complete beginner', intermediate: 'Knows the basics', experienced: 'Switching roles' };

const LEGEND = [
  { label: 'Core topic', swatch: 'bg-sky-100 border-sky-600' },
  { label: 'Optional', swatch: 'bg-white border-slate-400 border-dashed' },
  { label: 'You already know it', swatch: 'bg-green-100 border-green-600' },
  { label: 'Stage project', swatch: 'bg-fuchsia-50 border-fuchsia-600' },
];

const youtube = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
const weeks = (s) => (s.startWeek === s.endWeek ? `Week ${s.startWeek}` : `Weeks ${s.startWeek}–${s.endWeek}`);

const TopicRow = ({ topic }) => (
  <li className="py-3 first:pt-0 last:pb-0">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{topic.name}</span>
          {topic.known ? (
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-green-100 text-green-800">Already known</span>
          ) : topic.type === 'optional' ? (
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">Optional</span>
          ) : (
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">Core</span>
          )}
        </div>
        {topic.description && <p className="text-sm text-gray-600 mt-0.5">{topic.description}</p>}
        {topic.why && <p className="text-xs text-gray-500 mt-0.5"><span className="font-medium text-gray-600">Why it matters:</span> {topic.why}</p>}
      </div>
      <a
        href={youtube(topic.searchQuery || `${topic.name} tutorial`)}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
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
    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-start gap-4 p-4 text-left hover:bg-gray-50"
      >
        <span className="w-9 h-9 shrink-0 rounded-full bg-sky-900 text-white font-bold flex items-center justify-center">{index + 1}</span>
        <span className="flex-1 min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-base font-bold text-gray-900">{stage.title}</span>
            <span className="text-xs font-medium text-gray-500">{weeks(stage)} · {stage.weeks} {stage.weeks === 1 ? 'week' : 'weeks'}</span>
          </span>
          {stage.objective && <span className="block text-sm text-gray-600 mt-0.5">{stage.objective}</span>}
          <span className="block text-xs text-gray-400 mt-1">{stage.topics.length} topics · {core} core to learn{stage.project ? ' · 1 project' : ''}</span>
        </span>
        <span className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-4 grid gap-4 lg:grid-cols-5">
          <ul className="lg:col-span-3 divide-y divide-gray-100">
            {stage.topics.map((t) => <TopicRow key={t.name} topic={t} />)}
          </ul>
          <div className="lg:col-span-2 space-y-3">
            {stage.project && (
              <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-fuchsia-700">Stage project</div>
                <div className="text-sm font-semibold text-gray-900 mt-0.5">{stage.project.title}</div>
                {stage.project.description && <p className="text-sm text-gray-700 mt-1">{stage.project.description}</p>}
                {stage.project.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {stage.project.skills.map((k) => (
                      <span key={k} className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-fuchsia-200 text-fuchsia-800">{k}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {stage.milestone && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-green-700">You're done with this stage when</div>
                <p className="text-sm text-gray-800 mt-0.5">{stage.milestone}</p>
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputs = roadmap.inputs || {};
  const projects = roadmap.stages.filter((s) => s.project).length;
  const topics = roadmap.stages.reduce((n, s) => n + s.topics.length, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Your roadmap</p>
          <h2 className="text-2xl font-bold text-gray-900">{roadmap.role}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {[LEVEL_LABEL[inputs.level], `${inputs.timelineMonths} months`, `${inputs.hoursPerWeek} h/week`,
              `created ${new Date(roadmap.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`]
              .filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onRegenerate} className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
            Adjust & regenerate
          </button>
          {confirmDelete ? (
            <span className="flex items-center gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="px-3 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-100">Cancel</button>
              <button type="button" onClick={onDelete} disabled={deleting} className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">
                {deleting ? 'Deleting…' : 'Delete roadmap'}
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="px-4 py-2 text-sm font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
              Delete
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Stages', roadmap.stages.length],
          ['Weeks', roadmap.totalWeeks],
          ['Topics', topics],
          ['Projects', projects],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{k}</div>
            <div className="text-2xl font-bold text-gray-900 tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      {roadmap.summary && <p className="text-sm leading-relaxed text-gray-700">{roadmap.summary}</p>}

      <div className="space-y-2">
        <RoadmapDiagram source={roadmap.mermaid} fileName={roadmap.role} />
        <ul className="flex flex-wrap gap-x-5 gap-y-2 px-1" aria-label="Legend">
          {LEGEND.map((l) => (
            <li key={l.label} className="flex items-center gap-2 text-xs text-gray-600">
              <span className={`w-4 h-3 rounded-sm border-2 ${l.swatch}`} aria-hidden="true" />
              {l.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900">Stage by stage</h3>
        {roadmap.stages.map((stage, i) => (
          <StageCard key={`${stage.title}-${i}`} stage={stage} index={i} defaultOpen={i === 0} />
        ))}
      </div>

      {roadmap.careerTips?.length > 0 && (
        <section className="rounded-xl border border-indigo-100 bg-indigo-50 p-5">
          <h3 className="text-base font-bold text-gray-900 mb-2">Landing the role</h3>
          <ul className="space-y-1.5 list-disc pl-5 text-sm text-gray-800">
            {roadmap.careerTips.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
};

export default RoadmapView;
