import React from 'react';
import { useNavigate } from 'react-router-dom';
import DraftForm from './DraftForm';

/**
 * A card the Novard Agent attaches to a reply.
 *  - an offer (status 'proposed'): "Yes" continues in the chat, where the
 *    agent asks what it needs and prepares a draft (-> 'accepted')
 *  - a draft ('draft'): every detail filled in and editable; nothing is
 *    created until the student presses Create
 *  - "Remember this?" (type profile_update): Yes saves it to the learner profile
 * Then running -> done | failed (retry); or dismissed, or superseded by a newer draft.
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
    section: 'Skill Plans',
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
  profile_update: {
    title: 'Remember this about you?',
    section: 'your learner profile',
    confirm: 'Remember',
    running: 'Saving…',
    tint: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
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

const Field = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
    <dd className="mt-0.5 text-sm text-gray-800">{children}</dd>
  </div>
);

const PROFILE_LABELS = {
  level: 'Level', experience: 'Experience', targetRole: 'Target role', knownSkills: 'Known skills', interests: 'Interests',
  hoursPerWeek: 'Hours per week', timelineMonths: 'Timeline (months)', goal: 'Goal', language: 'Language', teachingStyle: 'Teaching style', notes: 'Notes',
};

const show = (f, v) => {
  if (Array.isArray(v)) return v.length ? v.join(', ') : 'None';
  const option = f.options?.find((o) => o.value === v);
  return option ? option.label : String(v);
};

/** The details of a draft that can no longer be edited (created, running, replaced...). */
function ReadOnly({ action }) {
  const a = action.args || {};
  const fields = action.meta?.fields || [];
  if (action.type === 'profile_update') {
    return (
      <dl className="space-y-2">
        {Object.entries(a).map(([k, v]) => <Field key={k} label={PROFILE_LABELS[k] || k}>{Array.isArray(v) ? v.join(', ') : String(v)}</Field>)}
      </dl>
    );
  }
  const video = (a.candidates || []).find((c) => c.videoId === a.videoId) || (a.videoId && a.title ? a : null);
  return (
    <dl className="space-y-2">
      {video && (
        <div className="flex gap-3">
          <a href={`https://www.youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noopener noreferrer" className="relative shrink-0 w-32 aspect-video overflow-hidden rounded-lg bg-gray-100">
            <img src={video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" />
          </a>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 line-clamp-2">{video.title}</p>
            {video.channelName && <p className="mt-0.5 text-xs text-gray-500">{video.channelName}</p>}
          </div>
        </div>
      )}
      {fields.filter((f) => f.type !== 'video' && a[f.key] !== undefined && a[f.key] !== '').map((f) => (
        <Field key={f.key} label={f.label}>
          <span className={f.type === 'textarea' ? 'text-gray-600 line-clamp-3' : ''}>{show(f, a[f.key])}</span>
        </Field>
      ))}
      {/* A card from before drafts existed: fall back to its one-line summary. */}
      {!video && !fields.some((f) => a[f.key] !== undefined) && action.meta?.summary && <p className="text-sm text-gray-700">{action.meta.summary}</p>}
    </dl>
  );
}

/** An offer: what it would be about, and why. */
const Offer = ({ action }) => (
  <div>
    <p className="text-sm font-semibold text-gray-900">{action.args?.topic || action.meta?.summary}</p>
    {action.args?.reason && <p className="mt-1 text-xs text-gray-600">{action.args.reason}</p>}
  </div>
);

const Spinner = () => <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />;

const Badge = ({ className, children }) => <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>{children}</span>;

const ActionCard = ({ action, onDecide, busy = false }) => {
  const navigate = useNavigate();
  const t = TYPES[action.type];
  if (!t) return null;
  const { status } = action;
  const isProfile = action.type === 'profile_update';
  const isDraft = !isProfile && action.origin === 'requested';
  const isOffer = !isProfile && !isDraft;
  const retry = () => onDecide(action, isProfile ? 'confirm' : 'create', {});

  return (
    <div className={`mt-3 overflow-hidden rounded-xl border bg-surface shadow-sm transition-colors ${
      status === 'done' ? 'border-green-200' : status === 'failed' ? 'border-red-200' : status === 'draft' ? 'border-blue-200' : ['dismissed', 'superseded', 'accepted'].includes(status) ? 'border-gray-200 opacity-70' : 'border-gray-200'
    }`}>
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${t.tint}`}><Icon d={t.icon} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{status === 'draft' ? `Draft · ${t.title.toLowerCase()}` : t.title}</p>
          <p className="text-xs text-gray-500">in {t.section}</p>
        </div>
        {status === 'proposed' && isOffer && <Badge className="bg-amber-50 text-amber-700">Suggestion</Badge>}
        {status === 'draft' && <Badge className="bg-blue-50 text-blue-700">Review &amp; create</Badge>}
        {status === 'accepted' && <Badge className="bg-gray-100 text-gray-600">Setting it up</Badge>}
        {status === 'running' && <Badge className="bg-blue-50 text-blue-700">Working</Badge>}
        {status === 'superseded' && <Badge className="bg-gray-100 text-gray-500">Replaced</Badge>}
        {status === 'done' && <Badge className="bg-green-50 text-green-700">✓ Done</Badge>}
        {status === 'dismissed' && <Badge className="bg-gray-100 text-gray-500">{isDraft ? 'Cancelled' : 'Declined'}</Badge>}
      </div>

      {status === 'draft' ? (
        <DraftForm
          action={action}
          confirmLabel={t.confirm}
          busy={busy}
          onCancel={() => onDecide(action, 'dismiss')}
          onCreate={(args, remember) => onDecide(action, 'create', { args, remember })}
        />
      ) : (
        <>
          <div className="px-4 py-3">{isOffer ? <Offer action={action} /> : <ReadOnly action={action} />}</div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-4 py-2.5">
            {status === 'proposed' && (
              <>
                <button type="button" onClick={() => onDecide(action, 'dismiss')} className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100">{isProfile ? 'Not now' : 'No thanks'}</button>
                <button type="button" disabled={busy} onClick={() => onDecide(action, isProfile ? 'confirm' : 'accept')} className="rounded-lg bg-ink px-3.5 py-1.5 text-sm font-semibold text-on-ink hover:bg-ink-hover disabled:opacity-50">
                  {isProfile ? 'Yes, remember' : 'Yes, set it up'}
                </button>
              </>
            )}
            {status === 'accepted' && <p className="mr-auto text-sm text-gray-500">Let&apos;s get the details right - see below.</p>}
            {status === 'running' && (
              <p className="mr-auto flex items-center gap-2 text-sm text-gray-600" role="status"><span className="text-blue-600"><Spinner /></span>{t.running}</p>
            )}
            {status === 'done' && (
              <>
                <p className="mr-auto text-sm text-green-700">{action.result?.note ? (isProfile ? action.result.note : `Created · ${action.result.note}`) : `Created in ${t.section}`}</p>
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
                <button type="button" onClick={retry} className="rounded-lg bg-ink px-3.5 py-1.5 text-sm font-semibold text-on-ink hover:bg-ink-hover">Try again</button>
              </>
            )}
            {status === 'dismissed' && <p className="mr-auto text-sm text-gray-500">You can ask me again any time.</p>}
            {status === 'superseded' && <p className="mr-auto text-sm text-gray-500">An updated version is below.</p>}
          </div>
        </>
      )}
    </div>
  );
};

export default ActionCard;
