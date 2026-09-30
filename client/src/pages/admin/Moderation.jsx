import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { ErrorNote, Loading, PageHeader, Section, when } from '../../components/admin/ui';
import DataTable from '../../components/ui/DataTable';
import MarkdownView from '../../components/MarkdownView';
import { Badge, TabBar, btn, fieldClass } from '../../components/learning/LearningUI';
import useAdminData from '../../lib/useAdminData';
import { adminDelete, adminPut } from '../../lib/adminApi';
import { errorMessage } from '../../lib/api';

function Thread({ issueId, onClose, onChanged }) {
  const { data, error, loading, reload } = useAdminData(`/api/admin/forum/issues/${issueId}`);
  const [note, setNote] = useState(null);
  const run = async (fn, done) => {
    setNote(null);
    try {
      await fn();
      setNote(done);
      await reload();
      onChanged();
    } catch (err) {
      setNote(errorMessage(err, 'That did not work.'));
    }
  };
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const { issue, comments } = data;
  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onClose} className="mb-2 text-xs font-semibold text-blue-600 hover:underline">← All discussions</button>
          <h2 className="text-lg font-bold text-gray-900">{issue.title}</h2>
          <p className="text-xs text-gray-500">{issue.userName} · {when(issue.createdAt)} · {issue.status}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {issue.status === 'closed'
            ? <button type="button" onClick={() => run(() => adminPut(`/api/admin/forum/issues/${issueId}/status`, { status: 'open' }), 'Reopened.')} className={btn.secondary}>Reopen</button>
            : <button type="button" onClick={() => run(() => adminPut(`/api/admin/forum/issues/${issueId}/status`, { status: 'closed' }), 'Closed.')} className={btn.secondary}>Close</button>}
          <button type="button" onClick={() => { if (window.confirm('Delete this discussion and all its replies?')) run(() => adminDelete(`/api/admin/forum/issues/${issueId}`).then(onClose), 'Deleted.'); }} className={`${btn.secondary} text-red-700`}>Delete discussion</button>
        </div>
      </div>
      {note && <p className="text-sm text-gray-700" role="status">{note}</p>}
      <p className="whitespace-pre-wrap rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-800">{issue.description}</p>
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c._id} className={`rounded-lg border px-4 py-3 text-sm ${c.hidden ? 'border-dashed border-gray-300 bg-gray-50 opacity-70' : c.isAI ? 'border-blue-100 bg-blue-50/60' : 'border-gray-200'}`}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-gray-600">{c.isAI ? 'AI Assistant' : c.userName} · {when(c.createdAt)} {c.hidden && <Badge>hidden from students</Badge>}</span>
              <span className="flex gap-2">
                <button type="button" onClick={() => run(() => adminPut(`/api/admin/forum/comments/${c._id}/hidden`, { hidden: !c.hidden }), c.hidden ? 'Shown again.' : 'Hidden from students.')} className="text-xs font-semibold text-blue-600 hover:underline">{c.hidden ? 'Show' : 'Hide'}</button>
                <button type="button" onClick={() => { if (window.confirm('Delete this reply (and replies to it)?')) run(() => adminDelete(`/api/admin/forum/comments/${c._id}`), 'Reply deleted.'); }} className="text-xs font-semibold text-red-600 hover:underline">Delete</button>
              </span>
            </div>
            {c.isAI ? <MarkdownView content={c.content} /> : <p className="whitespace-pre-wrap text-gray-800">{c.content}</p>}
          </li>
        ))}
        {!comments.length && <li className="text-sm text-gray-500">No replies.</li>}
      </ul>
    </div>
  );
}

/** The forum, and the AI messages students reported. */
export default function Moderation() {
  const [tab, setTab] = useState('forum');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);
  const forum = useAdminData(tab === 'forum' ? '/api/admin/forum/issues' : null, { q: search, limit: 50, status: 'all', sort: 'newest' });
  const flagged = useAdminData(tab === 'flagged' ? '/api/admin/moderation/flagged' : null);

  return (
    <AdminLayout title="ADMIN · MODERATION">
      <PageHeader title="Moderation" subtitle="Forum discussions and AI answers students flagged. Every action is audited." />
      <div className="mb-4"><TabBar tabs={[{ id: 'forum', label: 'AI Forum', icon: 'chat' }, { id: 'flagged', label: 'Flagged AI messages', icon: 'flag' }]} active={tab} onChange={(t) => { setTab(t); setOpen(null); }} /></div>
      {tab === 'forum' && (
        <Section>
          {open ? <Thread issueId={open} onClose={() => setOpen(null)} onChanged={forum.reload} /> : (
            <>
              <form className="flex gap-2 p-5" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search discussions" className={fieldClass(false)} aria-label="Search discussions" />
                <button type="submit" className={btn.primary}>Search</button>
              </form>
              <ErrorNote error={forum.error} onRetry={forum.reload} />
              <DataTable
                rows={forum.data?.issues || []}
                rowKey={(i) => i.issueId}
                onRowClick={(i) => setOpen(i.issueId)}
                empty={forum.loading ? 'Loading…' : 'No discussions.'}
                columns={[
                  { key: 'title', label: 'Discussion', render: (i) => <span className="font-semibold text-gray-900">{i.title}</span> },
                  { key: 'userName', label: 'By' },
                  { key: 'status', label: 'Status' },
                  { key: 'commentsCount', label: 'Replies', className: 'tabular-nums' },
                  { key: 'createdAt', label: 'Posted', render: (i) => when(i.createdAt) },
                ]}
              />
            </>
          )}
        </Section>
      )}
      {tab === 'flagged' && (
        <Section>
          <ErrorNote error={flagged.error} onRetry={flagged.reload} />
          <ul className="divide-y divide-gray-100">
            {(flagged.data?.flagged || []).map((f) => (
              <li key={f.ref} className="space-y-2 px-6 py-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to={`/admin/reports/${f.ref}`} className="font-semibold text-blue-600 hover:underline">{f.ref}</Link>
                  <span className="text-xs text-gray-500">{f.areaLabel} · {f.itemType ? f.itemType.replace(/_/g, ' ') : 'AI output'} · {f.status} · {when(f.createdAt)}</span>
                </div>
                <p className="text-gray-800"><strong>Student:</strong> {f.complaint}</p>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">The AI said{f.verified ? '' : ' (as sent by the student)'}</p>
                  <p className="line-clamp-6 whitespace-pre-wrap text-gray-700">{f.excerpt}</p>
                </div>
              </li>
            ))}
            {!flagged.loading && !(flagged.data?.flagged || []).length && <li className="px-6 py-10 text-center text-sm text-gray-500">No AI messages have been reported.</li>}
          </ul>
        </Section>
      )}
    </AdminLayout>
  );
}
