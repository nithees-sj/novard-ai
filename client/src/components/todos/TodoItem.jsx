import React, { useEffect, useId, useState } from 'react';
import Badge from '../ui/Badge';
import Icon from '../ui/Icon';
import { IconButton } from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/Field';
import Menu, { MenuItem, MenuSeparator } from '../ui/Menu';
import cx from '../ui/cx';
import { PRIORITIES, dueLabel, dueStatus, priorityOf } from '../../lib/todos';

const DUE_TONE = { overdue: 'danger', today: 'warning', soon: 'accent', later: 'neutral' };

/** A text field that saves when it loses focus (or on Enter, for one line), only if it changed. */
function SavedOnBlur({ as: Comp = Input, value, onSave, required = false, ...rest }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const save = () => {
    const next = Comp === Input ? draft.replace(/\s+/g, ' ').trim() : draft.trim();
    if (required && !next) { setDraft(value); return; }
    if (next !== value) onSave(next);
  };
  return (
    <Comp
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { setDraft(value); e.currentTarget.blur(); }
        if (e.key === 'Enter' && Comp === Input) e.currentTarget.blur();
      }}
      {...rest}
    />
  );
}

/** The checklist under a task. */
function Subtasks({ subtasks, onChange, disabled }) {
  const [text, setText] = useState('');
  const id = useId();
  const add = (e) => {
    e.preventDefault();
    const t = text.replace(/\s+/g, ' ').trim();
    if (!t) return;
    onChange([...subtasks, { text: t, done: false }]);
    setText('');
  };
  const set = (i, patch) => onChange(subtasks.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div>
      <p className="mb-1.5 text-small font-medium text-fg">Steps{subtasks.length > 0 && <span className="font-normal text-fg-subtle"> · {subtasks.filter((s) => s.done).length} of {subtasks.length}</span>}</p>
      {subtasks.length > 0 && (
        <ul className="mb-2 space-y-1">
          {subtasks.map((s, i) => (
            <li key={s._id || `${i}-${s.text}`} className="group flex items-center gap-2.5 rounded px-1 py-0.5 hover:bg-sunken">
              <input
                type="checkbox"
                id={`${id}-${i}`}
                checked={s.done}
                onChange={(e) => set(i, { done: e.target.checked })}
                className="h-4 w-4 shrink-0 cursor-pointer accent-accent"
              />
              <label htmlFor={`${id}-${i}`} className={cx('min-w-0 flex-1 cursor-pointer text-body', s.done ? 'text-fg-subtle line-through' : 'text-fg')}>{s.text}</label>
              <IconButton icon="x" label={`Remove step "${s.text}"`} size="xs" onClick={() => onChange(subtasks.filter((_, j) => j !== i))} className="opacity-60 group-hover:opacity-100" />
            </li>
          ))}
        </ul>
      )}
      {subtasks.length < 20 && (
        <form onSubmit={add} className="flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a step" aria-label="Add a step" maxLength={200} className="h-8 text-small" disabled={disabled} />
          <IconButton icon="plus" label="Add step" type="submit" variant="secondary" size="sm" disabled={!text.trim()} />
        </form>
      )}
    </div>
  );
}

/**
 * One task: tick it off, see its priority and due date at a glance, and open
 * it to edit the text, notes, steps, due date and priority. Edits save as
 * soon as a field is left.
 */
