import React, { useEffect, useRef, useState } from 'react';
import { REPORT_SENT_EVENT } from '../../context/ReportContext';
import Modal from '../ui/Modal';
import { Select } from '../ui/Field';
import { Link } from 'react-router-dom';
import { Field, Icon, Spinner, btn, fieldClass } from '../learning/LearningUI';
import { useAppStatus } from '../../context/AppStatusContext';
import { submitReport } from '../../lib/reports';
import { errorMessage } from '../../lib/api';

const MIN = 10;
const MAX = 4000;
const MAX_VOICE_SECONDS = 120;
const SCREENSHOT_TYPES = 'image/png,image/jpeg,image/webp';

/** Record a short voice note with the browser's microphone. */
function VoiceRecorder({ value, onChange, disabled }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const recorder = useRef(null);
  const timer = useRef(null);

  useEffect(() => () => {
    clearInterval(timer.current);
    recorder.current?.stream?.getTracks().forEach((t) => t.stop());
  }, []);

  const stop = () => {
    clearInterval(timer.current);
    if (recorder.current?.state === 'recording') recorder.current.stop();
    setRecording(false);
  };

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = window.MediaRecorder?.isTypeSupported?.('audio/webm') ? 'audio/webm' : '';
      const rec = new window.MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        onChange(new File([blob], 'voice-note.webm', { type: blob.type }));
      };
      recorder.current = rec;
      rec.start();
      setSeconds(0);
      setRecording(true);
      timer.current = setInterval(() => setSeconds((s) => {
        if (s + 1 >= MAX_VOICE_SECONDS) stop();
        return s + 1;
      }), 1000);
    } catch {
      setError('Your microphone could not be used. Check the browser permission, or type your report instead.');
    }
  };

  if (value && !recording) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-line bg-sunken px-3 py-2 text-sm text-fg-muted">
        <Icon name="mic" className="h-4 w-4 text-accent-fg" />
        <span className="flex-1">Voice note recorded</span>
        <button type="button" className="text-xs font-semibold text-fg-subtle hover:text-fg" onClick={() => onChange(null)} disabled={disabled}>Remove</button>
      </div>
    );
  }
  return (
    <div>
      <button type="button" onClick={recording ? stop : start} disabled={disabled} className={`${btn.secondary} w-full py-2`}>
        <Icon name={recording ? 'stop' : 'mic'} />
        {recording ? `Stop recording (${seconds}s)` : 'Record a voice note'}
      </button>
      {error && <p className="mt-1 text-xs text-danger-fg">{error}</p>}
    </div>
  );
}

function FilePick({ label, icon, accept, value, onChange, disabled }) {
  const input = useRef(null);
  return (
    <div className="flex items-center gap-2">
      <input ref={input} type="file" accept={accept} className="hidden" onChange={(e) => onChange(e.target.files?.[0] || null)} aria-label={label} />
      {value ? (
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-sunken px-3 py-2 text-sm text-fg-muted">
          <Icon name={icon} className="h-4 w-4 text-accent-fg" />
          <span className="flex-1 truncate">{value.name}</span>
          <button type="button" className="text-xs font-semibold text-fg-subtle hover:text-fg" onClick={() => { onChange(null); if (input.current) input.current.value = ''; }} disabled={disabled}>Remove</button>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()} disabled={disabled} className={`${btn.secondary} w-full py-2`}>
          <Icon name={icon} /> {label}
        </button>
      )}
    </div>
  );
}

/**
 * "Report a problem": what went wrong, in which part of the app, with an
 * optional screenshot, voice note and PDF. Opened from any AI message (with
 * that message attached), the sidebar, the user menu or the Novard Agent.
 */
