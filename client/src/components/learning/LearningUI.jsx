import React, { useCallback, useEffect, useRef, useState } from 'react';
import MarkdownView from '../MarkdownView';
import Icon from '../ui/Icon';
import UISpinner from '../ui/Spinner';
import { buttonClass } from '../ui/Button';
import { inputClass as uiInputClass, fieldClass as uiFieldClass, Field as UIField } from '../ui/Field';
import UIBadge from '../ui/Badge';
import { Tabs } from '../ui/Tabs';
import { EmptyState as UIEmptyState, SkeletonRows, Skeleton as SkeletonBar } from '../ui/States';
import UIToast from '../ui/Toast';
import cx from '../ui/cx';
import useEnterAnimation from '../ui/useEnterAnimation';
import AgentAvatar from '../agent/AgentAvatar';
import { isCorrectAnswer } from '../../lib/quiz';

/**
 * The shared look of the learning tools (Notes & Quiz, Doubt Clearance,
 * Video Summarizer, Video Library): one layout, one tab bar, one chat, one
 * loading state, one quiz and one list style, so every tool looks and behaves
 * the same.
 *
 * Built on the shared primitives in components/ui: semantic tokens only, the
 * accent for actions and "selected", soft tones for status.
 */

// ── icons ──────────────────────────────────────────────────────────────────

// One icon set for the whole app (components/ui/Icon.jsx); re-exported here so
// the learning tools keep importing it from one place.
export { Icon };

export const Spinner = UISpinner;

// ── buttons ────────────────────────────────────────────────────────────────

export const btn = {
  primary: buttonClass({ variant: 'primary' }),
  secondary: buttonClass({ variant: 'secondary' }),
  ghost: buttonClass({ variant: 'ghost' }),
  // A dark button (light in the dark theme), for confirming a step in a card.
  inverse: buttonClass({ variant: 'inverse' }),
  danger: buttonClass({ variant: 'danger' }),
};
export const inputClass = uiInputClass;

