import React, { useEffect, useRef, useState } from 'react';
import MarkdownView from '../MarkdownView';
import { isCorrectAnswer } from '../../lib/quiz';

/**
 * The shared look of the learning tools (Notes & Quiz, Doubt Clearance,
 * Video Summarizer, Video Library): one layout, one tab bar, one chat, one
 * loading state, one quiz and one list style, so every tool looks and behaves
 * the same.
 *
 * Palette: blue-600 for actions and "selected", neutral greys for surfaces
 * and text, and soft tints only for status (emerald = done / correct,
 * amber = in progress, red = wrong / error).
 */

// ── icons ──────────────────────────────────────────────────────────────────

const PATHS = {
  chat: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  summary: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  quiz: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  video: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  book: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  doubt: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  plus: 'M12 4v16m8-8H4',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  send: 'M5 12h14M13 6l6 6-6 6',
  sparkles: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  check: 'M5 13l4 4L19 7',
  x: 'M6 18L18 6M6 6l12 12',
  link: 'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14',
  upload: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
};

export const Icon = ({ name, className = 'h-4 w-4', strokeWidth = 2 }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d={PATHS[name]} />
  </svg>
);

export const Spinner = ({ className = 'h-4 w-4' }) => (
  <span className={`inline-block shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin ${className}`} aria-hidden="true" />
);

// ── buttons ────────────────────────────────────────────────────────────────

export const btn = {
  primary: 'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:bg-blue-300',
  secondary: 'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50',
  ghost: 'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100',
};
export const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

// ── layout ─────────────────────────────────────────────────────────────────

/** Main column (header + panel) with the item list on the right, both filling the screen height. */
export const Workspace = ({ children, side }) => (
  <div className="flex h-[calc(100vh-160px)] min-h-[560px] gap-5">
    <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
    {side}
  </div>
);

/** A white card; `fill` makes it take the remaining height and scroll inside. */
export const Panel = ({ children, fill = false, padded = true, className = '' }) => (
  <section className={`rounded-xl border border-gray-200 bg-white shadow-sm ${fill ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : ''} ${className}`}>
    {padded && !fill ? <div className="p-5">{children}</div> : children}
  </section>
);

/**
 * The open item in one container: a slim heading bar (icon, title, one line
 * of detail, tabs or actions on the right) and the active tab's content below.
 */
export const ItemFrame = ({ icon, title, meta, tabs, actions, children }) => (
  <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-100 px-4 py-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
            <Icon name={icon} className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold leading-snug text-gray-900">{title}</h2>
          {meta && <div className="truncate text-xs leading-snug text-gray-500">{meta}</div>}
        </div>
      </div>
      {tabs}
      {actions}
    </header>
    <div className="flex min-h-0 flex-1 flex-col">{children}</div>
  </section>
);

/** The content area of one tab inside an ItemFrame. */
export const TabBody = ({ children }) => <div className="flex min-h-0 flex-1 flex-col">{children}</div>;

