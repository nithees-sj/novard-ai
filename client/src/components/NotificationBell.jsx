import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon, formatDate } from './learning/LearningUI';
import { reportsApi } from '../lib/reports';

const REFRESH_MS = 60 * 1000;

const KIND_ICON = { report_resolved: 'check', report_reply: 'chat', announcement: 'sparkles', ai_limit: 'bolt' };

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
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-gray-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        aria-label={data.unread ? `Notifications, ${data.unread} unread` : 'Notifications'}
        aria-expanded={open}
      >
        <Icon name="bell" className="h-5 w-5" />
        {data.unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-bold text-white tabular-nums">
            {data.unread > 9 ? '9+' : data.unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-[60] w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-200 bg-surface-overlay shadow-hard animate-slide-down" role="dialog" aria-label="Notifications">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
            {data.unread > 0 && <button type="button" onClick={markAllRead} className="text-xs font-semibold text-blue-600 hover:underline">Mark all as read</button>}
          </div>
          <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
            {data.notifications.length === 0 && (
              <li className="px-4 py-10 text-center">
                <p className="text-sm font-semibold text-gray-900">No notifications yet</p>
                <p className="mt-0.5 text-xs text-gray-500">Updates on your reports and news from the Novard team appear here.</p>
              </li>
            )}
            {data.notifications.map((n) => (
              <li key={n._id}>
                <button type="button" onClick={() => openItem(n)} className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-gray-100 ${n.read ? '' : 'bg-blue-50/40'}`}>
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                    <Icon name={KIND_ICON[n.kind] || 'bell'} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{n.title}</span>
                    {n.body && <span className="mt-0.5 block line-clamp-2 text-xs text-gray-500">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-gray-500">{formatDate(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="unread" />}
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-gray-100 px-4 py-2.5 text-center">
            <button type="button" onClick={() => { setOpen(false); navigate('/reports'); }} className="text-xs font-semibold text-blue-600 hover:underline">See all my reports</button>
          </div>
        </div>
      )}
    </div>
  );
}