/** The small "Report" action shown under AI output when a tool passes onReport. */
export const ReportAction = ({ onClick, label = 'Report', className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1 rounded px-1.5 py-1 text-caption font-medium text-fg-subtle transition-colors hover:bg-sunken hover:text-fg focus:opacity-100 ${className}`}
    title="Report a problem with this"
  >
    <Icon name="flag" className="h-3.5 w-3.5" />
    {label}
  </button>
);

// ── layout ─────────────────────────────────────────────────────────────────

/**
 * The two-pane workspace shared by every learning tool: the student's list on
 * the left, the open item on the right, in one frame that fills the screen
 * (AppShell width="full"). On phones the two stack and the page scrolls.
 */
export const Workspace = ({ children, side }) => (
  <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-0 md:overflow-hidden md:rounded-xl md:bg-raised md:ring-1 md:ring-line-subtle">
    {side}
    <div className="flex min-h-[28rem] min-w-0 flex-1 flex-col md:min-h-0">{children}</div>
  </div>
);

/** The main pane's surface; `fill` makes it take the remaining height and scroll inside. Framed on its own on phones only. */
export const Panel = ({ children, fill = false, padded = true, className = '' }) => (
  <section className={cx('rounded-xl bg-raised ring-1 ring-line-subtle md:rounded-none md:ring-0', fill && 'flex min-h-0 flex-1 flex-col overflow-hidden', className)}>
    {padded && !fill ? <div className="p-5">{children}</div> : children}
  </section>
);

/**
 * The open item: a heading bar (title, one line of detail, then its tabs or
 * actions) and the active tab's content below.
 */
export const ItemFrame = ({ icon, title, meta, tabs, actions, children }) => {
  const body = useRef(null);
  useEnterAnimation(body, title);
  return (
  <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-raised ring-1 ring-line-subtle md:rounded-none md:ring-0">
    <header className="border-b border-line-subtle px-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3.5">
        {icon && <Icon name={icon} className="h-4 w-4 text-fg-subtle" />}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lead font-semibold text-fg" title={typeof title === "string" ? title : undefined}>{title}</h2>
          {meta && <div className="truncate text-small text-fg-subtle">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
      {tabs ? <div className="mt-1.5">{tabs}</div> : <div className="h-3.5" />}
    </header>
    <div ref={body} className="flex min-h-0 flex-1 flex-col">{children}</div>
  </section>
  );
};

/** The content area of one tab inside an ItemFrame. */
export const TabBody = ({ children }) => <div className="flex min-h-0 flex-1 flex-col animate-view-in">{children}</div>;

/** The tabs of an open item. tabs: [{ id, label, icon, busy }] */
export const TabBar = ({ tabs, active, onChange, size = 'md', label = 'Sections' }) => (
  <Tabs tabs={tabs} active={active} onChange={onChange} size={size} label={label} />
);

// ── states ─────────────────────────────────────────────────────────────────

export const EmptyState = ({ icon = 'sparkles', title, text, action }) => (
  <UIEmptyState icon={icon} title={title} text={text} action={action} className="h-full" />
);

/**
 * Shown while the AI works on a summary, a quiz or recommendations: a spinner
 * around the tool's icon, what is happening, how long it usually takes, a live
 * seconds counter and a skeleton of the content to come.
 */
export const GeneratingState = ({ icon = 'sparkles', title, hint }) => {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="h-full overflow-y-auto" role="status" aria-live="polite">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex items-center gap-3">
          <UISpinner className="h-4 w-4 text-accent-fg" />
          <h3 className="text-body font-medium text-fg">{title}</h3>
          <span className="tabular ml-auto text-caption text-fg-subtle">{seconds}s</span>
        </div>
        {hint && <p className="mt-1 pl-7 text-small text-fg-subtle">{hint}</p>}
        <div className="mt-8 space-y-3" aria-hidden="true">
          <SkeletonBar className="h-5 w-2/5" />
          {['w-full', 'w-11/12', 'w-full', 'w-3/4'].map((w, i) => <SkeletonBar key={i} className={`h-3 ${w}`} />)}
          <SkeletonBar className="mt-6 h-5 w-1/3" />
          {['w-full', 'w-5/6', 'w-2/3'].map((w, i) => <SkeletonBar key={`b${i}`} className={`h-3 ${w}`} />)}
        </div>
      </div>
    </div>
  );
};

/** A generated summary with its title row. `onReport` adds a "Report" action for a wrong summary. */
export const SummaryView = ({ title, subtitle, content, onReport }) => (
  <div className="h-full overflow-y-auto">
    <article className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6 flex items-start gap-3 border-b border-line-subtle pb-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-title font-semibold text-fg">{title}</h3>
          {subtitle && <p className="mt-0.5 truncate text-small text-fg-subtle">{subtitle}</p>}
        </div>
        {onReport && <ReportAction onClick={onReport} label="Report a problem" />}
      </header>
      <MarkdownView content={content} size="base" />
    </article>
  </div>
);

// ── chat ───────────────────────────────────────────────────────────────────

const Avatar = () => <AgentAvatar size="h-7 w-7" />;

/**
 * The conversation with the AI about one item, laid out like ChatGPT / Claude:
 * a centred reading column, your messages as blue bubbles, the assistant's as
 * plain 16px text beside its avatar. `onSend(text)` returns a promise; the
 * typed text is restored if it rejects or resolves to false. `onReport(message,
 * index)` adds a "Report" action under each AI answer.
 */
export const ChatPanel = ({ messages = [], sending = false, onSend, placeholder, emptyTitle, emptyText, suggestions = [], startPrompt = null, onReport }) => {
  const [draft, setDraft] = useState('');
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sending]);

  const submit = async (value = draft) => {
    const text = value.trim();
    if (!text || sending) return;
    setDraft('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    const ok = await onSend(text);
    if (ok === false) setDraft(text);
  };

  const empty = messages.length === 0 && !sending;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto" aria-live="polite">
        {empty ? (
          <EmptyState
            icon="chat"
            title={emptyTitle || 'Start the conversation'}
            text={emptyText}
            action={(startPrompt || suggestions.length > 0) && (
              <div className="flex max-w-lg flex-wrap justify-center gap-2">
                {startPrompt && (
                  <button type="button" onClick={() => submit(startPrompt.text)} className={`${btn.primary} mb-2 w-full sm:w-auto`}>
                    <Icon name="sparkles" /> {startPrompt.label}
                  </button>
                )}
                {startPrompt && <span className="basis-full" aria-hidden="true" />}
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => submit(s)} className="rounded-full px-3 py-1 text-small text-fg-muted ring-1 ring-inset ring-line transition-colors hover:bg-sunken hover:text-fg">
                    {s}
                  </button>
                ))}
              </div>
            )}
          />
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-7 px-6 py-8">
            {messages.map((m, i) => (m.role === 'user' ? (
              <div key={i} className="flex justify-end animate-view-in">
                <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-xl rounded-br-sm bg-accent px-4 py-2.5 text-body leading-relaxed text-on-accent">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="group flex gap-4 animate-view-in">
                <Avatar />
                <div className="min-w-0 flex-1 pt-0.5">
                  <MarkdownView content={m.content} size="base" />
                  {onReport && (
                    <div className="mt-1 -ml-1.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                      <ReportAction onClick={() => onReport(m, i)} />
                    </div>
                  )}
                </div>
              </div>
            )))}
            {sending && (
              <div className="flex items-center gap-4" role="status" aria-label="The assistant is typing">
                <Avatar />
                <div className="flex items-center gap-1.5">
                  {[0, 150, 300].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-subtle" style={{ animationDelay: `${d}ms` }} />)}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="relative px-6 pb-4 pt-1">
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="mx-auto w-full max-w-3xl">
          <div className="rounded-xl bg-raised ring-1 ring-inset ring-line transition-shadow hover:ring-line-strong focus-within:ring-2 focus-within:ring-focus">
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
              placeholder={placeholder}
              aria-label={placeholder}
              className="block max-h-40 w-full resize-none rounded-xl bg-transparent px-4 pt-3 text-body leading-relaxed text-fg placeholder:text-fg-subtle outline-none"
            />
            <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
              <span className="hidden pl-1 text-caption text-fg-subtle sm:inline">Enter to send · Shift + Enter for a new line</span>
              <button type="submit" disabled={sending || !draft.trim()} className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-on-accent transition-colors hover:bg-accent-hover disabled:bg-sunken disabled:text-fg-disabled" aria-label="Send">
                {sending ? <Spinner className="h-4 w-4" /> : <Icon name="arrowUp" className="h-4 w-4" strokeWidth={2.25} />}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── quiz ───────────────────────────────────────────────────────────────────

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Take a quiz, then see the score and every answer marked right or wrong
 * with its explanation.
 * result: null while answering; { correct, total } after submitting.
 * onReport(question, index): a "Report" action on each question.
 */
export const QuizRunner = ({ questions, answers, onAnswer, onSubmit, result, onRetry, onReport }) => {
  const answered = Object.keys(answers).filter((k) => answers[k] !== undefined).length;
  const total = questions.length;

  if (result) {
    const pct = Math.round((result.correct / Math.max(1, result.total)) * 100);
    const tone = pct >= 80 ? 'text-success-fg' : pct >= 50 ? 'text-accent-fg' : 'text-warning-fg';
    const ring = pct >= 80 ? 'stroke-success' : pct >= 50 ? 'stroke-accent' : 'stroke-warning';
    const r = 34;
    const c = 2 * Math.PI * r;
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-6">
          <div className="flex flex-col items-center gap-5 border-b border-line-subtle pb-6 sm:flex-row">
            <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0" role="img" aria-label={`${pct}%`}>
              <circle cx="44" cy="44" r={r} fill="none" className="stroke-chart-track" strokeWidth="8" />
              <circle cx="44" cy="44" r={r} fill="none" className={ring} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 44 44)" />
              <text x="44" y="44" dy="0.35em" textAnchor="middle" className="fill-fg text-lead font-semibold">{pct}%</text>
            </svg>
            <div className="flex-1 text-center sm:text-left">
              <h3 className={`text-title font-semibold ${tone}`}>{pct >= 80 ? 'Strong result' : pct >= 50 ? 'Getting there' : 'Worth another go'}</h3>
              <p className="mt-1 text-body text-fg-muted">You got <strong className="font-semibold text-fg">{result.correct}</strong> of {result.total} right. Every answer is explained below.</p>
            </div>
            <button type="button" onClick={onRetry} className={btn.primary}>Try another quiz</button>
          </div>

          <ol className="divide-y divide-line-subtle">
            {questions.map((q, qi) => {
              const chosen = answers[qi];
              const right = isCorrectAnswer(q, chosen);
              return (
                <li key={qi} className="py-5 first:pt-0">
                  <div className="mb-3 flex items-start gap-2.5">
                    <Icon name={right ? 'success' : 'alert'} className={`mt-0.5 h-4 w-4 ${right ? 'text-success-fg' : 'text-danger-fg'}`} label={right ? 'Correct' : 'Wrong'} />
                    <p className="flex-1 text-body font-medium text-fg">{qi + 1}. {q.question}</p>
                    {onReport && <ReportAction onClick={() => onReport(q, qi)} className="-mt-1 shrink-0" />}
                  </div>
                  <div className="space-y-1.5">
                    {q.options.map((o, oi) => {
                      const isRight = isCorrectAnswer(q, oi);
                      const isChosen = chosen === oi;
                      return (
                        <div key={oi} className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-body ${
                          isRight ? 'bg-success-soft text-success-fg' : isChosen ? 'bg-danger-soft text-danger-fg' : 'text-fg-muted'
                        }`}>
                          <span className="w-4 shrink-0 text-caption font-semibold">{LETTERS[oi]}</span>
                          <span className="flex-1">{o}</span>
                          {isChosen && <span className="text-caption font-medium">Your answer</span>}
                        </div>
                      );
                    })}
                  </div>
                  {q.explanation && <p className="mt-3 border-l-2 border-line-strong pl-3 text-small leading-relaxed text-fg-muted"><span className="font-medium text-fg">Why: </span>{q.explanation}</p>}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line-subtle px-6 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="tabular text-small text-fg-muted">{answered} of {total} answered</span>
          <div className="h-1 flex-1 rounded-full bg-chart-track">
            <div className="h-1 rounded-full bg-accent transition-all duration-200" style={{ width: `${(answered / Math.max(1, total)) * 100}%` }} />
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ol className="mx-auto max-w-3xl divide-y divide-line-subtle px-6 py-4">
          {questions.map((q, qi) => (
            <li key={qi} className="py-5">
              <div className="mb-3 flex items-start gap-2">
                <p className="flex-1 text-body font-medium text-fg">{qi + 1}. {q.question}</p>
                {onReport && <ReportAction onClick={() => onReport(q, qi)} className="-mt-1 shrink-0" />}
              </div>
              <div className="space-y-2" role="radiogroup" aria-label={`Question ${qi + 1}`}>
                {q.options.map((o, oi) => {
                  const on = answers[qi] === oi;
                  return (
                    <button
                      key={oi}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => onAnswer(qi, oi)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-body ring-1 ring-inset transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus ${
                        on ? 'bg-accent-soft text-fg ring-accent' : 'text-fg-muted ring-line hover:bg-sunken hover:text-fg'
                      }`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-caption font-semibold ${on ? 'bg-accent text-on-accent' : 'bg-sunken text-fg-subtle'}`}>{LETTERS[oi]}</span>
                      {o}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="border-t border-line-subtle px-6 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <span className="text-small text-fg-subtle">{answered < total ? `${total - answered} question${total - answered === 1 ? '' : 's'} left` : 'All answered. Ready to submit.'}</span>
          <button type="button" onClick={onSubmit} disabled={answered === 0} className={btn.primary}>Submit quiz</button>
        </div>
      </div>
    </div>
  );
};

// ── side list ──────────────────────────────────────────────────────────────

/** Placeholder rows while a side list is loading, instead of a false "nothing yet". */
const ListSkeleton = () => <SkeletonRows rows={4} />;

/** The main area while the student's items are first loaded. */
export const LoadingPanel = ({ label = 'Loading…' }) => (
  <Panel fill>
    <div className="flex h-full flex-col gap-5 p-6" role="status" aria-label={label}>
      <div className="space-y-2">
        <SkeletonBar className="h-5 w-1/3" />
        <SkeletonBar className="h-3.5 w-1/5" />
      </div>
      <div className="space-y-2.5 pt-4">
        {['w-full', 'w-11/12', 'w-4/5', 'w-2/3'].map((w) => <SkeletonBar key={w} className={`h-3 ${w}`} />)}
      </div>
    </div>
  </Panel>
);

/** The student's list (notes, doubts, videos, requests): the left pane of a Workspace. */
export const SideList = ({ title, count, action, children, loading = false, className = '' }) => (
  <aside className={cx('flex max-h-[24rem] shrink-0 flex-col overflow-hidden rounded-xl bg-raised ring-1 ring-line-subtle md:max-h-none md:w-72 md:rounded-none md:border-r md:border-line-subtle md:bg-canvas/60 md:ring-0', className)}>
    <div className="px-4 pb-3 pt-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-body font-semibold text-fg">{title}</h3>
        {count > 0 && <span className="tabular text-caption text-fg-subtle">{count}</span>}
      </div>
      {action}
    </div>
    <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">{loading ? <ListSkeleton /> : children}</div>
  </aside>
);

export const Badge = UIBadge;

/**
 * One of the student's items in a side list: selected by a soft tint, not an
 * edge bar. Selecting and deleting are two sibling buttons (never nested).
 */
export const ListItem = ({ active, title, subtitle, meta, badges, onSelect, onDelete, deleteLabel }) => (
  <div className={cx('group relative rounded-lg transition-colors duration-150', active ? 'bg-accent-soft' : 'hover:bg-sunken')}>
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      className={cx('block w-full rounded-lg px-3 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus', onDelete && 'pr-9')}
    >
      <span className={cx('block text-body font-medium leading-snug line-clamp-2', active ? 'text-accent-fg' : 'text-fg')} title={typeof title === 'string' ? title : undefined}>{title}</span>
      {subtitle && <span className={cx('mt-0.5 block line-clamp-2 text-small', active ? 'text-fg' : 'text-fg-muted')}>{subtitle}</span>}
      {(meta || badges) && (
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {meta && <span className={cx('text-caption', active ? 'text-fg-muted' : 'text-fg-subtle')}>{meta}</span>}
          {badges}
        </span>
      )}
    </button>
    {onDelete && (
      <button
        type="button"
        onClick={onDelete}
        className="absolute right-1.5 top-2 rounded p-1 text-fg-subtle opacity-0 transition hover:bg-danger-soft hover:text-danger-fg focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
        aria-label={deleteLabel || `Delete ${title}`}
        title="Delete"
      >
        <Icon name="trash" className="h-4 w-4" />
      </button>
    )}
  </div>
);

export const ListEmpty = ({ icon, title, text }) => <UIEmptyState compact icon={icon} title={title} text={text} />;

// ── toast ──────────────────────────────────────────────────────────────────

export const Toast = ({ toast, onClose }) => (toast ? <UIToast message={toast.message} type={toast.type === 'success' ? 'success' : 'error'} onClose={onClose} /> : null);

/**
 * showToast(message, type) for a tool's Toast: shows it for 4 s. A new toast
 * restarts the timer, so an older one can no longer dismiss it early.
 */
export function useToastTimer(setToast, ms = 4000) {
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  return useCallback((message, type = 'error') => {
    clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), ms);
  }, [setToast, ms]);
}

export const formatDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// ── "add new" forms in the main area ───────────────────────────────────────

/** A labelled form field with an optional hint, error and character counter. */
export const Field = UIField;

export const fieldClass = uiFieldClass;

/**
 * The page for adding something new (a video, a video request, ...), shown in
 * the main area in place of the open item: heading, how it works, the fields
 * and the actions - the same layout as the new-doubt form.
 */
export const FormPage = ({ title, subtitle, steps = [], onSubmit, children, error, submitLabel, submitting = false, submittingLabel, onCancel }) => (
  <Panel fill>
    <div className="h-full overflow-y-auto">
      <form onSubmit={onSubmit} className="mx-auto w-full max-w-3xl space-y-7 px-5 py-8 animate-view-in sm:px-8" noValidate>
        <div>
          <h2 className="text-display font-semibold text-fg">{title}</h2>
          {subtitle && <p className="mt-1.5 max-w-2xl text-body text-fg-muted">{subtitle}</p>}
        </div>

        {steps.length > 0 && (
          <ol className={`grid gap-x-6 gap-y-3 border-y border-line-subtle py-4 ${steps.length === 3 ? 'sm:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-2.5">
                <span className="tabular text-small font-medium text-fg-subtle">{i + 1}</span>
                <span>
                  <span className="block text-small font-medium text-fg">{step.title}</span>
                  <span className="block text-caption text-fg-subtle">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
        )}

        <div className="space-y-5">{children}</div>

        {error && <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-body text-danger-fg">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={submitting} className={buttonClass({ variant: 'primary', size: 'lg' })}>
            {submitting ? <><Spinner /> {submittingLabel || 'Saving…'}</> : submitLabel}
          </button>
          {onCancel && <button type="button" onClick={onCancel} disabled={submitting} className={buttonClass({ variant: 'ghost', size: 'lg' })}>Cancel</button>}
        </div>
      </form>
    </div>
  </Panel>
);
