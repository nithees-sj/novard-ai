import React, { useState } from 'react';
import { Select } from '../../components/ui/Field';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { ErrorNote, Loading, PageHeader, Section, usd, when } from '../../components/admin/ui';
import DataTable from '../../components/ui/DataTable';
import { Stat } from '../../components/profile/blocks';
import { ColumnChart } from '../../components/profile/charts';
import { Badge, Spinner, btn, fieldClass } from '../../components/learning/LearningUI';
import useAdminData from '../../lib/useAdminData';
import { adminPost } from '../../lib/adminApi';
import { errorMessage } from '../../lib/api';
import { STATUS_LABEL, STATUS_TONE } from '../../lib/reports';
import { useAdminAuth } from '../../AdminAuthContext';

const ROLE_TONE = { student: 'gray', admin: 'blue', superadmin: 'blue' };

/** Everyone with an account, searchable. */
export default function Users() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const query = Object.fromEntries(['q', 'status', 'role', 'page'].map((k) => [k, params.get(k)]).filter(([, v]) => v));
  const { data, error, loading, reload } = useAdminData('/api/admin/users', { ...query, limit: 25 });
  const navigate = useNavigate();
  const set = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };
  const page = Number(params.get('page') || 1);

  return (
    <AdminLayout title="ADMIN · USERS">
      <PageHeader title="Users" subtitle={data ? `${data.total} account(s)` : ''} />
      <ErrorNote error={error} onRetry={reload} />
      <Section className="mb-6">
        <form className="flex flex-wrap items-center gap-2 p-4" onSubmit={(e) => { e.preventDefault(); set('q', q.trim()); }}>
          <div className="min-w-[14rem] flex-1"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" className={`${fieldClass(false)} h-9`} aria-label="Search users" /></div>
          <Select value={params.get('status') || ''} onChange={(e) => set('status', e.target.value)} className="w-auto min-w-[9rem]" aria-label="Status">
            <option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option>
          </Select>
          <Select value={params.get('role') || ''} onChange={(e) => set('role', e.target.value)} className="w-auto min-w-[9rem]" aria-label="Role">
            <option value="">Everyone</option><option value="student">Students</option><option value="admins">Admins</option>
          </Select>
          <button type="submit" className={btn.primary}>Search</button>
        </form>
      </Section>
      {loading && !data ? <Loading /> : (
        <Section>
          <DataTable
            rows={data?.users || []}
            rowKey={(u) => u._id}
            onRowClick={(u) => navigate(`/admin/users/${u._id}`)}
            empty="No users match."
            columns={[
              { key: 'name', label: 'Name', render: (u) => <span className="font-semibold text-fg">{u.name || '(no name)'}</span> },
              { key: 'email', label: 'Email', render: (u) => <span className="font-mono text-xs text-fg-muted">{u.email}</span> },
              { key: 'role', label: 'Role', render: (u) => <Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge> },
              { key: 'status', label: 'Status', render: (u) => <Badge tone={u.status === 'suspended' ? 'red' : 'green'}>{u.status}</Badge> },
              { key: 'lastActiveDay', label: 'Last active', render: (u) => u.lastActiveDay || '–' },
              { key: 'createdAt', label: 'Joined', render: (u) => when(u.createdAt) },
            ]}
            footer={data && data.total > data.limit && (
              <div className="flex items-center justify-end gap-2 border-t border-line-subtle px-6 py-3 text-sm">
                <button type="button" disabled={page <= 1} onClick={() => set('page', String(page - 1))} className={`${btn.ghost} py-1`}>Previous</button>
                <span className="text-fg-subtle">Page {page} of {Math.ceil(data.total / data.limit)}</span>
                <button type="button" disabled={page * data.limit >= data.total} onClick={() => set('page', String(page + 1))} className={`${btn.ghost} py-1`}>Next</button>
              </div>
            )}
          />
        </Section>
      )}
    </AdminLayout>
  );
}

