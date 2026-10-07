import React, { useCallback, useEffect, useRef, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import FeatureNotice from '../components/FeatureNotice';
import TodoListView from '../components/todos/TodoListView';
import NewListComposer from '../components/todos/NewListComposer';
import AiPlanner from '../components/todos/AiPlanner';
import ConvertToPlanModal from '../components/todos/ConvertToPlanModal';
import { PageHeader } from '../components/ui/Headers';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Icon from '../components/ui/Icon';
import Menu, { MenuItem, MenuSeparator } from '../components/ui/Menu';
import Toast from '../components/ui/Toast';
import confirm from '../components/ui/confirm';
import { ErrorState, Skeleton } from '../components/ui/States';
import cx from '../components/ui/cx';
import { useFeature } from '../context/AppStatusContext';
import { readOpenParam, clearOpenParam } from '../lib/openParam';
import { dueStatus, localToday, summaryOf, todosApi } from '../lib/todos';

const UNDO_MS = 5000;

/** Counts the page shows, recomputed after a local change (the server's reply replaces them). */
function recount(list, today) {
  const open = list.items.filter((i) => !i.done);
  const dated = open.map((i) => i.dueDate).filter(Boolean).sort();
  return {
    ...list,
    total: list.items.length,
    done: list.items.length - open.length,
    overdue: open.filter((i) => dueStatus(i.dueDate, today) === 'overdue').length,
    dueToday: dated.filter((d) => d === today).length,
    nextDue: dated[0] || null,
  };
}

/** One list in the rail: name, progress, what needs attention, and its own menu. */
function ListRow({ list, active, onSelect, onRename, onDelete }) {
  const pct = list.total ? Math.round((list.done / list.total) * 100) : 0;
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
        className={cx(
          'w-full rounded-lg py-2.5 pl-3 pr-10 text-left transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus',
          active ? 'bg-accent-soft ring-1 ring-inset ring-accent/20' : 'hover:bg-sunken',
        )}
      >
        <span className="flex items-center gap-2">
          <span className={cx('min-w-0 flex-1 truncate text-body font-medium', active ? 'text-accent-fg' : 'text-fg')}>{list.title}</span>
          {list.skillPlanId && <Icon name="plan" className="h-3.5 w-3.5 shrink-0 text-fg-subtle" label="Linked to a Skill Plan" />}
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <span className="h-1 flex-1 rounded-full bg-chart-track" aria-hidden="true">
            <span className={cx('block h-1 rounded-full transition-all duration-300', pct === 100 ? 'bg-success' : 'bg-accent')} style={{ width: `${pct}%` }} />
          </span>
          <span className="tabular shrink-0 text-caption text-fg-subtle">{list.done}/{list.total}</span>
        </span>
        {(list.overdue > 0 || list.dueToday > 0) && (
          <span className="mt-1.5 flex gap-1.5">
            {list.overdue > 0 && <Badge tone="danger">{list.overdue} overdue</Badge>}
            {list.dueToday > 0 && <Badge tone="warning">{list.dueToday} today</Badge>}
          </span>
        )}
      </button>
      <div className="absolute right-1.5 top-2">
        <Menu
          label={`Options for ${list.title}`}
          width="w-44"
          trigger={(props) => (
            <button
              {...props}
              type="button"
              title="List options"
              className="inline-flex h-7 w-7 items-center justify-center rounded text-fg-subtle opacity-100 transition-[opacity,color,background-color] duration-150 hover:bg-raised hover:text-fg focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus aria-expanded:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
            >
              <Icon name="more" className="h-4 w-4" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon="edit" onSelect={() => { close(); onRename(); }}>Rename</MenuItem>
              <MenuSeparator />
              <MenuItem icon="trash" danger onSelect={() => { close(false); onDelete(); }}>Delete list</MenuItem>
            </>
          )}
        </Menu>
      </div>
    </li>
  );
}

