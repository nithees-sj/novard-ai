import React, { useMemo, useState } from 'react';
import { Select } from '../../components/ui/Field';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { ErrorNote, LevelBadge, Loading, PageHeader, Section, when } from '../../components/admin/ui';
import DataTable from '../../components/ui/DataTable';
import { Badge, Field, Icon, Spinner, btn, fieldClass } from '../../components/learning/LearningUI';
import useAdminData from '../../lib/useAdminData';
import { adminFetch, adminPost } from '../../lib/adminApi';
import { errorMessage } from '../../lib/api';
import { STATUS_LABEL, STATUS_TONE } from '../../lib/reports';
import { useAdminAuth } from '../../AdminAuthContext';

const URGENCY_TONE = { high: 'red', medium: 'amber', low: 'gray' };
const INTENTS = ['bug', 'wrong_ai_answer', 'content_quality', 'feature_request', 'account', 'other'];

/** Resolve with a note the students see (each is notified once). */
function ResolveBox({ label, onResolve, busy }) {
  const [note, setNote] = useState('');
  return (
    <div className="flex flex-wrap items-end gap-2">
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What we did (students see this)" className={`${fieldClass(false)} min-w-[240px] flex-1 py-2`} aria-label="Resolution note" />
      <button type="button" onClick={() => onResolve(note)} disabled={busy} className={btn.primary}>{busy ? <Spinner /> : <Icon name="check" />}{label}</button>
    </div>
  );
}

/** The admins' inbox of student reports. */
export default function ReportsInbox() {
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(['area', 'status', 'urgency', 'intent', 'q', 'from', 'to'].map((k) => [k, params.get(k) || '']));
  const query = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  const { data, error, loading, reload } = useAdminData('/api/admin/reports', { ...query, limit: 100 });
  const status = useAdminData('/api/app-status');
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const navigate = useNavigate();

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
    setSelected(new Set());
  };
  const toggle = (ref) => setSelected((s) => { const n = new Set(s); if (n.has(ref)) n.delete(ref); else n.add(ref); return n; });

  const resolve = async (body, path = '/api/admin/reports/resolve') => {
    setBusy(true);
    setNote(null);
    try {
      const r = await adminPost(path, body);
      setNote(`Resolved ${r.resolved} report(s); ${r.students} student(s) notified.`);
      setSelected(new Set());
      await reload();
    } catch (err) {
      setNote(errorMessage(err, 'Resolving failed.'));
    } finally {
      setBusy(false);
    }
  };

  const areas = status.data?.reports?.areas || [];
  const rows = useMemo(() => data?.reports || [], [data]);
  const openRows = useMemo(() => rows.filter((r) => ['open', 'in_progress'].includes(r.status)), [rows]);

  return (
    <AdminLayout title="ADMIN · REPORTS">
      <PageHeader title="Reports inbox" subtitle={data ? `${data.total} report(s)` : 'What students told us'} />
      <ErrorNote error={error} onRetry={reload} />

      <Section className="mb-6">
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="f-area" label="Area">
            <Select id="f-area" value={filters.area} onChange={(e) => setFilter('area', e.target.value)} className="w-full">
              <option value="">All areas</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </Select>
          </Field>
          <Field id="f-status" label="Status">
            <Select id="f-status" value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className="w-full">
              <option value="">Any</option>
              <option value="open,in_progress">Open or in progress</option>
              {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field id="f-urgency" label="Urgency">
            <Select id="f-urgency" value={filters.urgency} onChange={(e) => setFilter('urgency', e.target.value)} className="w-full">
              <option value="">Any</option>
              {['high', 'medium', 'low'].map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
          </Field>
          <Field id="f-intent" label="Kind">
            <Select id="f-intent" value={filters.intent} onChange={(e) => setFilter('intent', e.target.value)} className="w-full">
              <option value="">Any</option>
              {INTENTS.map((i) => <option key={i} value={i}>{i.replace(/_/g, ' ')}</option>)}
            </Select>
          </Field>
          <Field id="f-q" label="Search"><input id="f-q" defaultValue={filters.q} onKeyDown={(e) => { if (e.key === 'Enter') setFilter('q', e.target.value.trim()); }} placeholder="Text, student or NV-…, then Enter" className={fieldClass(false)} /></Field>
          <Field id="f-from" label="From"><input id="f-from" type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} className={fieldClass(false)} /></Field>
          <Field id="f-to" label="To"><input id="f-to" type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} className={fieldClass(false)} /></Field>
        </div>
      </Section>

      {(selected.size > 0 || (filters.area && openRows.length > 0)) && (
        <Section className="mb-6">
          <div className="space-y-3 p-5">
            {selected.size > 0 && <><p className="text-sm font-semibold text-fg">{selected.size} selected</p><ResolveBox label="Resolve selected" busy={busy} onResolve={(n) => resolve({ refs: [...selected], note: n })} /></>}
            {filters.area && selected.size === 0 && <><p className="text-sm font-semibold text-fg">Every open report in {areas.find((a) => a.id === filters.area)?.label || filters.area}</p><ResolveBox label="Resolve all in area" busy={busy} onResolve={(n) => resolve({ note: n }, `/api/admin/areas/${filters.area}/resolve`)} /></>}
          </div>
        </Section>
      )}
      {note && <p className="mb-4 text-sm text-fg-muted" role="status">{note}</p>}

      {loading && !data ? <Loading /> : (
        <Section>
          <DataTable
            rows={rows}
            rowKey={(r) => r.ref}
            onRowClick={(r) => navigate(`/admin/reports/${r.ref}`)}
            empty="No reports match these filters."
            columns={[
              {
                key: 'sel', label: '', render: (r) => (['open', 'in_progress'].includes(r.status)
                  ? <input type="checkbox" checked={selected.has(r.ref)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(r.ref)} aria-label={`Select ${r.ref}`} />
                  : null),
              },
              { key: 'ref', label: 'Report', render: (r) => <span className="font-semibold text-fg">{r.ref}</span> },
              { key: 'text', label: 'What they said', render: (r) => <span className="line-clamp-2 max-w-md text-fg-muted">{r.text}</span> },
              { key: 'area', label: 'Area', render: (r) => r.areaLabel },
              { key: 'urgency', label: 'Urgency', render: (r) => (r.enrichment?.urgency ? <Badge tone={URGENCY_TONE[r.enrichment.urgency]}>{r.enrichment.urgency}</Badge> : <span className="text-xs text-fg-subtle">{r.enrichment?.status === 'done' ? '–' : 'triaging'}</span>) },
              { key: 'status', label: 'Status', render: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge> },
              { key: 'createdAt', label: 'Sent', render: (r) => when(r.createdAt) },
            ]}
          />
        </Section>
      )}
    </AdminLayout>
  );
}

