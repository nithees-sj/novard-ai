import React, { useEffect, useRef, useState } from 'react';
import MarkdownView from '../MarkdownView';
import AgentAvatar from '../agent/AgentAvatar';
import { Icon, Spinner, btn } from '../learning/LearningUI';
import { buttonClass } from '../ui/Button';
import cx from '../ui/cx';
import useVoiceRecorder from '../../hooks/useVoiceRecorder';

const MAX_SECONDS = 180;
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * The student explains, Novard (a curious classmate) asks follow-ups. Talk with
 * the big mic button or type; "Finish & get marks" once something is explained.
 */
export default function Arena({ session, voiceEnabled, sending, finishing, ready, onExplain, onFinish, onShowMarks }) {
  const [draft, setDraft] = useState('');
  const [sendingVoice, setSendingVoice] = useState(false);
  const endRef = useRef(null);
  const graded = session.status === 'graded';
  const busy = sending || finishing;

  const { recording, seconds, error, start, stop } = useVoiceRecorder({
    maxSeconds: MAX_SECONDS,
    fileName: 'explanation.webm',
    onRecorded: async (voice) => {
      setSendingVoice(true);
      await onExplain({ voice });
      setSendingVoice(false);
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [session.turns.length, sending]);

  const sendText = async (e) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    const ok = await onExplain({ message: text });
    if (ok === false) setDraft(text);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto" aria-live="polite">
        <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
          {session.turns.map((t, i) => (t.role === 'student' ? (
            <div key={i} className="flex justify-end animate-view-in">
              <div className="max-w-[85%] rounded-xl rounded-br-sm bg-accent px-4 py-2.5 text-body leading-relaxed text-on-accent">
                {t.via === 'voice' && (
                  <span className="mb-1 flex items-center gap-1 text-caption opacity-80"><Icon name="mic" className="h-3 w-3" /> You said</span>
                )}
                <p className="whitespace-pre-wrap break-words">{t.text}</p>
              </div>
            </div>
          ) : (
            <div key={i} className="flex gap-4 animate-view-in">
              <AgentAvatar size="h-8 w-8" />
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-caption font-medium text-fg-subtle">Novard · your classmate</p>
                <div className="inline-block rounded-xl rounded-tl-sm bg-sunken px-4 py-2.5">
                  <MarkdownView content={t.text} size="base" />
                </div>
              </div>
            </div>
          )))}
          {(sending || sendingVoice) && (
            <div className="flex items-center gap-4" role="status">
              <AgentAvatar size="h-8 w-8" />
              <span className="flex items-center gap-2 text-small text-fg-subtle">
                <Spinner className="h-3.5 w-3.5" /> {sendingVoice && !sending ? 'Listening to your explanation…' : 'Novard is thinking…'}
              </span>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {graded ? (
        <div className="border-t border-line-subtle px-6 py-4">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
            <p className="text-small text-fg-muted">This explanation has been marked.</p>
            <button type="button" className={btn.primary} onClick={onShowMarks}><Icon name="flow" /> See your marks</button>
          </div>
        </div>
      ) : (
        <div className="border-t border-line-subtle px-6 pb-4 pt-4">
          <div className="mx-auto w-full max-w-3xl space-y-3">
            {voiceEnabled && (
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={recording ? stop : start}
                  disabled={busy || sendingVoice}
                  aria-pressed={recording}
                  aria-label={recording ? 'Stop and send your explanation' : 'Explain by talking'}
                  className={cx(
                    'relative flex h-16 w-16 items-center justify-center rounded-full shadow-raised transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50',
                    recording ? 'bg-danger text-on-accent' : 'bg-accent text-on-accent hover:bg-accent-hover hover:scale-105',
                  )}
                >
                  {recording && <span className="absolute inset-0 animate-ping rounded-full bg-danger opacity-30" aria-hidden="true" />}
                  <Icon name={recording ? 'stop' : 'mic'} className="relative h-6 w-6" />
                </button>
                <p className="text-small text-fg-subtle" role="status">
                  {recording
                    ? <span className="tabular font-medium text-danger-fg">Recording {clock(seconds)} · tap to stop and send</span>
                    : 'Tap to explain out loud - only your understanding is marked, not your language'}
                </p>
                {error && <p className="text-caption text-danger-fg">{error}</p>}
              </div>
            )}

            <form onSubmit={sendText} className="rounded-xl bg-raised ring-1 ring-inset ring-line transition-shadow focus-within:ring-2 focus-within:ring-focus">
              <textarea
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) sendText(e); }}
                placeholder={voiceEnabled ? '…or type your explanation' : 'Type your explanation, in your own words'}
                aria-label="Your explanation"
                disabled={recording}
                className="block max-h-40 w-full resize-none rounded-xl bg-transparent px-4 pt-3 text-body leading-relaxed text-fg placeholder:text-fg-subtle outline-none"
              />
              <div className="flex items-center justify-end gap-2 px-3 pb-2.5">
                <button type="submit" disabled={busy || recording || !draft.trim()} className={btn.secondary}>
                  {sending && !sendingVoice ? <Spinner /> : <Icon name="send" />} Send
                </button>
              </div>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-caption text-fg-subtle">
                {session.canFinish
                  ? ready ? 'Novard has what it needs - get your marks.' : `Novard may ask up to ${session.followUpsLeft} more question${session.followUpsLeft === 1 ? '' : 's'}. Finish whenever you're ready.`
                  : 'Explain the concept first, then get your marks.'}
              </p>
              <button
                type="button"
                onClick={onFinish}
                disabled={!session.canFinish || busy || recording || sendingVoice}
                className={cx(buttonClass({ variant: ready ? 'primary' : 'secondary' }), ready && 'animate-pulse')}
              >
                {finishing ? <><Spinner /> Marking…</> : <><Icon name="award" /> Finish &amp; get marks</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