/** The rail's placeholder row while a new list is being written. */
const DraftRow = ({ mode }) => (
  <li className="rounded-lg bg-accent-soft px-3 py-2.5 ring-1 ring-inset ring-accent/20 animate-fade-in" aria-current="true">
    <span className="flex items-center gap-2 text-body font-medium text-accent-fg">
      <Icon name={mode === 'ai' ? 'sparkles' : 'plus'} className="h-4 w-4" />
      {mode === 'ai' ? 'Plan with AI' : 'New list'}
    </span>
  </li>
);

/** One of the two ways to start, as a large card. */
function Choice({ icon, title, text, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex flex-col items-start rounded-xl bg-raised p-5 text-left ring-1 ring-inset ring-line-subtle transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-raised hover:ring-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50"
    >
      <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent-fg"><Icon name={icon} className="h-5 w-5" /></span>
      <span className="text-lead font-semibold text-fg">{title}</span>
      <span className="mt-1 text-body text-fg-muted">{text}</span>
      <span className="mt-4 inline-flex items-center gap-1 text-small font-medium text-accent-fg">Start <Icon name="arrowRight" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
    </button>
  );
}

/** The first screen when there are no lists: the two ways to start, side by side. */
function StartChoice({ onPick, aiEnabled }) {
  return (
    <div className="mx-auto max-w-3xl py-6 animate-view-in">
      <div className="mb-6 text-center">
        <Icon name="todo" className="mx-auto mb-3 h-6 w-6 text-fg-subtle" strokeWidth={1.5} />
        <h2 className="text-lead font-semibold text-fg">Make your first list</h2>
        <p className="mt-1 text-body text-fg-muted">Write it yourself or let AI break a goal into tasks. The Novard Agent can make one for you too.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Choice icon="edit" title="Write it yourself" text="Name the list and type your tasks, with due dates and priorities if you like." onClick={() => onPick('new')} />
        <Choice icon="sparkles" title="Plan with AI" text="Describe the goal and deadline; get a step-by-step list you can edit before saving." onClick={() => onPick('ai')} disabled={!aiEnabled} />
      </div>
    </div>
  );
}

/**
 * Todo lists: the student's own lists of tasks, made by hand, drafted with
 * AI or by the Novard Agent, and turned into a Skill Unlocker plan when they
 * want to prepare properly. Creating, planning and the lists themselves all
 * happen in the main pane, without dialogs.
 */