/** Segmented tab bar. tabs: [{ id, label, icon, busy }] */
export const TabBar = ({ tabs, active, onChange, size = 'md' }) => (
  <div className={`inline-flex max-w-full flex-wrap rounded-lg bg-gray-100 ${size === 'sm' ? 'gap-0.5 p-0.5' : 'gap-1 p-1'}`} role="tablist">
    {tabs.map((t) => {
      const on = active === t.id;
      return (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={on}
          onClick={() => onChange(t.id)}
          className={`inline-flex items-center gap-1.5 rounded-md font-medium transition ${size === 'sm' ? 'px-3 py-1 text-[13px]' : 'px-3.5 py-1.5 text-sm'} ${
            on ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {t.busy ? <Spinner className="h-3.5 w-3.5 text-blue-600" /> : <Icon name={t.icon} className={`h-4 w-4 ${on ? 'text-blue-600' : ''}`} />}
          {t.label}
        </button>
      );
    })}
  </div>
);

// ── states ─────────────────────────────────────────────────────────────────

export const EmptyState = ({ icon = 'sparkles', title, text, action }) => (
  <div className="flex h-full min-h-[260px] flex-col items-center justify-center px-6 py-10 text-center">
    <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
      <Icon name={icon} className="h-7 w-7" strokeWidth={1.8} />
    </span>
    <h3 className="text-base font-semibold text-gray-900">{title}</h3>
    {text && <p className="mt-1 max-w-sm text-sm text-gray-500">{text}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
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
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center px-6 py-10" role="status" aria-live="polite">
      <div className="relative mb-5 h-16 w-16">
        <span className="absolute inset-0 rounded-full border-4 border-blue-100" />
        <span className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 animate-spin" />
        <span className="absolute inset-0 flex items-center justify-center text-blue-600"><Icon name={icon} className="h-6 w-6" /></span>
      </div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {hint && <p className="mt-1 max-w-sm text-center text-sm text-gray-500">{hint}</p>}
      <p className="mt-2 text-xs tabular-nums text-gray-400">{seconds}s</p>
      <div className="mt-8 w-full max-w-md space-y-2.5" aria-hidden="true">
        {[100, 92, 97, 70].map((w, i) => (
          <div key={i} className="h-3 animate-pulse rounded-full bg-gray-100" style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
    </div>
  );
};

/** A generated summary with its title row. */
export const SummaryView = ({ icon = 'summary', title, subtitle, content }) => (
  <div className="h-full overflow-y-auto">
    <div className="mx-auto max-w-3xl px-6 py-6">
      <div className="mb-5 flex items-center gap-3 border-b border-gray-100 pb-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          {subtitle && <p className="truncate text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
      <MarkdownView content={content} size="base" />
    </div>
  </div>
);

// ── chat ───────────────────────────────────────────────────────────────────

const Avatar = () => (
  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-sm" aria-hidden="true">
    <Icon name="sparkles" className="h-4 w-4" />
  </span>
);

/**
 * The conversation with the AI about one item, laid out like ChatGPT / Claude:
 * a centred reading column, your messages as blue bubbles, the assistant's as
 * plain 16px text beside its avatar. `onSend(text)` returns a promise; the
 * typed text is restored if it rejects or resolves to false.
 */
export const ChatPanel = ({ messages = [], sending = false, onSend, placeholder, emptyTitle, emptyText, suggestions = [], startPrompt = null }) => {
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
                  <button key={s} type="button" onClick={() => submit(s)} className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-sm text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
                    {s}
                  </button>
                ))}
              </div>
            )}
          />
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-7 px-6 py-8">
            {messages.map((m, i) => (m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5 text-[15px] leading-relaxed text-white shadow-sm">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-4">
                <Avatar />
                <div className="min-w-0 flex-1 pt-0.5">
                  <MarkdownView content={m.content} size="base" />
                </div>
              </div>
            )))}
            {sending && (
              <div className="flex items-center gap-4" role="status" aria-label="The assistant is typing">
                <Avatar />
                <div className="flex items-center gap-1.5">
                  {[0, 150, 300].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: `${d}ms` }} />)}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="relative px-6 pb-4 pt-1">
        <div className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-white to-transparent" aria-hidden="true" />
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="mx-auto w-full max-w-3xl">
          <div className="rounded-2xl border border-gray-300 bg-white shadow-sm transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
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
              className="block max-h-40 w-full resize-none rounded-2xl bg-transparent px-4 pt-3 text-[15px] leading-relaxed text-gray-900 placeholder-gray-400 outline-none"
            />
            <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
              <span className="pl-1 text-[11px] text-gray-400">Enter to send · Shift + Enter for a new line</span>
              <button type="submit" disabled={sending || !draft.trim()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400" aria-label="Send">
                {sending ? <Spinner className="h-4 w-4" /> : <Icon name="send" className="h-4 w-4" strokeWidth={2.4} />}
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
 */
export const QuizRunner = ({ questions, answers, onAnswer, onSubmit, result, onRetry }) => {
  const answered = Object.keys(answers).filter((k) => answers[k] !== undefined).length;
  const total = questions.length;

  if (result) {
    const pct = Math.round((result.correct / Math.max(1, result.total)) * 100);
    const tone = pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-blue-600' : 'text-amber-600';
    const ring = pct >= 80 ? '#059669' : pct >= 50 ? '#2563eb' : '#d97706';
    const r = 34;
    const c = 2 * Math.PI * r;
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-6">
          <div className="flex flex-col items-center gap-5 rounded-xl border border-gray-200 bg-gray-50/60 p-6 sm:flex-row">
            <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0" role="img" aria-label={`${pct}%`}>
              <circle cx="44" cy="44" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
              <circle cx="44" cy="44" r={r} fill="none" stroke={ring} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 44 44)" />
              <text x="44" y="44" dy="0.35em" textAnchor="middle" className="fill-gray-900 text-lg font-bold">{pct}%</text>
            </svg>
            <div className="flex-1 text-center sm:text-left">
              <h3 className={`text-xl font-bold ${tone}`}>{pct >= 80 ? 'Excellent work!' : pct >= 50 ? 'Good effort!' : 'Keep practising!'}</h3>
              <p className="mt-1 text-sm text-gray-600">You got <strong className="text-gray-900">{result.correct}</strong> of {result.total} questions right. Review the answers below.</p>
            </div>
            <button type="button" onClick={onRetry} className={btn.primary}>Try another quiz</button>
          </div>

          <ol className="space-y-4">
            {questions.map((q, qi) => {
              const chosen = answers[qi];
              const right = isCorrectAnswer(q, chosen);
              return (
                <li key={qi} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="mb-3 flex items-start gap-2">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${right ? 'bg-emerald-500' : 'bg-red-500'}`}>
                      <Icon name={right ? 'check' : 'x'} className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <p className="text-sm font-semibold text-gray-900">{qi + 1}. {q.question}</p>
                  </div>
                  <div className="space-y-1.5">
                    {q.options.map((o, oi) => {
                      const isRight = isCorrectAnswer(q, oi);
                      const isChosen = chosen === oi;
                      return (
                        <div key={oi} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm ${
                          isRight ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : isChosen ? 'border-red-200 bg-red-50 text-red-900' : 'border-gray-200 text-gray-600'
                        }`}>
                          <span className="w-4 shrink-0 text-xs font-bold">{LETTERS[oi]}</span>
                          <span className="flex-1">{o}</span>
                          {isChosen && <span className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Your answer</span>}
                        </div>
                      );
                    })}
                  </div>
                  {q.explanation && <p className="mt-3 rounded-lg bg-blue-50/60 px-3 py-2 text-xs leading-relaxed text-gray-700"><strong className="text-blue-800">Why: </strong>{q.explanation}</p>}
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
      <div className="border-b border-gray-100 px-6 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="text-sm font-medium text-gray-700">{answered} of {total} answered</span>
          <div className="h-1.5 flex-1 rounded-full bg-gray-100">
            <div className="h-1.5 rounded-full bg-blue-600 transition-all" style={{ width: `${(answered / Math.max(1, total)) * 100}%` }} />
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ol className="mx-auto max-w-3xl space-y-4 px-6 py-6">
          {questions.map((q, qi) => (
            <li key={qi} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-gray-900">{qi + 1}. {q.question}</p>
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
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                        on ? 'border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-500' : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${on ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{LETTERS[oi]}</span>
                      {o}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="border-t border-gray-100 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <span className="text-xs text-gray-500">{answered < total ? `${total - answered} question${total - answered === 1 ? '' : 's'} left` : 'All answered - ready to submit'}</span>
          <button type="button" onClick={onSubmit} disabled={answered === 0} className={btn.primary}>Submit quiz</button>
        </div>
      </div>
    </div>
  );
};

// ── side list ──────────────────────────────────────────────────────────────

/** The right-hand list of the student's items (notes, doubts, videos, requests). */
export const SideList = ({ title, count, action, children, className = '' }) => (
  <aside className={`flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}>
    <div className="border-b border-gray-100 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        {count > 0 && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 tabular-nums">{count}</span>}
      </div>
      {action}
    </div>
    <div className="flex-1 space-y-2 overflow-y-auto p-3 pb-28">{children}</div>
  </aside>
);

export const Badge = ({ tone = 'gray', children }) => {
  const tones = {
    gray: 'bg-gray-100 text-gray-600',
    blue: 'bg-blue-50 text-blue-700 ring-1 ring-blue-100',
    green: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
  };
  return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
};

export const ListItem = ({ active, title, subtitle, meta, badges, onSelect, onDelete, deleteLabel }) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onSelect}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
    aria-current={active ? 'true' : undefined}
    className={`group relative cursor-pointer rounded-lg border p-3 pl-4 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
      active ? 'border-blue-200 bg-blue-50/70' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
    }`}
  >
    <span className={`absolute inset-y-2 left-0 w-1 rounded-r-full ${active ? 'bg-blue-600' : 'bg-transparent'}`} aria-hidden="true" />
    <div className="flex items-start gap-2">
      <p className={`min-w-0 flex-1 text-sm font-semibold leading-snug ${active ? 'text-blue-900' : 'text-gray-900'} line-clamp-2`}>{title}</p>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="-mr-1 -mt-0.5 shrink-0 rounded-md p-1 text-gray-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
          aria-label={deleteLabel || `Delete ${title}`}
          title="Delete"
        >
          <Icon name="trash" className="h-4 w-4" />
        </button>
      )}
    </div>
    {subtitle && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{subtitle}</p>}
    {(meta || badges) && (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {meta && <span className="text-[11px] text-gray-400">{meta}</span>}
        {badges}
      </div>
    )}
  </div>
);

export const ListEmpty = ({ icon, title, text }) => (
  <div className="px-4 py-10 text-center">
    <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50 text-gray-400 ring-1 ring-gray-100"><Icon name={icon} className="h-5 w-5" /></span>
    <p className="text-sm font-semibold text-gray-900">{title}</p>
    {text && <p className="mt-0.5 text-xs text-gray-500">{text}</p>}
  </div>
);

// ── toast ──────────────────────────────────────────────────────────────────

export const Toast = ({ toast, onClose }) => {
  if (!toast) return null;
  const ok = toast.type === 'success';
  return (
    <div className="fixed right-6 top-20 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-lg" role={ok ? 'status' : 'alert'}>
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${ok ? 'bg-emerald-500' : 'bg-red-500'}`}>
        <Icon name={ok ? 'check' : 'x'} className="h-3 w-3" strokeWidth={3} />
      </span>
      <p className="flex-1 text-sm text-gray-800">{toast.message}</p>
      {onClose && <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Dismiss"><Icon name="x" className="h-4 w-4" /></button>}
    </div>
  );
};

export const formatDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
