import React, { useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { ErrorNote, PageHeader, Section, when } from '../../components/admin/ui';
import DataTable from '../../components/ui/DataTable';
import { btn, fieldClass } from '../../components/learning/LearningUI';
import useAdminData from '../../lib/useAdminData';

const short = (v) => {
  if (v === null || v === undefined) return '–';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 160 ? `${s.slice(0, 160)}…` : s;
};

/** Every admin change: who, what, before and after. Read-only. */
export default function AuditLog() {
  const [filters, setFilters] = useState({ adminId: '', action: '', from: '', to: '' });
  const [applied, setApplied] = useState({});
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAdminData('/api/admin/audit-log', { ...applied, page, limit: 50 });
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <AdminLayout title="ADMIN · AUDIT LOG">
      <PageHeader title="Audit log" subtitle="Every change made from the console, by the admin assistant or by approving a recommendation. It cannot be edited." />
      <Section className="mb-6">
        <form className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))); }}>
          <input value={filters.adminId} onChange={set('adminId')} placeholder="Admin email" className={fieldClass(false)} aria-label="Admin" />
          <input value={filters.action} onChange={set('action')} placeholder="Action, e.g. setting or report.resolve" className={fieldClass(false)} aria-label="Action" />
          <input type="date" value={filters.from} onChange={set('from')} className={fieldClass(false)} aria-label="From" />
          <input type="date" value={filters.to} onChange={set('to')} className={fieldClass(false)} aria-label="To" />
          <button type="submit" className={btn.primary}>Filter</button>
        </form>
      </Section>
      <ErrorNote error={error} onRetry={reload} />
      <Section>
        <DataTable
          rows={data?.entries || []}
          rowKey={(e) => e._id}
          empty={loading ? 'Loading…' : 'No entries.'}
          columns={[
            { key: 'createdAt', label: 'When', render: (e) => when(e.createdAt) },
            { key: 'adminId', label: 'Who', render: (e) => <span className="text-xs">{e.adminId}{e.adminRole && e.adminRole !== e.adminId ? ` (${e.adminRole})` : ''}</span> },
            { key: 'action', label: 'Action', render: (e) => <span className="font-mono text-xs">{e.action}</span> },
            { key: 'target', label: 'Target', render: (e) => <span className="text-xs">{e.target ? `${e.target.type}: ${e.target.id}` : '–'}</span> },
            { key: 'change', label: 'Before → after', render: (e) => <span className="block max-w-md break-words font-mono text-micro text-fg-muted">{short(e.before)} → {short(e.after)}</span> },
          ]}
          footer={data && data.total > data.limit && (
            <div className="flex items-center justify-end gap-2 border-t border-line-subtle px-6 py-3 text-sm">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={`${btn.ghost} py-1`}>Newer</button>
              <span className="text-fg-subtle">Page {page} of {Math.ceil(data.total / data.limit)}</span>
              <button type="button" disabled={page * data.limit >= data.total} onClick={() => setPage((p) => p + 1)} className={`${btn.ghost} py-1`}>Older</button>
            </div>
          )}
        />
      </Section>
    </AdminLayout>
  );
}