export default function Todos() {
  const aiFeature = useFeature('todos');
  const [openId] = useState(() => readOpenParam());
  const [lists, setLists] = useState(null); // summaries
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState(openId);
  const [current, setCurrent] = useState(null); // the selected list, with its tasks
  const [listError, setListError] = useState('');
  const [mode, setMode] = useState('list'); // list | new | ai
  const [mobileView, setMobileView] = useState(openId ? 'main' : 'rail');
  const [converting, setConverting] = useState(false);
  const [renameRequest, setRenameRequest] = useState(0);
  const [undo, setUndo] = useState(null); // { listId, item, index }
  const [toast, setToast] = useState(null);
  const today = localToday();
  const seq = useRef(0);
  const cache = useRef(new Map()); // id -> full list, so switching back is instant
  const hidden = useRef(new Set()); // tasks deleted locally, waiting out the undo period
  const pending = useRef(null); // { listId, itemId, timer }
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  useEffect(() => { if (openId) clearOpenParam(); }, [openId]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.type === 'error' ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [toast]);

  /** A list from the server, minus tasks the student just deleted (still undoable). */
  const visible = useCallback((list) => (hidden.current.size && list.items.some((i) => hidden.current.has(i._id))
    ? recount({ ...list, items: list.items.filter((i) => !hidden.current.has(i._id)) }, today)
    : list), [today]);

  /** Put a list from the server in place: the cache, the open list and its row in the rail. */
  const place = useCallback((fromServer, { prepend = false } = {}) => {
    const list = visible(fromServer);
    cache.current.set(list._id, list);
    setCurrent((cur) => (cur && cur._id === list._id ? list : cur));
    setLists((cur) => {
      const all = cur || [];
      const known = all.some((l) => l._id === list._id);
      if (prepend || !known) return [summaryOf(list), ...all.filter((l) => l._id !== list._id)];
      return all.map((l) => (l._id === list._id ? summaryOf(list) : l));
    });
  }, [visible]);

  const loadLists = useCallback(async () => {
    setLoadError('');
    try {
      const all = await todosApi.lists();
      setLists(all);
      setSelectedId((id) => id || all[0]?._id || null);
    } catch (err) {
      setLoadError(err.message || 'Your lists could not be loaded.');
    }
  }, []);
  useEffect(() => { loadLists(); }, [loadLists]);

  const loadList = useCallback(async (id, { quiet = false } = {}) => {
    if (!quiet) setListError('');
    try {
      place(await todosApi.get(id));
      // Show it, unless the student has moved on to another list meanwhile.
      if (selectedRef.current === id) setCurrent(cache.current.get(id) || null);
    } catch (err) {
      if (quiet || selectedRef.current !== id) return;
      setCurrent(null);
      setListError(err.status === 404 ? 'That list could not be found. It may have been deleted.' : (err.message || 'This list could not be loaded.'));
    }
  }, [place]);

  // Show the selected list at once from the cache, then refresh it quietly.
  useEffect(() => {
    if (!selectedId) { setCurrent(null); return; }
    const cached = cache.current.get(selectedId);
    setCurrent(cached || null);
    loadList(selectedId, { quiet: Boolean(cached) });
  }, [selectedId, loadList]);

  /** Send a pending task deletion now (another action, or leaving the list). */
  const flushDelete = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    setUndo(null);
    todosApi.removeItem(p.listId, p.itemId)
      .then((saved) => { hidden.current.delete(p.itemId); place(saved); })
      .catch((err) => {
        hidden.current.delete(p.itemId);
        setToast({ type: 'error', message: err.message || 'The task could not be deleted.' });
        loadList(p.listId, { quiet: true });
      });
  }, [place, loadList]);
  // Leaving the page sends a deletion still waiting out its undo period.
  const flushRef = useRef(flushDelete);
  flushRef.current = flushDelete;
  useEffect(() => () => flushRef.current(), []);

  /**
   * Change the open list now, then on the server. Only the latest reply is
   * applied, so quick clicks never flicker; on failure the list is reloaded.
   */
  const mutate = useCallback(async (change, request, failMessage) => {
    if (!current) return;
    const id = current._id;
    const optimistic = recount(change(current), today);
    cache.current.set(id, optimistic);
    setCurrent(optimistic);
    setLists((cur) => (cur || []).map((l) => (l._id === id ? summaryOf(optimistic) : l)));
    const mine = ++seq.current;
    try {
      const saved = await request(id);
      if (mine === seq.current) place(saved);
    } catch (err) {
      setToast({ type: 'error', message: err.message || failMessage });
      loadList(id, { quiet: true });
    }
  }, [current, today, place, loadList]);

  const open = (id) => {
    flushDelete();
    setMode('list');
    setSelectedId(id);
    setMobileView('main');
  };

  const startCreating = (kind) => {
    flushDelete();
    setMode(kind);
    setMobileView('main');
  };

  const cancelCreating = () => {
    setMode('list');
    if (!selectedId) setMobileView('rail');
  };

  const created = (list, message) => {
    place(list, { prepend: true });
    setCurrent(list);
    setSelectedId(list._id);
    setMode('list');
    setMobileView('main');
    setToast({ type: 'success', message });
  };

  const deleteList = async (summary) => {
    const ok = await confirm({
      title: `Delete “${summary.title}”?`,
      message: `${summary.total ? `Its ${summary.total} ${summary.total === 1 ? 'task' : 'tasks'} will be deleted too.` : 'It has no tasks.'}${summary.skillPlanId ? ' The Skill Plan made from it stays in Skill Plans.' : ''} This can’t be undone.`,
      confirmLabel: 'Delete list',
      danger: true,
    });
    if (!ok) return;
    if (pending.current?.listId === summary._id) { clearTimeout(pending.current.timer); pending.current = null; setUndo(null); }
    try {
      await todosApi.remove(summary._id);
      cache.current.delete(summary._id);
      const rest = (lists || []).filter((l) => l._id !== summary._id);
      setLists(rest);
      if (selectedId === summary._id) {
        setCurrent(null);
        setSelectedId(rest[0]?._id || null);
        setMobileView('rail');
      }
      setToast({ type: 'success', message: `Deleted “${summary.title}”.` });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'The list could not be deleted.' });
    }
  };

  const deleteItem = (itemId) => {
    if (!current || itemId.startsWith('tmp-')) return;
    flushDelete();
    const index = current.items.findIndex((i) => i._id === itemId);
    if (index < 0) return;
    const item = current.items[index];
    hidden.current.add(itemId);
    const without = recount({ ...current, items: current.items.filter((i) => i._id !== itemId) }, today);
    cache.current.set(current._id, without);
    setCurrent(without);
    setLists((cur) => (cur || []).map((l) => (l._id === without._id ? summaryOf(without) : l)));
    pending.current = { listId: current._id, itemId, timer: setTimeout(() => flushDelete(), UNDO_MS) };
    setUndo({ listId: current._id, item, index });
  };

  const undoDelete = () => {
    const p = pending.current;
    if (!p || !undo) return;
    clearTimeout(p.timer);
    pending.current = null;
    hidden.current.delete(p.itemId);
    const base = cache.current.get(undo.listId);
    if (base) {
      const items = [...base.items];
      items.splice(Math.min(undo.index, items.length), 0, undo.item);
      const restored = recount({ ...base, items }, today);
      cache.current.set(restored._id, restored);
      setCurrent((cur) => (cur && cur._id === restored._id ? restored : cur));
      setLists((cur) => (cur || []).map((l) => (l._id === restored._id ? summaryOf(restored) : l)));
    }
    setUndo(null);
  };

  const tempId = () => `tmp-${Math.random().toString(36).slice(2)}`;
  const actions = current && {
    onRename: (fields) => mutate((l) => ({ ...l, ...fields }), (id) => todosApi.update(id, fields), 'The list could not be renamed.'),
    onAdd: (item) => mutate(
      (l) => ({ ...l, items: [...l.items, { _id: tempId(), text: item.text, notes: '', done: false, priority: null, dueDate: null, subtasks: [] }] }),
      (id) => todosApi.addItem(id, item),
      'The task could not be added.',
    ),
    onUpdateItem: (itemId, patch) => {
      if (itemId.startsWith('tmp-')) return; // still being saved
      mutate(
        (l) => ({ ...l, items: l.items.map((i) => (i._id === itemId ? { ...i, ...patch } : i)) }),
        (id) => todosApi.updateItem(id, itemId, patch),
        'The task could not be saved.',
      );
    },
    onDeleteItem: deleteItem,
    onReorder: (itemIds) => {
      if (itemIds.some((i) => i.startsWith('tmp-'))) return;
      flushDelete();
      mutate(
        (l) => ({ ...l, items: itemIds.map((i) => l.items.find((x) => x._id === i)).filter(Boolean) }),
        (id) => todosApi.reorder(id, itemIds),
        'The new order could not be saved.',
      );
    },
    onClearCompleted: () => {
      flushDelete();
      mutate((l) => ({ ...l, items: l.items.filter((i) => !i.done) }), (id) => todosApi.clearCompleted(id), 'Completed tasks could not be cleared.');
    },
  };

  const loading = lists === null && !loadError;
  const empty = lists && lists.length === 0;
  const creating = mode === 'new' || mode === 'ai';

  const composer = mode === 'new'
    ? (
      <NewListComposer
        onCreate={async (body) => {
          const list = await todosApi.create(body);
          created(list, `Created “${list.title}”.`);
        }}
        onCancel={empty ? () => setMode('list') : cancelCreating}
        onUseAi={() => setMode('ai')}
        aiEnabled={aiFeature.enabled}
      />
    ) : (
      <AiPlanner
        disabled={!aiFeature.enabled}
        onCreated={(list) => created(list, `“${list.title}” is ready with ${list.total} ${list.total === 1 ? 'task' : 'tasks'}.`)}
        onCancel={empty ? () => setMode('list') : cancelCreating}
        onWriteManually={() => setMode('new')}
      />
    );

  let main;
  if (creating) main = composer;
  else if (current) {
    main = (
      <TodoListView
        key={current._id}
        list={current}
        today={today}
        onBack={() => setMobileView('rail')}
        onDelete={() => deleteList(current)}
        onConvert={() => setConverting(true)}
        editRequest={renameRequest}
        undo={undo && undo.listId === current._id ? { text: undo.item.text, onUndo: undoDelete } : null}
        {...actions}
      />
    );
  } else if (listError) main = <ErrorState title="This list didn’t load" text={listError} onRetry={() => loadList(selectedId)} />;
  else main = <div className="space-y-3" aria-busy="true" aria-label="Loading the list"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-2 w-full" />{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" rounded="rounded-lg" />)}</div>;

  return (
    <AppShell page="todos">
      <PageHeader
        title="Todo lists"
        description="Plan what you need to get done, tick it off, and turn a list into a day-by-day Skill Plan when it is time to prepare properly."
        actions={!empty && !loading && (
          <>
            <Button variant="secondary" icon="plus" onClick={() => startCreating('new')} aria-pressed={mode === 'new'}>New list</Button>
            <Button icon="sparkles" onClick={() => startCreating('ai')} disabled={!aiFeature.enabled} aria-pressed={mode === 'ai'}>Plan with AI</Button>
          </>
        )}
      />
      <FeatureNotice tool="todos" />

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]" aria-busy="true" aria-label="Loading your lists">
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" rounded="rounded-lg" />)}</div>
          <div className="space-y-3"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-2 w-full" />{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" rounded="rounded-lg" />)}</div>
        </div>
      ) : loadError ? (
        <ErrorState title="Your lists didn’t load" text={loadError} onRetry={loadLists} />
      ) : empty ? (
        creating
          ? <div key={mode} className="mx-auto max-w-3xl rounded-xl bg-raised p-4 ring-1 ring-line-subtle animate-view-in sm:p-6">{composer}</div>
          : <StartChoice onPick={setMode} aiEnabled={aiFeature.enabled} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
          <nav aria-label="Your lists" className={cx('lg:sticky lg:top-20', mobileView === 'main' && 'hidden lg:block')}>
            <p className="mb-2 px-1 text-small font-medium text-fg-muted">Your lists <span className="text-fg-subtle">· {lists.length}</span></p>
            <ul className="space-y-1">
              {creating && <DraftRow mode={mode} />}
              {lists.map((l) => (
                <ListRow
                  key={l._id}
                  list={l}
                  active={!creating && l._id === selectedId}
                  onSelect={() => open(l._id)}
                  onRename={() => { open(l._id); setRenameRequest((n) => n + 1); }}
                  onDelete={() => deleteList(l)}
                />
              ))}
            </ul>
          </nav>

          <div className={cx('min-w-0 rounded-xl bg-raised p-4 ring-1 ring-line-subtle sm:p-6', mobileView === 'rail' && 'hidden lg:block')}>
            {creating && (
              <Button variant="ghost" size="sm" icon="arrowLeft" onClick={() => { setMode('list'); setMobileView('rail'); }} className="-ml-2 mb-3 lg:hidden">All lists</Button>
            )}
            <div key={creating ? mode : 'list'} className="animate-view-in">{main}</div>
          </div>
        </div>
      )}

      {current && (
        <ConvertToPlanModal
          open={converting}
          list={current}
          onClose={() => setConverting(false)}
          onConverted={(list) => place(list)}
        />
      )}
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </AppShell>
  );
}
