import React, { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';
import { Link } from 'react-router-dom';
import AgentAvatar from './AgentAvatar';
import { currentName } from '../../lib/session';

const DAY = 24 * 60 * 60 * 1000;

/** Today / Yesterday / Previous 7 days / Previous 30 days / Older, newest first. */
function groupByDate(items) {
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const t = startOfToday.getTime();
  const groups = [
    { label: 'Today', from: t },
    { label: 'Yesterday', from: t - DAY },
    { label: 'Previous 7 days', from: t - 7 * DAY },
    { label: 'Previous 30 days', from: t - 30 * DAY },
    { label: 'Older', from: -Infinity },
  ].map((g) => ({ ...g, items: [] }));
  items.forEach((c) => {
    const at = new Date(c.updatedAt).getTime();
    groups.find((g) => at >= g.from).items.push(c);
  });
  return groups.filter((g) => g.items.length);
}

const Row = ({ chat, active, onOpen, onRename, onDelete }) => {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [title, setTitle] = useState(chat.title);
  const ref = useRef(null);

  useEffect(() => { setTitle(chat.title); }, [chat.title]);
  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) { setMenu(false); setConfirming(false); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const save = () => {
    setEditing(false);
    const next = title.trim();
    if (next && next !== chat.title) onRename(chat._id, next);
    else setTitle(chat.title);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={title}
        maxLength={120}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setTitle(chat.title); setEditing(false); } }}
        className="w-full rounded-lg border border-accent/50 bg-raised px-3 py-2 text-sm outline-none ring-2 ring-accent/20"
        aria-label="Chat title"
      />
    );
  }

  return (
    <div ref={ref} className={`group relative flex items-center rounded-lg ${active ? 'bg-raised shadow-sm ring-1 ring-line' : 'hover:bg-line/60'}`}>
      <button type="button" onClick={() => onOpen(chat._id)} className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm text-fg" title={chat.title} aria-current={active ? 'page' : undefined}>
        {chat.title}
      </button>
      <button
        type="button"
        onClick={() => setMenu((v) => !v)}
        className={`mr-1 rounded-md p-1 text-fg-subtle hover:bg-line hover:text-fg ${menu || active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
        aria-label={`Options for ${chat.title}`}
        aria-expanded={menu}
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" /></svg>
      </button>
      {menu && (
        <div className="absolute right-1 top-9 z-20 w-44 rounded-xl border border-line bg-raised p-1 shadow-lg" role="menu">
          {confirming ? (
            <div className="p-2">
              <p className="mb-2 text-xs text-fg-muted">Delete this chat? This cannot be undone.</p>
              <div className="flex justify-end gap-1">
                <button type="button" onClick={() => setConfirming(false)} className="rounded-md px-2 py-1 text-xs text-fg-muted hover:bg-sunken">Cancel</button>
                <button type="button" onClick={() => { setMenu(false); onDelete(chat._id); }} className="rounded-md bg-danger px-2 py-1 text-xs font-semibold text-white hover:bg-red-700">Delete</button>
              </div>
            </div>
          ) : (
            <>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); setEditing(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-fg-muted hover:bg-sunken">Rename</button>
              <button type="button" role="menuitem" onClick={() => setConfirming(true)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger-fg hover:bg-danger-soft">Delete</button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

/** Left column of the agent: new chat, search, and the chat history grouped by date. */
const AgentSidebar = ({ chats, loading, activeId, onNew, onOpen, onRename, onDelete, user, onClose, onProfile }) => {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groupByDate(q ? chats.filter((c) => c.title.toLowerCase().includes(q)) : chats);
  }, [chats, query]);

  return (
    <aside className="flex h-full w-72 flex-col border-r border-line bg-sunken" aria-label="Chats">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <Link to="/home" className="flex items-center gap-2.5" title="Back to Novard-AI">
          <AgentAvatar size="h-8 w-8" />
          <span className="text-body font-bold text-fg">Novard Agent</span>
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-fg-subtle hover:bg-line md:hidden" aria-label="Close chat list">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      <div className="space-y-2 px-3">
        <button type="button" onClick={onNew} className="flex w-full items-center gap-2 rounded-xl border border-line bg-raised px-3 py-2.5 text-sm font-semibold text-fg shadow-sm transition hover:border-line-strong hover:shadow">
          <svg className="h-4 w-4 text-accent-fg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" /></svg>
          New chat
          <kbd className="ml-auto hidden rounded border border-line bg-sunken px-1.5 text-micro font-medium text-fg-subtle md:inline">Ctrl ⇧ O</kbd>
        </button>
        <div className="relative">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" /></svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
            className="w-full rounded-lg border border-transparent bg-line/60 py-2 pl-9 pr-3 text-sm placeholder:text-fg-subtle outline-none focus:border-line-strong focus:bg-raised"
          />
        </div>
      </div>

      <nav className="mt-3 flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {loading && !chats.length ? (
          <div className="space-y-2 px-1 pt-2" aria-hidden="true">
            {[70, 90, 60, 80].map((w) => <div key={w} className="h-4 animate-pulse rounded bg-line" style={{ width: `${w}%` }} />)}
          </div>
        ) : groups.length === 0 ? (
          <p className="px-3 pt-6 text-center text-sm text-fg-subtle">{query ? 'No chats match your search.' : 'Your chats will appear here.'}</p>
        ) : groups.map((g) => (
          <div key={g.label}>
            <p className="px-3 pb-1 text-caption font-medium text-fg-subtle">{g.label}</p>
            <div className="space-y-0.5">
              {g.items.map((c) => (
                <Row key={c._id} chat={c} active={c._id === activeId} onOpen={onOpen} onRename={onRename} onDelete={onDelete} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        {onProfile && (
          <button type="button" onClick={onProfile} className="mb-1 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-fg-muted hover:bg-line/60">
            <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <span>
              <span className="block font-medium text-fg">Learner profile</span>
              <span className="block text-xs text-fg-subtle">What the agent remembers about you</span>
            </span>
          </button>
        )}
        <Link to="/home" className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-line/60">
          <Avatar src={user?.photoURL || user?.picture} name={user?.name || user?.displayName || currentName()} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-fg">{user?.name || user?.displayName || currentName() || 'You'}</p>
            <p className="flex items-center gap-1 text-caption text-fg-subtle"><Icon name="arrowLeft" className="h-3 w-3" /> Back to Home</p>
          </div>
        </Link>
      </div>
    </aside>
  );
};

export default AgentSidebar;