export default function ReportProblemDialog({ open, context = {}, onClose }) {
  const { status } = useAppStatus();
  const { areas = [], voiceEnabled, maxOpenPerArea } = status.reports || {};
  const [area, setArea] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState({ screenshot: null, voice: null, pdf: null });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);
  const dialog = useRef(null);

  useEffect(() => {
    if (!open) return;
    setArea(context.area || '');
    setText('');
    setFiles({ screenshot: null, voice: null, pdf: null });
    setError(null);
    setSent(null);
    setTimeout(() => dialog.current?.querySelector('select, textarea')?.focus(), 0);
  }, [open, context.area]);

  if (!open) return null;

  const setFile = (key) => (file) => setFiles((f) => ({ ...f, [key]: file }));
  const tooShort = text.trim().length < MIN;

  const submit = async (e) => {
    e.preventDefault();
    if (!area || tooShort || text.length > MAX) {
      setError({ message: !area ? 'Choose which part of the app the problem is in.' : `Please describe the problem in at least ${MIN} characters.` });
      return;
    }
    setSending(true);
    setError(null);
    try {
      const report = await submitReport({
        area,
        text: text.trim(),
        source: context.source,
        routedBy: context.area && context.area === area ? 'context' : 'student',
        ...files,
      });
      setSent(report);
      window.dispatchEvent(new CustomEvent(REPORT_SENT_EVENT, { detail: { ref: report?.ref } }));
    } catch (err) {
      setError({
        message: errorMessage(err, 'Your report could not be sent. Please try again.'),
        existingRef: err?.response?.data?.details?.existingRef || null,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!sending}
      labelledBy="report-title"
      title="Report a problem"
      description="Tell the Novard team what went wrong. You will hear back under the bell when it is fixed."
    >
      <div ref={dialog}>
        {sent ? (
          <div className="space-y-4 py-6 text-center">
            <Icon name="success" className="mx-auto h-7 w-7 text-success-fg" strokeWidth={1.5} />
            <div>
              <h3 className="text-lead font-semibold text-fg">Report {sent.ref} sent</h3>
              <p className="mt-1 text-body text-fg-muted">Thank you. You will get a notification under the bell when we reply or fix it.</p>
            </div>
            <div className="flex justify-center gap-3">
              <Link to={`/reports/${sent.ref}`} onClick={onClose} className={btn.secondary}>View report</Link>
              <button type="button" onClick={onClose} className={btn.primary}>Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5 pb-1 pt-1" noValidate>
            {context.source?.excerpt && (
              <div className="rounded-lg bg-sunken px-3 py-2.5">
                <p className="mb-1 text-caption font-medium text-fg-subtle">You are reporting</p>
                <p className="line-clamp-4 whitespace-pre-wrap text-small text-fg-muted">{context.source.excerpt}</p>
              </div>
            )}

            <Field id="report-area" label="Which part of Novard-AI?" required>
              <Select id="report-area" value={area} onChange={(e) => setArea(e.target.value)} invalid={!!(error && !area)} disabled={sending} data-autofocus>
                <option value="">Choose…</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </Select>
            </Field>

            <Field id="report-text" label="What went wrong?" required count={text.length} max={MAX} hint="What you did, what happened, and what you expected instead.">
              <textarea
                id="report-text"
                rows={5}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className={fieldClass(error && tooShort)}
                placeholder="e.g. The summary of my video came back empty, and the captions tab says no transcript."
                disabled={sending}
              />
            </Field>

            <div className="space-y-2">
              <p className="text-small font-medium text-fg">Add more <span className="font-normal text-fg-subtle">(optional)</span></p>
              <FilePick label="Add a screenshot" icon="image" accept={SCREENSHOT_TYPES} value={files.screenshot} onChange={setFile('screenshot')} disabled={sending} />
              {voiceEnabled && <VoiceRecorder value={files.voice} onChange={setFile('voice')} disabled={sending} />}
              <FilePick label="Attach a PDF" icon="paperclip" accept="application/pdf" value={files.pdf} onChange={setFile('pdf')} disabled={sending} />
            </div>

            {error && (
              <div role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-body text-danger-fg">
                {error.message}
                {error.existingRef && (
                  <> <Link to={`/reports/${error.existingRef}`} onClick={onClose} className="font-semibold underline">Open {error.existingRef}</Link></>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-caption text-fg-subtle">Up to {maxOpenPerArea || 2} open reports per area.</p>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} disabled={sending} className={btn.secondary}>Cancel</button>
                <button type="submit" disabled={sending} className={btn.primary}>{sending ? <><Spinner /> Sending…</> : 'Send report'}</button>
              </div>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