export default function TodoItem({ item, today, expanded, onToggleExpand, onUpdate, onDelete, onMove, isFirst, isLast, dragProps, dragging, dropTarget, canDrag }) {
  const id = useId();
  const due = item.done ? null : dueStatus(item.dueDate, today);
  const priority = priorityOf(item.priority);
  const stepsDone = item.subtasks.filter((s) => s.done).length;

  return (
    <li
      {...(canDrag ? dragProps : {})}
      className={cx(
        'group/item rounded-lg bg-raised ring-1 ring-inset transition-[box-shadow,opacity] duration-150 animate-fade-in',
        expanded ? 'ring-line-strong shadow-raised' : 'ring-line-subtle hover:ring-line',
        dragging && 'opacity-40',
        dropTarget && 'ring-2 ring-accent',
      )}
    >
      <div className="flex items-start gap-2 px-2 py-2 sm:px-3">
        <span
          className={cx('mt-0.5 hidden h-5 w-4 shrink-0 items-center justify-center text-fg-subtle sm:flex', canDrag ? 'cursor-grab opacity-0 group-hover/item:opacity-100 active:cursor-grabbing' : 'opacity-0')}
          aria-hidden="true"
        >
          <Icon name="grip" className="h-4 w-4" />
        </span>
        <input
          type="checkbox"
          id={`${id}-done`}
          checked={item.done}
          onChange={(e) => onUpdate({ done: e.target.checked })}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-accent"
          aria-label={`Mark "${item.text}" as ${item.done ? 'not done' : 'done'}`}
        />
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          className="min-w-0 flex-1 rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
        >
          <span className={cx('block break-words text-body', item.done ? 'text-fg-subtle line-through' : 'text-fg')}>{item.text}</span>
          {(priority || item.dueDate || item.subtasks.length > 0 || item.notes) && (
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              {priority && !item.done && <Badge tone={priority.tone} dot>{priority.label}</Badge>}
              {item.dueDate && (
                <Badge tone={item.done ? 'neutral' : DUE_TONE[due]}>
                  <Icon name="clock" className="h-3 w-3" />
                  {due === 'overdue' ? `Overdue · ${dueLabel(item.dueDate, today)}` : dueLabel(item.dueDate, today)}
                </Badge>
              )}
              {item.subtasks.length > 0 && (
                <span className="inline-flex items-center gap-1 text-caption text-fg-subtle"><Icon name="quiz" className="h-3 w-3" />{stepsDone}/{item.subtasks.length}</span>
              )}
              {item.notes && <span className="inline-flex items-center gap-1 text-caption text-fg-subtle"><Icon name="notes" className="h-3 w-3" />Notes</span>}
            </span>
          )}
        </button>
        <Menu
          label={`Options for "${item.text}"`}
          width="w-48"
          trigger={(props) => (
            <button {...props} type="button" title="Task options" className="-my-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-fg-subtle transition-colors hover:bg-sunken hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
              <Icon name="more" className="h-4 w-4" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon="edit" onSelect={() => { close(); onToggleExpand(true); }}>Edit details</MenuItem>
              <MenuItem icon="arrowUp" disabled={isFirst || !onMove} onSelect={() => { close(); onMove(-1); }}>Move up</MenuItem>
              <MenuItem icon="arrowDown" disabled={isLast || !onMove} onSelect={() => { close(); onMove(1); }}>Move down</MenuItem>
              <MenuSeparator />
              <MenuItem icon="trash" danger onSelect={() => { close(); onDelete(); }}>Delete task</MenuItem>
            </>
          )}
        </Menu>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-line-subtle px-3 pb-4 pt-3 sm:pl-[3.25rem] animate-fade-in">
          <Field id={`${id}-text`} label="Task">
            <SavedOnBlur id={`${id}-text`} value={item.text} onSave={(text) => onUpdate({ text })} required maxLength={200} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id={`${id}-due`} label="Due date" optional>
              <div className="flex gap-2">
                <Input id={`${id}-due`} type="date" value={item.dueDate || ''} onChange={(e) => onUpdate({ dueDate: e.target.value || null })} />
                {item.dueDate && <IconButton icon="x" label="Clear due date" variant="secondary" onClick={() => onUpdate({ dueDate: null })} />}
              </div>
            </Field>
            <Field id={`${id}-priority`} label="Priority" optional>
              <Select id={`${id}-priority`} value={item.priority || ''} onChange={(e) => onUpdate({ priority: e.target.value || null })}>
                <option value="">None</option>
                {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
            </Field>
          </div>
          <Field id={`${id}-notes`} label="Notes" optional>
            <SavedOnBlur as={Textarea} id={`${id}-notes`} rows={3} value={item.notes} onSave={(notes) => onUpdate({ notes })} maxLength={2000} placeholder="Links, page numbers, anything that helps" />
          </Field>
          <Subtasks subtasks={item.subtasks} onChange={(subtasks) => onUpdate({ subtasks: subtasks.map(({ text, done }) => ({ text, done })) })} />
        </div>
      )}
    </li>
  );
}
