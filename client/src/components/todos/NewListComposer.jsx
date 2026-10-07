import React, { useState } from 'react';
import Button from '../ui/Button';
import { Field, Input } from '../ui/Field';
import TaskDraftEditor, { readyTasks } from './TaskDraftEditor';

/**
 * "New list", written in place in the main pane: a name, an optional line
 * on what it is for, and the first tasks (each with an optional priority and
 * due date). Ctrl/Cmd+Enter creates it.
 */
export default function NewListComposer({ onCreate, onCancel, onUseAi, aiEnabled = true }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tasks, setTasks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Enter in the name or description moves on to the tasks instead of creating a list without them.
  const toTasks = (e) => {
    if (e.key !== 'Enter' || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    document.getElementById('todo-new-next')?.focus();
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true); setError('');
    try {
      await onCreate({ title: title.replace(/\s+/g, ' ').trim(), description: description.trim(), items: readyTasks(tasks) });
    } catch (err) {
      setError(err.message || 'The list could not be created. Please try again.');
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e); }}
      aria-labelledby="todo-new-heading"
      className="space-y-5"
    >
      <div>
        <h2 id="todo-new-heading" className="text-title font-semibold text-fg">New list</h2>
        <p className="mt-0.5 text-body text-fg-muted">Name it, add the first few tasks, and create it. You can add more at any time.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="todo-new-title" label="Name" required>
          <Input id="todo-new-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Semester 5 exam prep" onKeyDown={toTasks} autoFocus />
        </Field>
        <Field id="todo-new-description" label="What is it for?" optional>
          <Input id="todo-new-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder="e.g. Finals start on the 20th" onKeyDown={toTasks} />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-small font-medium text-fg">Tasks <span className="font-normal text-fg-subtle">· {readyTasks(tasks).length}</span></p>
        <TaskDraftEditor tasks={tasks} onChange={setTasks} idPrefix="todo-new" />
      </div>

      {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-body text-danger-fg">{error}</p>}

      <div className="flex flex-col-reverse gap-3 border-t border-line-subtle pt-4 sm:flex-row sm:items-center">
        {onUseAi && (
          <Button variant="link" icon="sparkles" onClick={onUseAi} disabled={!aiEnabled} className="sm:mr-auto">Let AI break it down instead</Button>
        )}
        <div className="flex gap-2 sm:ml-auto">
          {onCancel && <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>}
          <Button type="submit" icon="check" loading={busy} loadingLabel="Creating…" disabled={!title.trim()}>Create list</Button>
        </div>
      </div>
    </form>
  );
}
