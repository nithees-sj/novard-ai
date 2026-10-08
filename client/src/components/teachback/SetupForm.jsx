import React, { useEffect, useRef, useState } from 'react';
import { FormPage, Field, Icon, btn } from '../learning/LearningUI';
import { Input, Select, Textarea } from '../ui/Field';
import cx from '../ui/cx';
import { api } from '../../lib/api';
import { currentEmail } from '../../lib/session';

const MAX_PDF_BYTES = 10 * 1024 * 1024;

const MODES = [
  { id: 'pdf', icon: 'summary', title: 'From a PDF', text: 'Your notes or a chapter. You are marked against what it says.' },
  { id: 'topic', icon: 'idea', title: 'A concept', text: 'Any idea you are learning. Marked against standard subject knowledge.' },
];

const EXAMPLES = ['How a binary search works', 'Newton’s third law', 'Database normalisation (1NF to 3NF)', 'How photosynthesis makes glucose'];

/**
 * What the student will teach: a PDF (uploaded now, or one already in Notes)
 * plus what to focus on in it, or just a concept.
 */
export default function SetupForm({ onStart, onCancel, submitting, error, initial }) {
  const [mode, setMode] = useState(initial?.noteId ? 'pdf' : 'topic');
  const [concept, setConcept] = useState(initial?.concept || '');
  const [focus, setFocus] = useState(initial?.focus || '');
  const [noteId, setNoteId] = useState(initial?.noteId || '');
  const [pdf, setPdf] = useState(null);
  const [notes, setNotes] = useState([]);
  const [problem, setProblem] = useState('');
  const fileInput = useRef(null);

  useEffect(() => {
    api.get(`/notes/${encodeURIComponent(currentEmail())}`)
      .then((r) => setNotes(Array.isArray(r.data) ? r.data : []))
      .catch(() => setNotes([]));
  }, []);

  const pickFile = (file) => {
    setProblem('');
    if (!file) return setPdf(null);
    if (file.type !== 'application/pdf') return setProblem('Choose a PDF file.');
    if (file.size > MAX_PDF_BYTES) return setProblem('That PDF is over 10 MB.');
    setPdf(file);
    setNoteId('');
    return undefined;
  };

  const submit = (e) => {
    e.preventDefault();
    setProblem('');
    if (mode === 'topic') {
      if (concept.trim().length < 2) return setProblem('Type the concept you will explain.');
      return onStart({ concept: concept.trim(), focus: focus.trim() });
    }
    if (!pdf && !noteId) return setProblem('Upload a PDF, or pick one of your notes.');
    if (pdf && !concept.trim() && !focus.trim()) return setProblem('Say which concept or part of the PDF you will explain.');
    return onStart({ concept: concept.trim(), focus: focus.trim(), noteId: pdf ? undefined : noteId, pdf });
  };

  return (
    <FormPage
      title="Teach it back to Novard"
      subtitle="The best test of understanding is explaining it. Teach Novard a concept by talking or typing: you get marks, a flow of the concept showing where you are lagging, and then Novard teaches you the weak steps."
      steps={[
        { title: 'Pick what to teach', text: 'A PDF and the part to explain, or a concept' },
        { title: 'Explain it', text: 'Talk or type; Novard asks “but why?”' },
        { title: 'Get your marks', text: 'A flow of the concept, step by step' },
        { title: 'Get stronger', text: 'Novard teaches your weak spots' },
      ]}
      onSubmit={submit}
      onCancel={onCancel}
      submitting={submitting}
      submittingLabel={pdf ? 'Reading your PDF…' : 'Starting…'}
      submitLabel={<><Icon name="teach" /> Start teaching</>}
      error={problem || error}
    >
      <div role="radiogroup" aria-label="What will you teach from?" className="grid gap-3 sm:grid-cols-2">
        {MODES.map((m) => {
          const on = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => { setMode(m.id); setProblem(''); }}
              className={cx(
                'flex items-start gap-3 rounded-xl p-4 text-left ring-1 ring-inset transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus',
                on ? 'bg-accent-soft ring-accent' : 'ring-line hover:bg-sunken',
              )}
            >
              <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', on ? 'bg-accent text-on-accent' : 'bg-sunken text-fg-muted')}>
                <Icon name={m.icon} className="h-4 w-4" />
              </span>
              <span>
                <span className={cx('block text-body font-semibold', on ? 'text-accent-fg' : 'text-fg')}>{m.title}</span>
                <span className="block text-small text-fg-muted">{m.text}</span>
              </span>
            </button>
          );
        })}
      </div>

      {mode === 'pdf' && (
        <div className="space-y-4">
          <Field id="tb-pdf" label="Your PDF" hint="Up to 10 MB. Scanned pages are read too. It is also saved to Notes & Quiz.">
            <input ref={fileInput} id="tb-pdf" type="file" accept="application/pdf" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] || null)} />
            {pdf ? (
              <div className="flex items-center gap-2 rounded-lg bg-sunken px-3 py-2.5 text-body text-fg ring-1 ring-inset ring-line">
                <Icon name="summary" className="h-4 w-4 text-accent-fg" />
                <span className="min-w-0 flex-1 truncate">{pdf.name}</span>
                <button type="button" className={btn.ghost} onClick={() => { setPdf(null); if (fileInput.current) fileInput.current.value = ''; }}>Remove</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInput.current?.click()} className={`${btn.secondary} w-full justify-center py-6`}>
                <Icon name="upload" /> Upload a PDF
              </button>
            )}
          </Field>
          {!pdf && notes.length > 0 && (
            <Field id="tb-note" label="…or use one of your notes">
              <Select id="tb-note" value={noteId} onChange={(e) => setNoteId(e.target.value)}>
                <option value="">Choose a note</option>
                {notes.map((n) => <option key={n._id} value={n._id}>{n.title}</option>)}
              </Select>
            </Field>
          )}
        </div>
      )}

      <Field
        id="tb-concept"
        label={mode === 'pdf' ? 'Concept' : 'The concept you will explain'}
        optional={mode === 'pdf'}
        required={mode === 'topic'}
        count={concept.length}
        max={120}
      >
        <Input id="tb-concept" value={concept} maxLength={120} onChange={(e) => setConcept(e.target.value)} placeholder={mode === 'pdf' ? 'e.g. Normalisation' : 'e.g. How a binary search works'} />
      </Field>
      {mode === 'topic' && !concept && (
        <div className="-mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((x) => (
            <button key={x} type="button" onClick={() => setConcept(x)} className="rounded-full px-3 py-1 text-small text-fg-muted ring-1 ring-inset ring-line transition-colors hover:bg-sunken hover:text-fg">{x}</button>
          ))}
        </div>
      )}

      <Field
        id="tb-focus"
        label={mode === 'pdf' ? 'What exactly will you explain from it?' : 'Anything specific to cover?'}
        optional
        hint={mode === 'pdf' ? 'e.g. “Chapter 3: why we split tables into 2NF and 3NF, with the example of student marks”' : 'e.g. “for my exam: include the time complexity and an example”'}
        count={focus.length}
        max={500}
      >
        <Textarea id="tb-focus" rows={3} value={focus} maxLength={500} onChange={(e) => setFocus(e.target.value)} />
      </Field>
    </FormPage>
  );
}
