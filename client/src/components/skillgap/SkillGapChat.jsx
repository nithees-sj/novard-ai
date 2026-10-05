import React, { useEffect, useMemo, useRef, useState } from 'react';
import MarkdownView from '../MarkdownView';
import { ReportAction } from '../learning/LearningUI';
import Icon from '../ui/Icon';
import Badge from '../ui/Badge';
import { buttonClass } from '../ui/Button';
import { inputClass } from '../ui/Field';
import AgentAvatar from '../agent/AgentAvatar';
import { useReportProblem } from '../../context/ReportContext';

const PRIORITY = {
  high: { label: 'High', tone: 'danger' },
  medium: { label: 'Medium', tone: 'warning' },
  low: { label: 'Low', tone: 'neutral' },
};

const readinessTone = (r) => (r >= 75 ? 'bg-success' : r >= 50 ? 'bg-accent' : r >= 25 ? 'bg-warning' : 'bg-danger');

/** The analysis at the top of the conversation: readiness, what they have, what to learn. */
const GapReport = ({ analysis, startOpen = true }) => {
  const [open, setOpen] = useState(startOpen);
  const [showAll, setShowAll] = useState(false);
  const gaps = showAll ? analysis.gaps : analysis.gaps.slice(0, 5);
  return (
    <section className="rounded-lg bg-raised ring-1 ring-line-subtle">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full flex items-center gap-4 p-4 text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <span className="text-body font-medium text-fg">Estimated readiness</span>
            <span className="num text-title font-medium text-fg">{analysis.readiness}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-chart-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={analysis.readiness} aria-label="Estimated readiness">
            <div className={`h-1.5 rounded-full ${readinessTone(analysis.readiness)}`} style={{ width: `${analysis.readiness}%` }} />
          </div>
          <p className="text-xs text-fg-subtle mt-1.5">
            {analysis.strengths.length} skills you have · {analysis.gaps.length} to learn · core skills count double
          </p>
        </div>
        <Icon name="chevronDown" className={`h-4 w-4 shrink-0 text-fg-subtle transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-line-subtle p-4 grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <h4 className="mb-2 text-small font-medium text-fg-muted">You already have</h4>
            {analysis.strengths.length ? (
              <div className="flex flex-wrap gap-1.5">
                {analysis.strengths.map((s) => (
                  <span key={s.skill} title={s.why} className="inline-flex h-6 items-center gap-1 rounded-sm bg-success-soft px-2 text-small text-success-fg"><Icon name="check" className="h-3 w-3" strokeWidth={2.25} />{s.skill}</span>
                ))}
              </div>
            ) : <p className="text-sm text-fg-subtle">Nothing from this role's list yet. Everyone starts here.</p>}
          </div>
          <div className="lg:col-span-3">
            <h4 className="mb-2 text-small font-medium text-fg-muted">To learn, in order</h4>
            <ul className="divide-y divide-line-subtle">
              {gaps.map((g) => (
                <li key={g.skill} className="py-2 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-body font-medium text-fg">{g.skill}{g.importance === 'nice' && <span className="ml-1.5 text-caption font-normal text-fg-subtle">nice to have</span>}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-fg-subtle tabular-nums">~{g.effortWeeks}w</span>
                      <Badge tone={PRIORITY[g.priority]?.tone}>{PRIORITY[g.priority]?.label}</Badge>
                    </span>
                  </div>
                  {g.firstStep && <p className="text-xs text-fg-muted mt-0.5">First step: {g.firstStep}</p>}
                </li>
              ))}
            </ul>
            {analysis.gaps.length > 5 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 text-xs font-medium text-accent-fg hover:underline">
                {showAll ? 'Show fewer' : `Show all ${analysis.gaps.length}`}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

const Bubble = ({ message, onReport }) => {
  const mine = message.role === 'user';
  return (
    <div className={`group flex gap-3 ${mine ? 'justify-end' : 'justify-start'}`}>
      {!mine && <AgentAvatar size="h-7 w-7" className="mt-0.5" />}
      <div className={`min-w-0 ${mine
        ? 'max-w-[85%] rounded-xl rounded-br-sm bg-accent px-4 py-2.5 text-on-accent'
        : 'flex-1 pt-0.5 text-fg'}`}>
        {mine
          ? <p className="whitespace-pre-wrap break-words text-body">{message.content}</p>
          : <MarkdownView content={message.content} />}
        {!mine && onReport && (
          <div className="-mb-1 mt-1 -ml-1.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
            <ReportAction onClick={onReport} />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Chat with the skill-gap coach. The report stays at the top of the thread;
 * suggested questions come from the student's own top gaps.
 */
const SkillGapChat = ({ session, onSend, sending = false, error = null, onUpdateSkills, onDelete, deleting = false }) => {
  const [draft, setDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const { profile, analysis, messages } = session;
  const openReport = useReportProblem();

  // Opening a chat jumps straight to the latest message; new messages then scroll smoothly.
  // (A smooth scroll through a long history was still mid-way when the chat appeared.)
  const shownSession = useRef(null);
  useEffect(() => {
    const opening = shownSession.current !== session._id;
    shownSession.current = session._id;
    endRef.current?.scrollIntoView({ behavior: opening ? 'auto' : 'smooth', block: 'end' });
  }, [session._id, messages.length, sending]);
  useEffect(() => { inputRef.current?.focus(); }, [session._id]);

  const suggestions = useMemo(() => {
    const short = (g) => g && { ...g, skill: g.skill.replace(/\s*\([^)]*\)/g, '').trim() };
    const [g1, g2] = analysis.gaps.map(short);
    const asked = new Set(messages.filter((m) => m.role === 'user').map((m) => m.content.trim().toLowerCase()));
    return [
      g1 && `How should I learn ${g1.skill}?`,
      `Make me a week-by-week plan for the next month`,
      g1 && g2 && `What project would prove ${g1.skill} and ${g2.skill}?`,
      `What can I safely skip for now?`,
      `How do I show these skills in interviews?`,
    ].filter((s) => s && !asked.has(s.toLowerCase())).slice(0, 4);
  }, [analysis.gaps, messages]);

  // Typed messages clear straight away and come back if sending fails, so nothing is lost.
  const send = async (text) => {
    const fromBox = text === undefined;
    const value = (fromBox ? draft : text).trim();
    if (!value || sending) return;
    if (fromBox) {
      setDraft('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
    }
    const ok = await onSend(value);
    if (!ok && fromBox) setDraft(value);
  };

  return (
    <div className="flex h-full flex-col px-5 pt-4 sm:px-8">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle pb-4">
        <div className="min-w-0">
          <p className="text-small text-fg-subtle">Skill gap analysis</p>
          <h2 className="truncate text-title font-semibold text-fg">{profile.targetRole}</h2>
          <p className="text-xs text-fg-subtle mt-0.5 truncate">
            {profile.currentSkills?.length ? `Your skills: ${profile.currentSkills.join(', ')}` : 'Starting from zero'} · {profile.hoursPerWeek} h/week
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onUpdateSkills} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
            Update my skills
          </button>
          {confirmDelete ? (
            <>
              <button type="button" onClick={() => setConfirmDelete(false)} className={buttonClass({ variant: 'ghost', size: 'sm' })}>Cancel</button>
              <button type="button" onClick={onDelete} disabled={deleting} className={buttonClass({ variant: 'danger-solid', size: 'sm' })}>
                {deleting ? 'Deleting…' : 'Delete chat'}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className={buttonClass({ variant: 'danger', size: 'sm' })}>Delete</button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto py-5" aria-live="polite">
        {/* Expanded for a fresh analysis; collapsed once the conversation is under way. */}
        <GapReport key={session._id} analysis={analysis} startOpen={messages.length <= 1} />
        {messages.map((m, i) => (
          <Bubble
            key={`${m.createdAt}-${i}`}
            message={m}
            onReport={() => openReport({ area: 'skill-gap', source: { tool: 'skillGap', itemType: 'skillgap_message', itemId: session._id, messageIndex: i, excerpt: m.content } })}
          />
        ))}
        {sending && (
          <div className="flex gap-3">
            <AgentAvatar size="h-7 w-7" />
            <div className="flex items-center gap-1.5 py-2" role="status" aria-label="The coach is typing">
              {[0, 150, 300].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-subtle" style={{ animationDelay: `${d}ms` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-line-subtle pb-4 pt-3">
        {suggestions.length > 0 && !sending && (
          <div className="flex flex-wrap gap-2 mb-2">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="rounded-full px-3 py-1 text-small text-fg-muted ring-1 ring-inset ring-line transition-colors hover:bg-sunken hover:text-fg">
                {s}
              </button>
            ))}
          </div>
        )}
        {error && <p role="alert" className="mb-2 rounded-lg bg-danger-soft px-3 py-2 text-body text-danger-fg">{error}</p>}
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask your coach anything… (Shift+Enter for a new line)"
            aria-label="Message the coach"
            className={`${inputClass} max-h-40 flex-1 resize-none rounded-lg py-2.5`}
          />
          <button type="submit" disabled={sending || !draft.trim()} className={buttonClass({ variant: 'primary', size: 'lg' })}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default SkillGapChat;
