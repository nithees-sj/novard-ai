import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon, formatDate } from './learning/LearningUI';
import { reportsApi } from '../lib/reports';

const REFRESH_MS = 60 * 1000;

const KIND_ICON = { report_resolved: 'check', report_reply: 'chat', announcement: 'sparkles', ai_limit: 'bolt', todo_due: 'todo' };

/**
 * The bell in the header: updates on the student's reports and announcements
 * from the Novard team, with an unread count. Checked every minute and on
 * every page change.
 */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ notifications: [], unread: 0 });
  const panel = useRef(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const refresh = useCallback(() => reportsApi.notifications().then(setData).catch(() => {}), []);

  useEffect(() => {
    refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (panel.current && !panel.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const markAllRead = async () => {
    await reportsApi.markRead().catch(() => {});
    refresh();
  };

  const openItem = async (n) => {
    if (!n.read) await reportsApi.markRead([n._id]).catch(() => {});
    setOpen(false);
    refresh();
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={panel}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted transition-colors duration-150 hover:bg-sunken hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        aria-label={data.unread ? `Notifications, ${data.unread} unread` : 'Notifications'}
        aria-expanded={open}
      >
        <Icon name="bell" className="h-[1.125rem] w-[1.125rem]" />
        {data.unread > 0 && (
          <span className="tabular absolute right-0.5 top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent px-1 text-micro font-semibold text-on-accent ring-2 ring-canvas">
            {data.unread > 9 ? '9+' : data.unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-[70] overflow-hidden rounded-lg bg-overlay shadow-popover ring-1 ring-line-subtle animate-slide-down sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1.5 sm:w-96" role="dialog" aria-label="Notifications">
          <div className="flex items-center justify-between border-b border-line-subtle px-4 py-3">
            <h3 className="text-body font-semibold text-fg">Notifications</h3>
            {data.unread > 0 && <button type="button" onClick={markAllRead} className="text-small font-medium text-accent-fg hover:underline">Mark all as read</button>}
          </div>
          <ul className="max-h-96 divide-y divide-line-subtle overflow-y-auto">
            {data.notifications.length === 0 && (
              <li className="px-4 py-10 text-center">
                <p className="text-body font-medium text-fg">No notifications yet</p>
                <p className="mt-0.5 text-small text-fg-muted">Updates on your reports and news from the Novard team appear here.</p>
              </li>
            )}
            {data.notifications.map((n) => (
              <li key={n._id}>
                <button type="button" onClick={() => openItem(n)} className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-sunken ${n.read ? '' : 'bg-accent-soft/40'}`}>
                  <Icon name={KIND_ICON[n.kind] || 'bell'} className="mt-0.5 h-4 w-4 text-fg-subtle" />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-body ${n.read ? 'text-fg-muted' : 'font-medium text-fg'}`}>{n.title}</span>
                    {n.body && <span className="mt-0.5 block line-clamp-2 text-small text-fg-muted">{n.body}</span>}
                    <span className="mt-1 block text-caption text-fg-subtle">{formatDate(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="unread" />}
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-line-subtle px-4 py-2.5 text-center">
            <button type="button" onClick={() => { setOpen(false); navigate('/reports'); }} className="text-small font-medium text-accent-fg hover:underline">See all my reports</button>
          </div>
        </div>
      )}
    </div>
  );
}
