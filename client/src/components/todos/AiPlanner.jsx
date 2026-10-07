import React, { useRef, useState } from 'react';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { Field, Input, Textarea } from '../ui/Field';
import { Skeleton } from '../ui/States';
import { todosApi } from '../../lib/todos';
import TaskDraftEditor, { draftTask, readyTasks } from './TaskDraftEditor';

const EXAMPLES = [
  'DBMS exam on Friday - I still need to revise normalisation, SQL joins and transactions',
  'Finish my React portfolio project in two weeks',
  'Apply for summer internships this month',
];

/** What the pane shows while the AI writes the list. */
const Drafting = () => (
  <div role="status" aria-live="polite" className="space-y-4 animate-fade-in">
    <p className="flex items-center gap-2 text-body text-fg-muted">
      <Icon name="sparkles" className="h-4 w-4 animate-pulse text-accent-fg" />
      Breaking it into tasks…
    </p>
    <Skeleton className="h-9 w-2/3" rounded="rounded" />
    <div className="space-y-2">
      {['w-11/12', 'w-3/4', 'w-5/6', 'w-2/3', 'w-4/5'].map((w) => (
        <div key={w} className="flex items-center gap-3 rounded-lg bg-raised px-3 py-3 ring-1 ring-inset ring-line-subtle">
          <Skeleton className="h-4 w-4" rounded="rounded-sm" />
          <Skeleton className={`h-4 ${w}`} rounded="rounded" />
        </div>
      ))}
    </div>
  </div>
);

/**
 * "Plan with AI", in place in the main pane: the student says what they need
 * to get done, the AI drafts the tasks (with priorities and due dates when
 * there is a deadline), and they edit the draft before it is saved.
 */
export default function AiPlanner({ onCreated, onCancel, onWriteManually, disabled = false }) {
  const [step, setStep] = useState('ask'); // ask | drafting | review
  const [prompt, setPrompt] = useState('');
  const [declined, setDeclined] = useState('');
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [tasks, setTasks] = useState([]);
  const [saving, setSaving] = useState(false);
  const run = useRef(0);

  const draft = async (e) => {
    e?.preventDefault();
    if (prompt.trim().length < 3 || step === 'drafting' || disabled) return;
    const mine = ++run.current;
    setStep('drafting'); setError(''); setDeclined('');
    try {
      const result = await todosApi.draft(prompt.trim());
      if (mine !== run.current) return; // cancelled meanwhile
      if (result.declined) {
        setDeclined(result.declined);
        setStep('ask');
      } else {
        setTitle(result.title);
        setTasks(result.items.map((i) => draftTask(i)));
        setStep('review');
      }
    } catch (err) {
      if (mine !== run.current) return;
      setError(err.message || 'The list could not be drafted. Please try again.');
      setStep('ask');
    }
  };

  const ready = readyTasks(tasks);
  const save = async (e) => {
    e.preventDefault();
    if (!title.trim() || !ready.length || saving) return;
    setSaving(true); setError('');
    try {
      onCreated(await todosApi.create({ title: title.trim(), source: 'ai', items: ready }));
    } catch (err) {
      setError(err.message || 'The list could not be saved. Please try again.');
      setSaving(false);
    }
  };

  const header = (
    <div>
      <h2 id="todo-ai-heading" className="flex items-center gap-2 text-title font-semibold text-fg">
        <Icon name="sparkles" className="h-5 w-5 text-accent-fg" />
        {step === 'review' ? 'Check your list' : 'Plan with AI'}
      </h2>
      <p className="mt-0.5 text-body text-fg-muted">
        {step === 'review'
          ? 'Edit, add or remove tasks, then save. Nothing is saved until you do.'
          : 'Say what you need to get done and by when. You review the list before it is saved.'}
      </p>
    </div>
  );

  if (step === 'drafting') {
    return (
      <section aria-labelledby="todo-ai-heading" className="space-y-5">
        {header}
        <Drafting />
        <div className="flex justify-end border-t border-line-subtle pt-4">
          <Button variant="ghost" onClick={() => { run.current += 1; setStep('ask'); }}>Cancel</Button>
        </div>
      </section>
    );
  }

  if (step === 'review') {
    return (
      <form onSubmit={save} aria-labelledby="todo-ai-heading" className="space-y-5 animate-fade-in">
        {header}
        <Field id="todo-ai-title" label="List name" required>
          <Input id="todo-ai-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </Field>
        <div>
          <p className="mb-2 text-small font-medium text-fg">Tasks <span className="font-normal text-fg-subtle">· {ready.length}</span></p>
          <TaskDraftEditor tasks={tasks} onChange={setTasks} idPrefix="todo-ai" />
        </div>
        {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-body text-danger-fg">{error}</p>}
        <div className="flex flex-col-reverse gap-3 border-t border-line-subtle pt-4 sm:flex-row sm:items-center">
          <Button variant="ghost" icon="refresh" onClick={() => setStep('ask')} disabled={saving} className="sm:mr-auto">Change the request</Button>
          <div className="flex gap-2 sm:ml-auto">
            {onCancel && <Button variant="ghost" onClick={onCancel} disabled={saving}>Discard</Button>}
            <Button type="submit" icon="check" loading={saving} loadingLabel="Saving…" disabled={!title.trim() || !ready.length}>Save list</Button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={draft}
      aria-labelledby="todo-ai-heading"
      className="space-y-5 animate-fade-in"
    >
      {header}
      <Field id="todo-ai-prompt" label="What do you need to do?" count={prompt.length} max={2000}>
        <Textarea
          id="todo-ai-prompt"
          rows={5}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) draft(e); }}
          maxLength={2000}
          placeholder="e.g. Operating systems exam in 5 days. Weak on scheduling and deadlocks, haven't started memory management."
          autoFocus
        />
      </Field>
      <div>
        <p className="mb-2 text-caption text-fg-subtle">Or start from an example</p>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setPrompt(ex)} className="rounded-full bg-sunken px-3 py-1 text-left text-small text-fg-muted ring-1 ring-inset ring-line-subtle transition-colors hover:text-fg hover:ring-line">
              {ex}
            </button>
          ))}
        </div>
      </div>
      {declined && <p role="status" className="rounded-lg bg-sunken px-3 py-2 text-body text-fg-muted">{declined}</p>}
      {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-body text-danger-fg">{error}</p>}
      <div className="flex flex-col-reverse gap-3 border-t border-line-subtle pt-4 sm:flex-row sm:items-center">
        {onWriteManually && <Button variant="link" icon="edit" onClick={onWriteManually} className="sm:mr-auto">Write it myself instead</Button>}
        <div className="flex gap-2 sm:ml-auto">
          {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
          <Button type="submit" icon="sparkles" disabled={prompt.trim().length < 3 || disabled}>Draft my list</Button>
        </div>
      </div>
    </form>
  );
}
