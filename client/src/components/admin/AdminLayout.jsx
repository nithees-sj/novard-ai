import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigationinner } from '../navigationinner';
import Sidebar from '../Sidebar';
import { useAdminAuth } from '../../AdminAuthContext';
import { useAuth } from '../../AuthContext';
import { adminGet, adminPost } from '../../lib/adminApi';

const item = (name, icon, route) => ({ name, route, icon });

export const ADMIN_SECTIONS = [
  item('Overview', 'sparkles', '/admin'),
  item('Risk board', 'chart', '/admin/risk'),
  item('Investigations', 'bolt', '/admin/runs'),
  item('Reports inbox', 'flag', '/admin/reports'),
  item('Gateways', 'globe', '/admin/gateways'),
  item('Users', 'users', '/admin/users'),
  item('Moderation', 'shield', '/admin/moderation'),
  item('Features & limits', 'settings', '/admin/settings'),
  item('Announcements', 'bell', '/admin/announcements'),
  item('Admin assistant', 'chat', '/admin/assistant'),
  item('Audit log', 'list', '/admin/audit'),
];

const ALERT_POLL_MS = 20 * 1000; // EWDI's alert banner interval

/** New risk alerts, polled every 20 s: open the board, or acknowledge (dismiss). */
function AlertBanner() {
  const [alerts, setAlerts] = useState([]);
  const navigate = useNavigate();
  const pull = useCallback(() => adminGet('/api/admin/risk/alerts').then((d) => setAlerts(d.open || [])).catch(() => {}), []);
  useEffect(() => {
    pull();
    const t = setInterval(pull, ALERT_POLL_MS);
    return () => clearInterval(t);
  }, [pull]);

  const ack = async (id) => {
    await adminPost(`/api/admin/risk/alerts/${id}/ack`).catch(() => {});
    pull();
  };
  if (!alerts.length) return null;
  return (
    <div className="mb-6 space-y-2" aria-live="polite">
      {alerts.slice(0, 3).map((a) => (
        <div key={a._id} role="alert" className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${a.level === 'CRITICAL' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
          <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${a.level === 'CRITICAL' ? 'bg-red-600 text-white' : 'bg-amber-400 text-amber-950'}`}>{a.level}</span>
          <p className="min-w-0 flex-1 text-sm text-gray-800">{a.message}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => { ack(a._id); navigate(`/admin/risk/${a.area}`); }} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">Open</button>
            <button type="button" onClick={() => ack(a._id)} className="rounded-lg border border-gray-300 bg-surface px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">Dismiss</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The admin console's shell: the SAME header and sidebar components as the
 * student app, with the admin sections. On small screens the sidebar is a
 * drawer (opened from the header).
 */
/** "ADMIN · RISK BOARD" (the pages' titles) as "Risk board", for the breadcrumb and the tab. */
const sentence = (text = '') => {
  const t = text.replace(/^ADMIN\s*·\s*/i, '').trim().toLowerCase();
  return t ? t[0].toUpperCase() + t.slice(1) : '';
};

export default function AdminLayout({ title, children, wide = false }) {
  const { admin, signOut } = useAdminAuth();
  const { signOut: signOutOfApp } = useAuth();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const page = sentence(title);
  useEffect(() => {
    document.title = [page, 'Admin', 'NOVARD-AI'].filter(Boolean).join(' · ');
  }, [page]);
  return (
    <div className="min-h-screen bg-canvas">
      <Navigationinner
        crumbs={[{ label: 'Admin', to: '/admin' }, ...(page && page !== 'Overview' ? [{ label: page }] : [])]}
        showBell={false}
        account={admin ? { ...admin, displayName: admin.name } : null}
        menuLinks={[{ label: 'Back to Novard-AI', icon: 'arrowLeft', onClick: () => navigate('/home') }]}
        onSignOut={() => {
          // One session: leaving the console signs out of the app too.
          signOut();
          signOutOfApp();
          navigate('/');
        }}
        onMenu={() => setDrawer(true)}
      />
      <Sidebar items={ADMIN_SECTIONS} subtitle="Admin console" matchPrefix drawerOpen={drawer} onDrawerClose={closeDrawer} />
      <main className="min-w-0 px-4 pb-16 pt-20 sm:px-6 lg:pl-[17rem] lg:pr-8">
        <div className={wide ? '' : 'mx-auto max-w-7xl'}>
          <AlertBanner />
          {children}
        </div>
      </main>
    </div>
  );
}
