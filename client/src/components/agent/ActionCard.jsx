import React from 'react';
import UIIcon from '../ui/Icon';
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
    icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  add_video: {
    title: 'Add a video to your library',
    section: 'Video Summarizer',
    confirm: 'Add video',
    running: 'Adding the video and fetching its transcript…',
    icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  generate_roadmap: {
    title: 'Generate a career roadmap',
    section: 'Smart Roadmap',
    confirm: 'Generate roadmap',
    running: 'Designing your roadmap - this takes about 30 seconds…',
    icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
  },
  create_skill_plan: {
    title: 'Create a day-by-day learning plan',
    section: 'Skill Plans',
    confirm: 'Create plan',
    running: 'Building your plan and finding a video for each day - up to a minute…',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  create_todo_list: {
    title: 'Create a todo list',
    section: 'Todo lists',
    confirm: 'Create list',
    running: 'Saving your list…',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  },
  skill_gap_analysis: {
    title: 'Analyse your skill gap',
    section: 'Skill Gap Analysis',
    confirm: 'Analyse my skills',
    running: 'Comparing your skills with the role…',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  profile_update: {
    title: 'Remember this about you?',
    section: 'your learner profile',
    confirm: 'Remember',
    running: 'Saving…',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  forum_post: {
    title: 'Start a forum discussion',
    section: 'AI Forum',
    confirm: 'Post discussion',
    running: 'Posting your discussion…',
    icon: 'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z',
  },
};

const Field = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-caption text-fg-subtle">{label}</dt>
    <dd className="mt-0.5 text-sm text-fg">{children}</dd>
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
          <a href={`https://www.youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noopener noreferrer" className="relative shrink-0 w-32 aspect-video overflow-hidden rounded-lg bg-sunken">
            <img src={video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" />
          </a>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg line-clamp-2">{video.title}</p>
            {video.channelName && <p className="mt-0.5 text-xs text-fg-subtle">{video.channelName}</p>}
          </div>
        </div>
      )}
      {fields.filter((f) => f.type !== 'video' && a[f.key] !== undefined && a[f.key] !== '').map((f) => (
        <Field key={f.key} label={f.label}>
          {f.type === 'lines' && Array.isArray(a[f.key]) ? (
            <ol className="list-decimal space-y-0.5 pl-5 text-fg-muted">{a[f.key].map((x, i) => <li key={i}>{x}</li>)}</ol>
          ) : (
            <span className={f.type === 'textarea' ? 'text-fg-muted line-clamp-3' : ''}>{show(f, a[f.key])}</span>
          )}
        </Field>
      ))}
      {/* A card from before drafts existed: fall back to its one-line summary. */}
      {!video && !fields.some((f) => a[f.key] !== undefined) && action.meta?.summary && <p className="text-sm text-fg-muted">{action.meta.summary}</p>}
    </dl>
  );
}

/** An offer: what it would be about, and why. */
const Offer = ({ action }) => (
  <div>
    <p className="text-sm font-semibold text-fg">{action.args?.topic || action.meta?.summary}</p>
    {action.args?.reason && <p className="mt-1 text-xs text-fg-muted">{action.args.reason}</p>}
  </div>
);

const Spinner = () => <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />;

const Badge = ({ className, children }) => <span className={`inline-flex h-5 items-center gap-1 rounded-sm px-1.5 text-caption font-medium ${className}`}>{children}</span>;

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
    <div className={`mt-3 overflow-hidden rounded-xl border bg-raised transition-colors ${
      status === 'done' ? 'border-success/30' : status === 'failed' ? 'border-danger/30' : status === 'draft' ? 'border-accent/30' : ['dismissed', 'superseded', 'accepted'].includes(status) ? 'border-line opacity-70' : 'border-line'
    }`}>
      <div className="flex items-center gap-3 border-b border-line-subtle px-4 py-3">
        <span className="shrink-0 text-fg-subtle"><Icon d={t.icon} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-body font-medium text-fg">{status === 'draft' ? `Draft · ${t.title.toLowerCase()}` : t.title}</p>
          <p className="text-caption text-fg-subtle">in {t.section}</p>
        </div>
        {status === 'proposed' && isOffer && <Badge className="bg-warning-soft text-warning-fg">Suggestion</Badge>}
        {status === 'draft' && <Badge className="bg-accent-soft text-accent-fg">Review &amp; create</Badge>}
        {status === 'accepted' && <Badge className="bg-sunken text-fg-muted">Setting it up</Badge>}
        {status === 'running' && <Badge className="bg-accent-soft text-accent-fg">Working</Badge>}
        {status === 'superseded' && <Badge className="bg-sunken text-fg-subtle">Replaced</Badge>}
        {status === 'done' && <Badge className="bg-success-soft text-success-fg"><UIIcon name="check" className="h-3 w-3" strokeWidth={2.25} />Done</Badge>}
        {status === 'dismissed' && <Badge className="bg-sunken text-fg-subtle">{isDraft ? 'Cancelled' : 'Declined'}</Badge>}
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

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-subtle bg-sunken/60 px-4 py-2.5">
            {status === 'proposed' && (
              <>
                <button type="button" onClick={() => onDecide(action, 'dismiss')} className="rounded-lg px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-sunken">{isProfile ? 'Not now' : 'No thanks'}</button>
                <button type="button" disabled={busy} onClick={() => onDecide(action, isProfile ? 'confirm' : 'accept')} className="rounded-lg bg-ink px-3.5 py-1.5 text-sm font-semibold text-on-ink hover:bg-ink-hover disabled:opacity-50">
                  {isProfile ? 'Yes, remember' : 'Yes, set it up'}
                </button>
              </>
            )}
            {status === 'accepted' && <p className="mr-auto text-sm text-fg-subtle">Let&apos;s get the details right - see below.</p>}
            {status === 'running' && (
              <p className="mr-auto flex items-center gap-2 text-sm text-fg-muted" role="status"><span className="text-accent-fg"><Spinner /></span>{t.running}</p>
            )}
            {status === 'done' && (
              <>
                <p className="mr-auto text-sm text-success-fg">{action.result?.note ? (isProfile ? action.result.note : `Created · ${action.result.note}`) : `Created in ${t.section}`}</p>
                {action.result?.route && (
                  <button type="button" onClick={() => navigate(action.result.route)} className="rounded-lg bg-success px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-green-700">
                    {action.result.label || 'Open'} →
                  </button>
                )}
              </>
            )}
            {status === 'failed' && (
              <>
                <p className="mr-auto text-sm text-danger-fg" role="alert">{action.error || 'That did not work.'}</p>
                <button type="button" onClick={() => onDecide(action, 'dismiss')} className="rounded-lg px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-sunken">Dismiss</button>
                <button type="button" onClick={retry} className="rounded-lg bg-ink px-3.5 py-1.5 text-sm font-semibold text-on-ink hover:bg-ink-hover">Try again</button>
              </>
            )}
            {status === 'dismissed' && <p className="mr-auto text-sm text-fg-subtle">You can ask me again any time.</p>}
            {status === 'superseded' && <p className="mr-auto text-sm text-fg-subtle">An updated version is below.</p>}
          </div>
        </>
      )}
    </div>
  );
};

export default ActionCard;
