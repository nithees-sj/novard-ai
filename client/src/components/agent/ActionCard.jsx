import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * A proposal from the Novard Agent: what it offers to create, with the
 * details it filled in, and Yes / No. Nothing is created until "Yes".
 * States: proposed → running → done | failed (retry) ; proposed → dismissed.
 */

const Icon = ({ d, className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
  </svg>
);

const TYPES = {
  create_doubt: {
    title: 'Save as a doubt',
    section: 'Doubt Clearance',
    confirm: 'Create doubt',
    running: 'Creating your doubt…',
    tint: 'bg-amber-50 text-amber-700 ring-amber-100',
    icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  add_video: {
    title: 'Add a video to your library',
    section: 'Video Summarizer',
    confirm: 'Add video',
    running: 'Adding the video and fetching its transcript…',
    tint: 'bg-red-50 text-red-600 ring-red-100',
    icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  generate_roadmap: {
    title: 'Generate a career roadmap',
    section: 'Smart Roadmap',
    confirm: 'Generate roadmap',
    running: 'Designing your roadmap - this takes about 30 seconds…',
    tint: 'bg-blue-50 text-blue-700 ring-blue-100',
    icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
  },
  create_skill_plan: {
    title: 'Create a day-by-day learning plan',
    section: 'Skill Unlocker',
    confirm: 'Create plan',
    running: 'Building your plan and finding a video for each day - up to a minute…',
    tint: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  skill_gap_analysis: {
    title: 'Analyse your skill gap',
    section: 'Skill Gap Analysis',
    confirm: 'Analyse my skills',
    running: 'Comparing your skills with the role…',
    tint: 'bg-violet-50 text-violet-700 ring-violet-100',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  forum_post: {
    title: 'Start a forum discussion',
    section: 'AI Forum',
    confirm: 'Post discussion',
    running: 'Posting your discussion…',
    tint: 'bg-sky-50 text-sky-700 ring-sky-100',
    icon: 'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z',
  },
};

const Chip = ({ children }) => (
  <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{children}</span>
);

const Field = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
    <dd className="mt-0.5 text-sm text-gray-800">{children}</dd>
  </div>
);

function Details({ type, a }) {
  switch (type) {
    case 'create_doubt':
      return (
        <dl className="space-y-2">
          <Field label="Title"><span className="font-semibold text-gray-900">{a.title}</span></Field>
          <Field label="Your question"><span className="text-gray-600">{a.description}</span></Field>
        </dl>
      );
    case 'add_video':
      return (
        <div className="flex gap-3">
          <a href={`https://www.youtube.com/watch?v=${a.videoId}`} target="_blank" rel="noopener noreferrer" className="relative shrink-0 w-40 aspect-video overflow-hidden rounded-lg bg-gray-100 group">
            <img src={a.thumbnailUrl} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
            {a.duration && <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[10px] font-medium text-white">{a.duration}</span>}
          </a>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 line-clamp-2">{a.title}</p>
            {a.channelName && <p className="mt-0.5 text-xs text-gray-500">{a.channelName}</p>}
            {a.reason && <p className="mt-1.5 text-xs text-gray-600">{a.reason}</p>}
          </div>
        </div>
      );
    case 'generate_roadmap':
      return (
        <dl className="space-y-2.5">
          <Field label="Target role"><span className="font-semibold text-gray-900">{a.role}</span></Field>
          <div className="flex flex-wrap gap-1.5">
            <Chip>{a.level}</Chip><Chip>{a.hoursPerWeek} h/week</Chip><Chip>{a.timelineMonths} months</Chip>
          </div>
          {a.knownSkills?.length > 0 && (
            <Field label="You already know">
              <div className="flex flex-wrap gap-1.5 mt-1">{a.knownSkills.map((s) => <span key={s} className="rounded-md bg-green-50 px-2 py-0.5 text-xs text-green-800">✓ {s}</span>)}</div>
            </Field>
          )}
          {a.goal && <Field label="Goal"><span className="text-gray-600">{a.goal}</span></Field>}
        </dl>
      );
    case 'create_skill_plan':
      return (
        <dl className="space-y-2.5">
          <Field label="Skill"><span className="font-semibold text-gray-900">{a.skillName}</span></Field>
          <div className="flex flex-wrap gap-1.5"><Chip>{a.durationDays} days</Chip><Chip>{a.level}</Chip></div>
          {a.focusAreas?.length > 0 && <Field label="Focus">{a.focusAreas.join(' · ')}</Field>}
          {a.description && <Field label="By the end"><span className="text-gray-600">{a.description}</span></Field>}
        </dl>
      );
    case 'skill_gap_analysis':
      return (
        <dl className="space-y-2.5">
          <Field label="Target role"><span className="font-semibold text-gray-900">{a.targetRole}</span></Field>
          <div className="flex flex-wrap gap-1.5"><Chip>{a.experience}</Chip><Chip>{a.hoursPerWeek} h/week</Chip></div>
          {a.currentSkills?.length > 0 && <Field label="Your skills">{a.currentSkills.join(', ')}</Field>}
        </dl>
      );
    case 'forum_post':
      return (
        <dl className="space-y-2">
          <Field label="Title"><span className="font-semibold text-gray-900">{a.title}</span></Field>
          <Field label="Post"><span className="text-gray-600 line-clamp-3">{a.description}</span></Field>
          <div className="flex flex-wrap gap-1.5"><Chip>{a.category}</Chip>{(a.tags || []).map((t) => <Chip key={t}>#{t}</Chip>)}</div>
        </dl>
      );
    default:
      return null;
  }
}

const Spinner = () => <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />;

const ActionCard = ({ action, onDecide }) => {
  const navigate = useNavigate();
  const t = TYPES[action.type];
  if (!t) return null;
  const { status } = action;

  return (
    <div className={`mt-3 overflow-hidden rounded-xl border bg-white shadow-sm transition-colors ${
      status === 'done' ? 'border-green-200' : status === 'failed' ? 'border-red-200' : status === 'dismissed' ? 'border-gray-200 opacity-70' : 'border-gray-200'
    }`}>
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${t.tint}`}><Icon d={t.icon} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{t.title}</p>
          <p className="text-xs text-gray-500">in {t.section}</p>
        </div>
        {status === 'proposed' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Needs your OK</span>}
        {status === 'done' && <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">✓ Done</span>}
        {status === 'dismissed' && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">Declined</span>}
      </div>

      <div className="px-4 py-3"><Details type={action.type} a={action.args || {}} /></div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-4 py-2.5">
        {status === 'proposed' && (
          <>
            <button type="button" onClick={() => onDecide(action, 'dismiss')} className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100">No thanks</button>
            <button type="button" onClick={() => onDecide(action, 'confirm')} className="rounded-lg bg-gray-900 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-gray-800">Yes, {t.confirm.toLowerCase()}</button>
          </>
        )}
        {status === 'running' && (
          <p className="mr-auto flex items-center gap-2 text-sm text-gray-600" role="status"><span className="text-blue-600"><Spinner /></span>{t.running}</p>
        )}
        {status === 'done' && (
          <>
            <p className="mr-auto text-sm text-green-700">{action.result?.note ? `Created · ${action.result.note}` : `Created in ${t.section}`}</p>
            {action.result?.route && (
              <button type="button" onClick={() => navigate(action.result.route)} className="rounded-lg bg-green-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-green-700">
                {action.result.label || 'Open'} →
              </button>
            )}
          </>
        )}
        {status === 'failed' && (
          <>
            <p className="mr-auto text-sm text-red-700" role="alert">{action.error || 'That did not work.'}</p>
            <button type="button" onClick={() => onDecide(action, 'dismiss')} className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100">Dismiss</button>
            <button type="button" onClick={() => onDecide(action, 'confirm')} className="rounded-lg bg-gray-900 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-gray-800">Try again</button>
          </>
        )}
        {status === 'dismissed' && <p className="mr-auto text-sm text-gray-500">You can ask me again any time.</p>}
      </div>
    </div>
  );
};

export default ActionCard;