/** One account: activity, reports, AI usage and the actions on it. */
export function UserDetail() {
  const { id } = useParams();
  const { admin } = useAdminAuth();
  const { data, error, loading, reload } = useAdminData(`/api/admin/users/${id}`);
  const [email, setEmail] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const u = data?.user;
  const superadmin = admin?.role === 'superadmin';
  const isAdminAccount = ['admin', 'superadmin'].includes(u?.role);

  const act = async (path, body, done) => {
    setBusy(true);
    setNote(null);
    try {
      const out = await adminPost(`/api/admin/users/${id}/${path}`, body);
      setNote(done);
      if (path === 'reveal-email') setEmail(out.email);
      else await reload();
    } catch (err) {
      setNote(errorMessage(err, 'That did not work.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout title="ADMIN · USERS">
      <PageHeader title={u?.name || 'User'} subtitle={u ? `${u.role} · ${u.status}${u.createdAt ? ` · joined ${when(u.createdAt)}` : ''}` : ''} actions={<Link to="/admin/users" className={btn.secondary}>All users</Link>} />
      <ErrorNote error={error} onRetry={reload} />
      {note && <p className="mb-4 text-sm text-fg-muted" role="status">{note}</p>}
      {loading && !data ? <Loading /> : data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line-subtle ring-1 ring-line-subtle lg:grid-cols-4">
            <Stat label="Study time (30 days)" value={`${data.activity.studyMinutesLast30Days}m`} sub={`${data.activity.activeDays.length} active day(s)`} accent="bg-accent" />
            <Stat label="Items" value={data.activity.notes + data.activity.doubts + data.activity.videos + data.activity.learningPlans + data.activity.roadmaps} sub={`${data.activity.notes} notes · ${data.activity.doubts} doubts · ${data.activity.videos} videos`} accent="bg-accent" />
            <Stat label="AI requests today" value={data.ai.requestsToday} sub="counted against the daily quota" accent="bg-accent" />
            <Stat label="Reports" value={data.reports.length} sub={`${data.reports.filter((r) => ['open', 'in_progress'].includes(r.status)).length} open`} accent="bg-accent" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Section title="Account" className="lg:col-span-1">
              <div className="space-y-4 px-6 pb-6 text-sm">
                <p className="font-mono text-xs text-fg-muted">{email || u.email}</p>
                {!email && <button type="button" onClick={() => act('reveal-email', undefined, 'Email shown (recorded in the audit log).')} className="text-xs font-semibold text-accent-fg hover:underline">Show full email (audited)</button>}
                {u.status === 'suspended' && <p className="rounded-lg bg-danger-soft px-3 py-2 text-danger-fg">Suspended {when(u.suspendedAt)}{u.suspendedReason ? `: ${u.suspendedReason}` : ''}</p>}
                <div className="space-y-2 border-t border-line-subtle pt-4">
                  {u.status === 'active' ? (
                    (!isAdminAccount || superadmin) && (
                      <>
                        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className={`${fieldClass(false)} py-1.5`} aria-label="Suspension reason" />
                        <button type="button" disabled={busy} onClick={() => act('suspend', { reason }, 'Suspended: they are signed out on their next request.')} className={`${btn.secondary} w-full text-danger-fg`}>Suspend</button>
                      </>
                    )
                  ) : (
                    (!isAdminAccount || superadmin) && <button type="button" disabled={busy} onClick={() => act('reactivate', {}, 'Reactivated.')} className={`${btn.primary} w-full`}>Reactivate</button>
                  )}
                  <button type="button" disabled={busy} onClick={() => act('reset-quota', {}, "AI allowance reset: today's requests and this period's tokens.")} className={`${btn.secondary} w-full`}>{busy ? <Spinner /> : null}Reset AI quota and tokens</button>
                  {superadmin && (
                    <div className="flex gap-2 pt-2">
                      {['student', 'admin', 'superadmin'].filter((r) => r !== u.role).map((role) => (
                        <button key={role} type="button" disabled={busy} onClick={() => act('role', { role }, `Role changed to ${role}.`)} className={`${btn.secondary} flex-1`}>Make {role}</button>
                      ))}
                    </div>
                  )}
                  {!superadmin && isAdminAccount && <p className="text-xs text-fg-subtle">Only a superadmin can act on an admin account.</p>}
                </div>
              </div>
            </Section>

            <Section title="Study time" subtitle="Minutes per active day" className="lg:col-span-2">
              <div className="px-6 pb-6"><ColumnChart bars={[...data.activity.activeDays].reverse().map((d) => ({ label: d.day.slice(5), value: d.minutes, sub: d.day }))} unit="m" caption="Study minutes per day" emptyText="No study time recorded." /></div>
            </Section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Reports">
              <DataTable rowKey={(r) => r.ref} rows={data.reports} empty="No reports." columns={[
                { key: 'ref', label: 'Report', render: (r) => <Link to={`/admin/reports/${r.ref}`} className="font-semibold text-accent-fg hover:underline">{r.ref}</Link> },
                { key: 'area', label: 'Area' },
                { key: 'status', label: 'Status', render: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge> },
                { key: 'createdAt', label: 'Sent', render: (r) => when(r.createdAt) },
              ]} />
            </Section>
            <Section title="AI usage" subtitle="Last 30 days">
              <DataTable rowKey={(r) => r.feature} rows={data.ai.last30Days} empty="No AI use." columns={[
                { key: 'feature', label: 'Feature' },
                { key: 'calls', label: 'Calls', className: 'tabular-nums' },
                { key: 'tokens', label: 'Tokens', className: 'tabular-nums', render: (r) => r.tokens.toLocaleString() },
                { key: 'usd', label: 'Cost', render: (r) => usd(r.usd) },
              ]} />
            </Section>
            <Section title="Token limits" subtitle={`This ${data.ai.tokens.period}, per tool (set under Features & limits)`}>
              <DataTable rowKey={(r) => r.tool} rows={data.ai.tokens.tools} empty="No AI tokens used this period." columns={[
                { key: 'label', label: 'Tool' },
                { key: 'used', label: 'Used', className: 'tabular-nums', render: (r) => r.used.toLocaleString() },
                { key: 'limit', label: 'Limit', className: 'tabular-nums', render: (r) => (r.limit ? r.limit.toLocaleString() : 'Unlimited') },
                { key: 'reached', label: '', render: (r) => (r.reached ? <Badge tone="red">At limit</Badge> : null) },
              ]} />
            </Section>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
