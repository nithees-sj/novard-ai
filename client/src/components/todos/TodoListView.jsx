import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button, { IconButton } from '../ui/Button';
import Badge from '../ui/Badge';
import Icon from '../ui/Icon';
import { Input, Select } from '../ui/Field';
import Menu, { MenuItem, MenuSeparator } from '../ui/Menu';
import { SegmentedControl } from '../ui/Tabs';
import { EmptyState } from '../ui/States';
import cx from '../ui/cx';
import { PRIORITIES, dueStatus } from '../../lib/todos';
import TodoItem from './TodoItem';

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'To do' },
  { id: 'done', label: 'Done' },
];
const DUE_FILTERS = [
  { id: 'any', label: 'Any due date' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Due today' },
  { id: 'week', label: 'Due in 7 days' },
  { id: 'none', label: 'No due date' },
];
const SORTS = [
  { id: 'manual', label: 'My order' },
  { id: 'due', label: 'Due date' },
  { id: 'priority', label: 'Priority' },
];
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const daysUntil = (d, today) => (Date.parse(`${d}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5;

function matchesDue(item, filter, today) {
  if (filter === 'any') return true;
  if (filter === 'none') return !item.dueDate;
  if (!item.dueDate || item.done) return false;
  if (filter === 'overdue') return dueStatus(item.dueDate, today) === 'overdue';
  if (filter === 'today') return item.dueDate === today;
  return daysUntil(item.dueDate, today) <= 7;
}

/** The list's name and description, edited in place (also when asked from the lists rail). */
function ListHeading({ list, onRename, editRequest }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [description, setDescription] = useState(list.description);
  const start = () => { setTitle(list.title); setDescription(list.description); setEditing(true); };
  useEffect(() => { if (editRequest) start(); }, [editRequest]); // eslint-disable-line react-hooks/exhaustive-deps -- only on a new request
  const save = (e) => {
    e.preventDefault();
    const t = title.replace(/\s+/g, ' ').trim();
    if (!t) return;
    setEditing(false);
    if (t !== list.title || description.trim() !== list.description) onRename({ title: t, description: description.trim() });
  };

  if (editing) {
    return (
      <form onSubmit={save} onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }} className="min-w-0 flex-1 space-y-2 animate-fade-in">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label="List name" autoFocus className="text-lead font-semibold" />
        <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} aria-label="Description" placeholder="What is this list for? (optional)" />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={!title.trim()}>Save</Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </form>
    );
  }
  return (
    <div className="min-w-0 flex-1">
      <h2 className="flex items-center gap-2 text-title font-semibold text-fg">
        <span className="min-w-0 break-words">{list.title}</span>
        <IconButton icon="edit" label="Rename list" size="xs" onClick={start} />
      </h2>
      {list.description && <p className="mt-0.5 text-body text-fg-muted">{list.description}</p>}
    </div>
  );
}

/**
 * One todo list: progress, filters, quick add and the tasks. Tasks are
 * reordered by dragging (in "My order" with no filters) or from each task's
 * menu, which also works from the keyboard.
 */
export default function TodoListView({ list, today, onBack, onRename, onDelete, onConvert, onAdd, onUpdateItem, onDeleteItem, onReorder, onClearCompleted, editRequest, undo }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('any');
  const [due, setDue] = useState('any');
  const [sort, setSort] = useState('manual');
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [drag, setDrag] = useState(null); // { id, over }

  const filtered = status !== 'all' || priority !== 'any' || due !== 'any';
  const canDrag = sort === 'manual' && !filtered;

  const shown = useMemo(() => {
    const items = list.items.filter((i) => (status === 'all' || (status === 'done' ? i.done : !i.done))
      && (priority === 'any' || i.priority === priority)
      && matchesDue(i, due, today));
    if (sort === 'due') return [...items].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
    if (sort === 'priority') return [...items].sort((a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3));
    return items;
  }, [list.items, status, priority, due, sort, today]);

  const pct = list.total ? Math.round((list.done / list.total) * 100) : 0;

  const add = (e) => {
    e.preventDefault();
    const t = text.replace(/\s+/g, ' ').trim();
    if (!t) return;
    onAdd({ text: t });
    setText('');
  };

  const move = (itemId, by) => {
    const ids = list.items.map((i) => i._id);
    const from = ids.indexOf(itemId);
    const to = from + by;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    onReorder(ids);
  };

  const dropOn = (targetId) => {
    if (!drag || drag.id === targetId) { setDrag(null); return; }
    const ids = list.items.map((i) => i._id).filter((i) => i !== drag.id);
    ids.splice(ids.indexOf(targetId) + (list.items.findIndex((i) => i._id === drag.id) < list.items.findIndex((i) => i._id === targetId) ? 1 : 0), 0, drag.id);
    setDrag(null);
    onReorder(ids);
  };

  const dragProps = (itemId) => ({
    draggable: true,
    onDragStart: (e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', itemId); setDrag({ id: itemId, over: null }); },
    onDragOver: (e) => { if (!drag) return; e.preventDefault(); if (drag.over !== itemId) setDrag({ ...drag, over: itemId }); },
    onDrop: (e) => { e.preventDefault(); dropOn(itemId); },
    onDragEnd: () => setDrag(null),
  });

  return (
    <section aria-label={list.title} className="min-w-0">
      <div className="flex items-start gap-2">
        {onBack && <IconButton icon="arrowLeft" label="All lists" onClick={onBack} className="-ml-2 lg:hidden" />}
        <ListHeading key={list._id} list={list} onRename={onRename} editRequest={editRequest} />
        <div className="flex shrink-0 items-center gap-1.5">
          {list.skillPlanId ? (
            <Button variant="soft" size="sm" icon="plan" onClick={() => navigate(`/skill-unlocker?open=${list.skillPlanId}`)} className="hidden sm:inline-flex">Open Skill Plan</Button>
          ) : (
            <Button variant="soft" size="sm" icon="plan" onClick={onConvert} disabled={!list.total} className="hidden sm:inline-flex">Turn into a Skill Plan</Button>
          )}
          <IconButton icon="trash" label="Delete list" size="sm" onClick={onDelete} className="hover:bg-danger-soft hover:text-danger-fg" />
          <Menu
            label="List options"
            trigger={(props) => <button {...props} type="button" title="List options" className="inline-flex h-8 w-8 items-center justify-center rounded text-fg-muted transition-colors hover:bg-sunken hover:text-fg"><Icon name="more" className="h-4 w-4" /></button>}
          >
            {(close) => (
              <>
                {list.skillPlanId
                  ? <MenuItem icon="plan" onSelect={() => { close(); navigate(`/skill-unlocker?open=${list.skillPlanId}`); }}>Open Skill Plan</MenuItem>
                  : <MenuItem icon="plan" disabled={!list.total} onSelect={() => { close(); onConvert(); }}>Turn into a Skill Plan</MenuItem>}
                <MenuItem icon="check" disabled={!list.done} onSelect={() => { close(); onClearCompleted(); }}>Clear completed</MenuItem>
                <MenuSeparator />
                <MenuItem icon="trash" danger onSelect={() => { close(); onDelete(); }}>Delete list</MenuItem>
              </>
            )}
          </Menu>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="tabular text-small text-fg-muted">{list.total ? `${list.done} of ${list.total} done · ${pct}%` : 'No tasks yet'}</span>
          <span className="flex flex-wrap gap-1.5">
            {list.overdue > 0 && <Badge tone="danger">{list.overdue} overdue</Badge>}
            {list.dueToday > 0 && <Badge tone="warning">{list.dueToday} due today</Badge>}
            {list.skillPlanId && <Badge tone="accent"><Icon name="plan" className="h-3 w-3" />In Skill Plans</Badge>}
          </span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-chart-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="List progress">
          <div className={cx('h-1.5 rounded-full transition-all duration-300', pct === 100 ? 'bg-success' : 'bg-accent')} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Quick add */}
      <form onSubmit={add} className="mt-5 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a task and press Enter" aria-label="New task" maxLength={200} />
        <Button type="submit" icon="plus" disabled={!text.trim()}>Add</Button>
      </form>

      {/* Filters */}
      {list.total > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} label="Show" size="sm" />
          <Select size="sm" value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority" className="w-auto">
            <option value="any">Any priority</option>
            {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label} priority</option>)}
          </Select>
          <Select size="sm" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" className="w-auto">
            {DUE_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </Select>
          <Select size="sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by" className="w-auto sm:ml-auto">
            {SORTS.map((s) => <option key={s.id} value={s.id}>Sort: {s.label}</option>)}
          </Select>
        </div>
      )}

      {/* Tasks */}
      {list.total === 0 ? (
        <EmptyState compact icon="todo" title="Nothing on this list yet" text="Add your first task above. Small, concrete steps are easier to tick off." />
      ) : shown.length === 0 ? (
        <EmptyState
          compact
          icon="search"
          title="No tasks match"
          text="Try another filter."
          action={<Button variant="secondary" size="sm" onClick={() => { setStatus('all'); setPriority('any'); setDue('any'); }}>Show all tasks</Button>}
        />
      ) : (
        <ul className="mt-4 space-y-2" aria-label="Tasks">
          {shown.map((item) => (
            <TodoItem
              key={item._id}
              item={item}
              today={today}
              expanded={expanded === item._id}
              onToggleExpand={(open) => setExpanded((cur) => (open === true || cur !== item._id ? item._id : null))}
              onUpdate={(patch) => onUpdateItem(item._id, patch)}
              onDelete={() => onDeleteItem(item._id)}
              onMove={canDrag ? (by) => move(item._id, by) : null}
              isFirst={list.items[0]?._id === item._id}
              isLast={list.items[list.items.length - 1]?._id === item._id}
              canDrag={canDrag}
              dragProps={dragProps(item._id)}
              dragging={drag?.id === item._id}
              dropTarget={drag && drag.over === item._id && drag.id !== item._id}
            />
          ))}
        </ul>
      )}
      {list.total > 1 && !canDrag && <p className="mt-3 text-caption text-fg-subtle">Reordering works in “My order” with every task shown.</p>}

      {/* A deleted task can be brought back for a few seconds. */}
      {undo && (
        <div role="status" className="mt-4 flex items-center gap-3 rounded-lg bg-ink px-4 py-2.5 text-on-ink shadow-popover animate-slide-up">
          <Icon name="trash" className="h-4 w-4 shrink-0 opacity-70" />
          <p className="min-w-0 flex-1 truncate text-body">Deleted “{undo.text}”</p>
          <button type="button" onClick={undo.onUndo} className="shrink-0 rounded px-2 py-1 text-body font-semibold underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Undo</button>
        </div>
      )}

      {/* On phones the plan action sits below the tasks. */}
      {list.total > 0 && (
        <div className="mt-6 sm:hidden">
          {list.skillPlanId
            ? <Button block variant="soft" icon="plan" onClick={() => navigate(`/skill-unlocker?open=${list.skillPlanId}`)}>Open Skill Plan</Button>
            : <Button block variant="soft" icon="plan" onClick={onConvert}>Turn into a Skill Plan</Button>}
        </div>
      )}
    </section>
  );
}
