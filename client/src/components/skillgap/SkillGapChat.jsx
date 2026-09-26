import React, { useEffect, useMemo, useRef, useState } from 'react';
import MarkdownView from '../MarkdownView';

const PRIORITY = {
  high: { label: 'High', badge: 'bg-red-100 text-red-700' },
  medium: { label: 'Medium', badge: 'bg-amber-100 text-amber-800' },
  low: { label: 'Low', badge: 'bg-gray-100 text-gray-600' },
};

const readinessTone = (r) => (r >= 75 ? 'bg-green-500' : r >= 50 ? 'bg-blue-500' : r >= 25 ? 'bg-amber-500' : 'bg-red-500');

/** The analysis at the top of the conversation: readiness, what they have, what to learn. */
const GapReport = ({ analysis, startOpen = true }) => {
  const [open, setOpen] = useState(startOpen);
  const [showAll, setShowAll] = useState(false);
  const gaps = showAll ? analysis.gaps : analysis.gaps.slice(0, 5);
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full flex items-center gap-4 p-4 text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <span className="text-sm font-semibold text-gray-900">Estimated readiness</span>
            <span className="text-lg font-bold text-gray-900 tabular-nums">{analysis.readiness}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={analysis.readiness} aria-label="Estimated readiness">
            <div className={`h-2 rounded-full ${readinessTone(analysis.readiness)}`} style={{ width: `${analysis.readiness}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            {analysis.strengths.length} skills you have · {analysis.gaps.length} to learn · core skills count double
          </p>
        </div>
        <span className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-4 grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">You already have</h4>
            {analysis.strengths.length ? (
              <div className="flex flex-wrap gap-1.5">
                {analysis.strengths.map((s) => (
                  <span key={s.skill} title={s.why} className="px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-xs font-medium text-green-800">✓ {s.skill}</span>
                ))}
              </div>
            ) : <p className="text-sm text-gray-500">Nothing from this role's list yet - that's fine, everyone starts here.</p>}
          </div>
          <div className="lg:col-span-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">To learn, in order</h4>
            <ul className="divide-y divide-gray-100">
              {gaps.map((g) => (
                <li key={g.skill} className="py-2 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900">{g.skill}{g.importance === 'nice' && <span className="ml-1.5 text-[10px] font-medium text-gray-400">nice to have</span>}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-500 tabular-nums">~{g.effortWeeks}w</span>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${PRIORITY[g.priority]?.badge}`}>{PRIORITY[g.priority]?.label}</span>
                    </span>
                  </div>
                  {g.firstStep && <p className="text-xs text-gray-600 mt-0.5">First step: {g.firstStep}</p>}
                </li>
              ))}
            </ul>
            {analysis.gaps.length > 5 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 text-xs font-medium text-blue-600 hover:underline">
                {showAll ? 'Show fewer' : `Show all ${analysis.gaps.length}`}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

const Bubble = ({ message }) => {
  const mine = message.role === 'user';
  return (
    <div className={`flex gap-3 ${mine ? 'justify-end' : 'justify-start'}`}>
      {!mine && <div className="w-8 h-8 shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm" aria-hidden="true">🧭</div>}
      <div className={`max-w-[85%] min-w-0 rounded-2xl px-4 py-3 ${mine
        ? 'bg-blue-600 text-white rounded-br-md'
        : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'}`}>
        {mine
          ? <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          : <MarkdownView content={message.content} />}
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
    <div className="h-full flex flex-col">
      <header className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-gray-200">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Skill gap coach</p>
          <h2 className="text-xl font-bold text-gray-900 truncate">{profile.targetRole}</h2>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {profile.currentSkills?.length ? `Your skills: ${profile.currentSkills.join(', ')}` : 'Starting from zero'} · {profile.hoursPerWeek} h/week
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onUpdateSkills} className="px-3 py-2 text-sm font-semibold rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
            Update my skills
          </button>
          {confirmDelete ? (
            <>
              <button type="button" onClick={() => setConfirmDelete(false)} className="px-3 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-100">Cancel</button>
              <button type="button" onClick={onDelete} disabled={deleting} className="px-3 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">
                {deleting ? 'Deleting…' : 'Delete chat'}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="px-3 py-2 text-sm font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50">Delete</button>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-4" aria-live="polite">
        {/* Expanded for a fresh analysis; collapsed once the conversation is under way. */}
        <GapReport key={session._id} analysis={analysis} startOpen={messages.length <= 1} />
        {messages.map((m, i) => <Bubble key={`${m.createdAt}-${i}`} message={m} />)}
        {sending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm" aria-hidden="true">🧭</div>
            <div className="rounded-2xl rounded-bl-md bg-white border border-gray-200 px-4 py-3 flex items-center gap-1.5" aria-label="The coach is typing">
              {[0, 150, 300].map((d) => <span key={d} className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="pt-3 border-t border-gray-200 pr-20">
        {suggestions.length > 0 && !sending && (
          <div className="flex flex-wrap gap-2 mb-2">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-xs font-medium text-blue-800 hover:bg-blue-100">
                {s}
              </button>
            ))}
          </div>
        )}
        {error && <p role="alert" className="mb-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
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
            className="flex-1 resize-none px-4 py-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 max-h-40"
          />
          <button type="submit" disabled={sending || !draft.trim()} className="px-5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50">
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default SkillGapChat;
