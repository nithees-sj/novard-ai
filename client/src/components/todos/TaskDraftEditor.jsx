import React, { useRef, useState } from 'react';
import { IconButton } from '../ui/Button';
import Icon from '../ui/Icon';
import { Input, Select } from '../ui/Field';
import { PRIORITIES } from '../../lib/todos';

let seq = 0;
/** A task being written, before the list is saved. `key` is only for React. */
export const draftTask = (fields = {}) => ({ key: `d${(seq += 1)}`, text: '', priority: null, dueDate: null, subtasks: [], ...fields });

/** The tasks ready to save: trimmed, empty rows left out. */
export const readyTasks = (tasks) => tasks
  .filter((t) => t.text.trim())
  .map(({ text, priority, dueDate, subtasks }) => ({ text: text.replace(/\s+/g, ' ').trim(), priority, dueDate, subtasks }));

/**
 * The tasks of a list that is not saved yet: each one editable in place
 * (text, priority, due date), removable, and a field at the end that adds
 * the next one on Enter and stays focused, so a list can be typed quickly.
 */
export default function TaskDraftEditor({ tasks, onChange, max = 200, idPrefix }) {
  const [next, setNext] = useState('');
  const nextRef = useRef(null);
  const set = (key, patch) => onChange(tasks.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  const remove = (key) => onChange(tasks.filter((t) => t.key !== key));

  // Enter keeps typing in the same field; leaving the field (e.g. to press Save) keeps what was typed.
  const add = (refocus) => {
    const text = next.replace(/\s+/g, ' ').trim();
    if (!text || tasks.length >= max) return;
    onChange([...tasks, draftTask({ text })]);
    setNext('');
    if (refocus) nextRef.current?.focus();
  };

  return (
    <div>
      {tasks.length > 0 && (
        <ol className="mb-2 divide-y divide-line-subtle overflow-hidden rounded-lg ring-1 ring-inset ring-line-subtle">
          {tasks.map((t, i) => (
            <li key={t.key} className="group flex flex-col gap-2 bg-raised px-3 py-2 animate-fade-in sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <span className="tabular w-5 shrink-0 text-right text-caption text-fg-subtle">{i + 1}.</span>
                <input
                  value={t.text}
                  onChange={(e) => set(t.key, { text: e.target.value })}
                  maxLength={200}
                  aria-label={`Task ${i + 1}`}
                  placeholder="Task"
                  className="h-8 min-w-0 flex-1 rounded bg-transparent px-1.5 text-body text-fg outline-none transition-shadow placeholder:text-fg-subtle hover:ring-1 hover:ring-line focus:ring-2 focus:ring-focus"
                />
                {t.subtasks.length > 0 && (
                  <span className="hidden shrink-0 items-center gap-1 text-caption text-fg-subtle sm:inline-flex" title={t.subtasks.map((s) => (typeof s === 'string' ? s : s.text)).join(' · ')}>
                    <Icon name="quiz" className="h-3 w-3" />{t.subtasks.length}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">
                <Select size="sm" value={t.priority || ''} onChange={(e) => set(t.key, { priority: e.target.value || null })} aria-label={`Priority of task ${i + 1}`} className="min-w-0 flex-1 sm:w-36 sm:flex-none sm:shrink-0">
                  <option value="">No priority</option>
                  {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </Select>
                <div className="min-w-0 flex-1 sm:w-40 sm:flex-none sm:shrink-0">
                  <Input type="date" value={t.dueDate || ''} onChange={(e) => set(t.key, { dueDate: e.target.value || null })} aria-label={`Due date of task ${i + 1}`} className="h-8 text-small" />
                </div>
                <IconButton icon="x" label={`Remove task ${i + 1}`} size="sm" onClick={() => remove(t.key)} />
              </div>
            </li>
          ))}
        </ol>
      )}
      {tasks.length < max && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 ring-1 ring-inset ring-line-subtle transition-shadow focus-within:ring-2 focus-within:ring-focus">
          <Icon name="plus" className="h-4 w-4 shrink-0 text-fg-subtle" />
          <input
            ref={nextRef}
            id={idPrefix ? `${idPrefix}-next` : undefined}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(true); } }}
            onBlur={() => add(false)}
            maxLength={200}
            aria-label="Add a task"
            placeholder={tasks.length ? 'Add another task and press Enter' : 'Type a task and press Enter'}
            className="h-8 min-w-0 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-fg-subtle"
          />
        </div>
      )}
    </div>
  );
}