function AdminAttachment({ reportRef, a }) {
  const [error, setError] = useState(null);
  const open = async () => {
    setError(null);
    const res = await adminFetch(`/api/admin/reports/${reportRef}/attachments/${a.n}`);
    if (!res.ok) { setError('Could not load it.'); return; }
    window.open(URL.createObjectURL(await res.blob()), '_blank', 'noopener');
  };
  return <span><button type="button" onClick={open} className={`${btn.secondary} py-1.5`}><Icon name={{ screenshot: 'image', voice: 'mic', pdf: 'paperclip' }[a.kind]} />{a.originalName || a.kind}</button>{error && <span className="ml-2 text-xs text-danger-fg">{error}</span>}</span>;
}

/** One report, everything about it, and every action on it. */
export function AdminReportDetail() {
  const { ref } = useParams();
  const { admin } = useAdminAuth();
  const { data: r, error, loading, reload, setData } = useAdminData(`/api/admin/reports/${ref}`);
  const risk = useAdminData(r ? `/api/admin/risk/areas/${r.area}` : null);
  const [email, setEmail] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const act = async (fn) => {
    setBusy(true);
    setActionError(null);
    try {
      const next = await fn();
      if (next?.ref) setData(next); else await reload();
    } catch (err) {
      setActionError(errorMessage(err, 'That did not work.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout title="ADMIN · REPORTS">
      <PageHeader title={ref} subtitle={r ? `${r.areaLabel} · ${r.studentName} · sent ${when(r.createdAt)}` : ''} actions={<Link to="/admin/reports" className={btn.secondary}>Inbox</Link>} />
      <ErrorNote error={error || actionError} onRetry={error ? reload : undefined} />
      {loading && !r ? <Loading /> : r && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Section title="The report">
              <div className="space-y-3 px-6 pb-6 text-sm">
                <p className="whitespace-pre-wrap text-fg">{r.text}</p>
                {r.transcript && <p className="rounded-lg bg-sunken px-3 py-2 text-fg-muted"><strong>Voice note:</strong> {r.transcript}</p>}
                {r.source?.excerpt && (
                  <div className="rounded-lg border border-line px-3 py-2">
                    <p className="mb-1 text-micro font-semibold uppercase tracking-wide text-fg-subtle">The AI output they reported{r.source.itemType ? ` (${r.source.itemType.replace(/_/g, ' ')})` : ''}{r.source.excerptVerified === false ? ' · as sent by the student, not found in the database' : ''}</p>
                    <p className="whitespace-pre-wrap text-fg-muted">{r.source.excerpt}</p>
                  </div>
                )}
                {r.pdfText && <details className="rounded-lg bg-sunken px-3 py-2 text-fg-muted"><summary className="cursor-pointer font-medium">Attached PDF text</summary><p className="mt-2 whitespace-pre-wrap">{r.pdfText}</p></details>}
                {r.attachments.length > 0 && <div className="flex flex-wrap gap-2">{r.attachments.map((a) => <AdminAttachment key={a.n} reportRef={r.ref} a={a} />)}</div>}
                {r.source?.page && <p className="text-xs text-fg-subtle">From {r.source.page}</p>}
              </div>
            </Section>

            <Section title="Conversation and notes" subtitle="Internal notes are for admins only; replies notify the student">
              <ol className="space-y-2 px-6">
                {r.notes.map((n, i) => (
                  <li key={i} className={`rounded-lg border px-3 py-2 text-sm ${n.internal ? 'border-warning/30 bg-warning-soft' : n.authorRole === 'student' ? 'border-line' : 'border-accent/20 bg-accent-soft/60'}`}>
                    <p className="mb-0.5 text-xs font-semibold text-fg-subtle">{n.authorRole === 'student' ? r.studentName : (n.authorName || n.author)}{n.internal ? ' · internal' : ''} · {when(n.at)}</p>
                    <p className="whitespace-pre-wrap text-fg">{n.body}</p>
                  </li>
                ))}
                {!r.notes.length && <li className="text-sm text-fg-subtle">No notes yet.</li>}
              </ol>
              <form className="space-y-2 p-6" onSubmit={(e) => { e.preventDefault(); if (noteText.trim()) act(() => adminPost(`/api/admin/reports/${r.ref}/notes`, { body: noteText.trim(), internal })).then(() => setNoteText('')); }}>
                <textarea rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} className={fieldClass(false)} placeholder={internal ? 'Internal note' : 'Reply to the student'} aria-label="Note" />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-fg-muted"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note</label>
                  <button type="submit" disabled={busy || !noteText.trim()} className={btn.primary}>{internal ? 'Add note' : 'Send reply'}</button>
                </div>
              </form>
            </Section>
          </div>

          <div className="space-y-6">
            <Section title="Status">
              <div className="space-y-4 px-6 pb-6 text-sm">
                <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                {['open', 'in_progress'].includes(r.status) && (
                  <>
                    {r.status === 'open' && <button type="button" onClick={() => act(() => adminPost(`/api/admin/reports/${r.ref}/status`, { status: 'in_progress' }))} className={`${btn.secondary} w-full`}>Mark in progress</button>}
                    <ResolveBox label="Resolve" busy={busy} onResolve={(n) => act(() => adminPost(`/api/admin/reports/${r.ref}/status`, { status: 'resolved', note: n }))} />
                    <button type="button" onClick={() => act(() => adminPost(`/api/admin/reports/${r.ref}/status`, { status: 'closed' }))} className="text-xs font-semibold text-fg-subtle hover:text-fg">Close without fixing</button>
                  </>
                )}
                <div className="border-t border-line-subtle pt-3">
                  <p className="text-xs text-fg-subtle">Assigned to {r.assignedTo || 'nobody'}</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => act(() => adminPost(`/api/admin/reports/${r.ref}/assign`, { assignee: admin?.email }))} className={`${btn.secondary} py-1.5`}>Assign to me</button>
                    {r.assignedTo && <button type="button" onClick={() => act(() => adminPost(`/api/admin/reports/${r.ref}/assign`, { assignee: null }))} className={`${btn.ghost} py-1.5`}>Unassign</button>}
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Student">
              <div className="space-y-2 px-6 pb-6 text-sm">
                <p className="font-medium text-fg">{r.studentName}</p>
                {email ? <p className="text-fg-muted">{email}</p> : <button type="button" onClick={() => act(async () => setEmail((await adminPost(`/api/admin/reports/${r.ref}/reporter-email`)).email))} className="text-xs font-semibold text-accent-fg hover:underline">Show email (recorded in the audit log)</button>}
              </div>
            </Section>

            <Section title="Triage" subtitle={r.enrichment?.model ? `by ${r.enrichment.model}` : ''}>
              <dl className="grid grid-cols-2 gap-2 px-6 pb-6 text-sm">
                <dt className="text-fg-subtle">Urgency</dt><dd>{r.enrichment?.urgency || '–'}</dd>
                <dt className="text-fg-subtle">Kind</dt><dd>{r.enrichment?.intent?.replace(/_/g, ' ') || '–'}</dd>
                <dt className="text-fg-subtle">Topic</dt><dd>{r.enrichment?.topic || '–'}</dd>
                <dt className="text-fg-subtle">Sentiment</dt><dd>{typeof r.enrichment?.sentiment === 'number' ? r.enrichment.sentiment.toFixed(2) : '–'}</dd>
                <dt className="text-fg-subtle">Repeat</dt><dd>{r.enrichment?.isRepeat ? 'yes' : 'no'}</dd>
                <dt className="text-fg-subtle">Routed by</dt><dd>{r.routedBy}</dd>
              </dl>
            </Section>

            <Section title="Area risk" right={<Link to={`/admin/risk/${r.area}`} className="text-xs font-semibold text-accent-fg hover:underline">Open</Link>}>
              <div className="px-6 pb-6 text-sm">
                {risk.data?.latest ? <p className="flex items-center gap-2"><LevelBadge level={risk.data.latest.level} /> score {risk.data.latest.score.toFixed(3)}</p> : <p className="text-fg-subtle">No score yet.</p>}
              </div>
            </Section>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
