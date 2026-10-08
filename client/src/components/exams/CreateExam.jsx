import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FormPage, Panel, Field, Icon, Spinner, btn } from '../learning/LearningUI';
import { Input, Select, Textarea } from '../ui/Field';
import { buttonClass } from '../ui/Button';
import cx from '../ui/cx';
import { api } from '../../lib/api';
import { currentEmail } from '../../lib/session';
import { localToday } from '../../lib/todos';
import { examsApi, WEEKDAYS, dayLabel } from '../../lib/exams';

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MINUTES = [30, 45, 60, 90, 120, 180, 240];
const TARGETS = [60, 70, 80, 90];
const DIFFICULTY = [{ id: 1, label: 'Easy' }, { id: 2, label: 'Medium' }, { id: 3, label: 'Hard' }];
const CONFIDENCE = ['Never seen it', 'Shaky', 'Okay', 'Good', 'Confident'];
const SOURCES = [
  { id: 'text', icon: 'edit', label: 'Paste it' },
  { id: 'pdf', icon: 'upload', label: 'Upload a PDF' },
  { id: 'note', icon: 'summary', label: 'From my notes' },
];

const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
let keySeq = 0;

/** Step 1: the exam and its syllabus. Novard reads the syllabus into topics. */
function DetailsStep({ initial, onDraft, onCancel, submitting, error }) {
  const [title, setTitle] = useState(initial.title || '');
  const [examDate, setExamDate] = useState(initial.examDate || addDays(localToday(), 14));
  const [dailyMinutes, setDailyMinutes] = useState(initial.dailyMinutes || 60);
  const [restDays, setRestDays] = useState(initial.restDays || [0]);
  const [targetReadiness, setTarget] = useState(initial.targetReadiness || 70);
  const [source, setSource] = useState('text');
  const [syllabus, setSyllabus] = useState('');
  const [pdf, setPdf] = useState(null);
  const [noteId, setNoteId] = useState('');
  const [notes, setNotes] = useState([]);
  const [problem, setProblem] = useState('');
  const fileInput = useRef(null);

  useEffect(() => {
    api.get(`/notes/${encodeURIComponent(currentEmail())}`).then((r) => setNotes(Array.isArray(r.data) ? r.data : [])).catch(() => setNotes([]));
  }, []);

  const toggleRest = (d) => setRestDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d].sort()));

  const submit = (e) => {
    e.preventDefault();
    setProblem('');
    if (!title.trim()) return setProblem('Give the exam a name.');
    if (!examDate || examDate <= localToday()) return setProblem('The exam date must be after today.');
    if (restDays.length > 5) return setProblem('Keep at least two study days a week.');
    if (source === 'text' && syllabus.trim().length < 40) return setProblem('Paste the syllabus: the units or topics the exam covers.');
    if (source === 'pdf' && !pdf) return setProblem('Choose the syllabus PDF.');
    if (source === 'note' && !noteId) return setProblem('Pick one of your notes.');
    return onDraft(
      { title: title.trim(), examDate, dailyMinutes: Number(dailyMinutes), restDays, targetReadiness: Number(targetReadiness) },
      { title: title.trim(), examDate, syllabus: source === 'text' ? syllabus : undefined, pdf: source === 'pdf' ? pdf : undefined, noteId: source === 'note' ? noteId : undefined },
    );
  };

  const days = examDate ? Math.round((Date.parse(examDate) - Date.parse(localToday())) / 864e5) : 0;

  return (
    <FormPage
      title="Plan an exam with Autopilot"
      subtitle="Give Novard your exam date and syllabus. It maps the syllabus into topics, measures what you know from your quizzes and teach-backs, and keeps a day-by-day plan that adjusts itself after every result - with a forecast of how ready you'll be on the day."
      steps={[
        { title: 'Your exam', text: 'Date, syllabus and study time' },
        { title: 'Check the topics', text: 'Novard reads the syllabus; you adjust' },
        { title: 'Follow today’s plan', text: 'Quizzes, teach-backs, reviews' },
        { title: 'It re-plans', text: 'After every result or missed day' },
      ]}
      onSubmit={submit}
      onCancel={onCancel}
      submitting={submitting}
      submittingLabel={source === 'pdf' ? 'Reading your syllabus PDF…' : 'Reading your syllabus…'}
      submitLabel={<><Icon name="sparkles" /> Read my syllabus</>}
      error={problem || error}
    >
      <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
        <Field id="ex-title" label="Exam" required>
          <Input id="ex-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. DBMS end-semester" />
        </Field>
        <Field id="ex-date" label="Exam date" required hint={days > 0 ? `${days} day${days === 1 ? '' : 's'} from today` : undefined}>
          <Input id="ex-date" type="date" value={examDate} min={addDays(localToday(), 1)} onChange={(e) => setExamDate(e.target.value)} />
        </Field>
      </div>

      <Field id="ex-source" label="Syllabus" required>
        <div className="mb-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Where is the syllabus?">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={source === s.id}
              onClick={() => setSource(s.id)}
              className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-small ring-1 ring-inset transition-colors', source === s.id ? 'bg-accent-soft font-medium text-accent-fg ring-accent' : 'text-fg-muted ring-line hover:bg-sunken')}
            >
              <Icon name={s.icon} className="h-3.5 w-3.5" /> {s.label}
            </button>
          ))}
        </div>
        {source === 'text' && (
          <Textarea id="ex-source" rows={7} value={syllabus} maxLength={40000} onChange={(e) => setSyllabus(e.target.value)} placeholder={'Unit 1: ER modelling - entities, relationships (15 marks)\nUnit 2: Relational model - keys, relational algebra\nUnit 3: SQL - joins, grouping, subqueries (25 marks)\n…'} />
        )}
        {source === 'pdf' && (
          <>
            <input ref={fileInput} type="file" accept="application/pdf" className="hidden" aria-label="Syllabus PDF" onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.type !== 'application/pdf') { setProblem('Choose a PDF file.'); return; }
              if (f.size > MAX_PDF_BYTES) { setProblem('That PDF is over 10 MB.'); return; }
              setProblem('');
              setPdf(f);
            }} />
            {pdf ? (
              <div className="flex items-center gap-2 rounded-lg bg-sunken px-3 py-2.5 text-body text-fg ring-1 ring-inset ring-line">
                <Icon name="summary" className="h-4 w-4 text-accent-fg" />
                <span className="min-w-0 flex-1 truncate">{pdf.name}</span>
                <button type="button" className={btn.ghost} onClick={() => { setPdf(null); if (fileInput.current) fileInput.current.value = ''; }}>Remove</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInput.current?.click()} className={`${btn.secondary} w-full justify-center py-6`}>
                <Icon name="upload" /> Upload the syllabus or course notes (PDF)
              </button>
            )}
          </>
        )}
        {source === 'note' && (
          notes.length ? (
            <Select id="ex-source" value={noteId} onChange={(e) => setNoteId(e.target.value)}>
              <option value="">Choose a note</option>
              {notes.map((n) => <option key={n._id} value={n._id}>{n.title}</option>)}
            </Select>
          ) : <p className="rounded-lg bg-sunken px-3 py-2.5 text-small text-fg-muted">You have no notes yet. Upload a PDF instead.</p>
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="ex-minutes" label="Study time a day" hint="Autopilot fits each day into this.">
          <Select id="ex-minutes" value={dailyMinutes} onChange={(e) => setDailyMinutes(e.target.value)}>
            {MINUTES.map((m) => <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? '' : 's'}`}</option>)}
          </Select>
        </Field>
        <Field id="ex-target" label="Target readiness" hint="How well-prepared you want to be on the day.">
          <Select id="ex-target" value={targetReadiness} onChange={(e) => setTarget(e.target.value)}>
            {TARGETS.map((t) => <option key={t} value={t}>{t}%{t === 70 ? ' (recommended)' : ''}</option>)}
          </Select>
        </Field>
      </div>

      <Field id="ex-rest" label="Rest days" optional hint="No study is planned on these days.">
        <div id="ex-rest" className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d, i) => (
            <button
              key={d}
              type="button"
              aria-pressed={restDays.includes(i)}
              onClick={() => toggleRest(i)}
              className={cx('w-12 rounded-lg py-1.5 text-small ring-1 ring-inset transition-colors', restDays.includes(i) ? 'bg-sunken font-medium text-fg ring-line-strong' : 'text-fg-muted ring-line hover:bg-sunken')}
            >
              {d}
            </button>
          ))}
        </div>
      </Field>
    </FormPage>
  );
}

/** Step 2: the topics Novard read, for the student to correct before the plan is built. */
function TopicsStep({ draft, settings, onBack, onCreate, submitting, error }) {
  const [rows, setRows] = useState(() => draft.topics.map((t) => ({ ...t, confidence: null })));
  const [problem, setProblem] = useState('');
  const total = rows.reduce((s, r) => s + (Number(r.importance) || 0), 0) || 1;
  const names = useMemo(() => new Map(rows.map((r) => [r.key, r.name])), [rows]);

  const patch = (key, change) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const move = (i, by) => setRows((list) => {
    const next = [...list];
    const [row] = next.splice(i, 1);
    next.splice(Math.max(0, Math.min(list.length, i + by)), 0, row);
    return next;
  });
  const remove = (key) => setRows((list) => list.filter((r) => r.key !== key).map((r) => ({ ...r, prerequisites: r.prerequisites.filter((p) => p !== key) })));
  const add = () => {
    keySeq += 1;
    setRows((list) => [...list, { key: `new-${keySeq}`, name: '', summary: '', importance: 5, difficulty: 2, prerequisites: [], confidence: null }]);
  };

  const submit = () => {
    setProblem('');
    const clean = rows.filter((r) => r.name.trim());
    if (clean.length < 2) return setProblem('Keep at least two topics.');
    return onCreate({ ...settings, topics: clean.map((r) => ({ ...r, name: r.name.trim(), confidence: r.confidence || undefined })) });
  };

  return (
    <Panel fill>
      <div className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl space-y-6 px-5 py-8 animate-view-in sm:px-8">
          <div>
            <button type="button" onClick={onBack} className={`${btn.ghost} -ml-2 mb-2`}><Icon name="arrowLeft" /> Back</button>
            <h2 className="text-display font-semibold text-fg">Check the topics</h2>
            <p className="mt-1.5 max-w-2xl text-body text-fg-muted">
              Novard read <strong className="font-semibold text-fg">{draft.source?.label || 'your syllabus'}</strong> into {rows.length} topics.
              Fix anything it got wrong: how much of the exam each is worth, how hard it is, what it builds on, and how confident you feel. Your plan is built from this.
            </p>
          </div>

          <ol className="divide-y divide-line-subtle overflow-hidden rounded-xl bg-raised ring-1 ring-line-subtle">
            {rows.map((r, i) => (
              <li key={r.key} className="p-4">
                <div className="flex items-start gap-3">
                  <span className="tabular mt-2 w-6 shrink-0 text-center text-small font-semibold text-fg-subtle">{i + 1}</span>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input aria-label={`Topic ${i + 1} name`} value={r.name} maxLength={80} placeholder="Topic name" onChange={(e) => patch(r.key, { name: e.target.value })} className="min-w-[12rem] flex-1 font-medium" />
                      <Select aria-label={`Topic ${i + 1} difficulty`} value={r.difficulty} onChange={(e) => patch(r.key, { difficulty: Number(e.target.value) })} className="w-28" size="sm">
                        {DIFFICULTY.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                      </Select>
                    </div>
                    {r.summary && <p className="text-small text-fg-subtle">{r.summary}</p>}

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="flex items-baseline justify-between text-caption text-fg-subtle">
                          <span>Share of the exam</span>
                          <span className="tabular font-semibold text-fg">{Math.round(((Number(r.importance) || 0) / total) * 100)}%</span>
                        </span>
                        <input type="range" min={1} max={10} value={r.importance} onChange={(e) => patch(r.key, { importance: Number(e.target.value) })} className="mt-1 w-full accent-accent" aria-label={`How much of the exam ${r.name || 'this topic'} is`} />
                      </label>
                      <div>
                        <span className="text-caption text-fg-subtle">How confident are you?</span>
                        <div className="mt-1 flex gap-1" role="radiogroup" aria-label={`Confidence in ${r.name || 'this topic'}`}>
                          {CONFIDENCE.map((label, c) => (
                            <button
                              key={label}
                              type="button"
                              role="radio"
                              aria-checked={r.confidence === c + 1}
                              title={label}
                              onClick={() => patch(r.key, { confidence: r.confidence === c + 1 ? null : c + 1 })}
                              className={cx('h-7 flex-1 rounded-md text-caption ring-1 ring-inset transition-colors', r.confidence === c + 1 ? 'bg-accent text-on-accent ring-accent' : 'text-fg-muted ring-line hover:bg-sunken')}
                            >
                              {c + 1}
                            </button>
                          ))}
                        </div>
                        <span className="mt-0.5 block text-caption text-fg-subtle">{r.confidence ? CONFIDENCE[r.confidence - 1] : 'Optional - a diagnostic test is better'}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-caption text-fg-subtle">Builds on:</span>
                      {r.prerequisites.map((p) => (
                        <button key={p} type="button" onClick={() => patch(r.key, { prerequisites: r.prerequisites.filter((x) => x !== p) })} className="inline-flex items-center gap-1 rounded-full bg-sunken px-2 py-0.5 text-caption text-fg ring-1 ring-inset ring-line hover:ring-line-strong" title="Remove">
                          {names.get(p) || 'Removed topic'} <Icon name="x" className="h-3 w-3" />
                        </button>
                      ))}
                      {rows.filter((o) => o.key !== r.key && !r.prerequisites.includes(o.key) && o.name.trim()).length > 0 && (
                        <Select
                          size="sm"
                          aria-label={`Add a topic ${r.name || 'this topic'} builds on`}
                          value=""
                          onChange={(e) => e.target.value && patch(r.key, { prerequisites: [...r.prerequisites, e.target.value] })}
                          className="w-auto"
                        >
                          <option value="">+ Add</option>
                          {rows.filter((o) => o.key !== r.key && !r.prerequisites.includes(o.key) && o.name.trim()).map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
                        </Select>
                      )}
                      {!r.prerequisites.length && <span className="text-caption text-fg-subtle">nothing</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-0.5">
                    <button type="button" className={btn.ghost} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><Icon name="chevronUp" /></button>
                    <button type="button" className={btn.ghost} onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down"><Icon name="chevronDown" /></button>
                    <button type="button" className={btn.ghost} onClick={() => remove(r.key)} aria-label={`Remove ${r.name || 'topic'}`}><Icon name="trash" /></button>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <button type="button" onClick={add} className={`${btn.secondary} w-full justify-center`}><Icon name="plus" /> Add a topic</button>

          {(problem || error) && <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-body text-danger-fg">{problem || error}</p>}

          <div className="flex flex-wrap items-center gap-3 border-t border-line-subtle pt-5">
            <button type="button" onClick={submit} disabled={submitting} className={buttonClass({ variant: 'primary', size: 'lg' })}>
              {submitting ? <><Spinner /> Building your plan…</> : <><Icon name="target" /> Build my plan</>}
            </button>
            <p className="text-small text-fg-subtle">
              Exam {dayLabel(settings.examDate, { weekday: 'long', day: 'numeric', month: 'long' })} · {settings.dailyMinutes} min a day · target {settings.targetReadiness}%
            </p>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/** Create an exam: details and syllabus → Novard reads it → the student checks the topics → the plan. */
export default function CreateExam({ onCreated, onCancel }) {
  const [settings, setSettings] = useState({});
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const read = async (nextSettings, input) => {
    setBusy(true);
    setError('');
    setSettings(nextSettings);
    try {
      setDraft(await examsApi.draft(input));
    } catch (e) {
      setError(e.message || 'The syllabus could not be read. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const create = async (body) => {
    setBusy(true);
    setError('');
    try {
      onCreated(await examsApi.activate(draft._id, body));
    } catch (e) {
      setError(e.message || 'The plan could not be built. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return draft
    ? <TopicsStep draft={draft} settings={settings} onBack={() => { setDraft(null); setError(''); }} onCreate={create} submitting={busy} error={error} />
    : <DetailsStep initial={settings} onDraft={read} onCancel={onCancel} submitting={busy} error={error} />;
}
