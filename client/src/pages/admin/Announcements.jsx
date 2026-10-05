import React, { useState } from 'react';
import { Select } from '../../components/ui/Field';
import AdminLayout from '../../components/admin/AdminLayout';
import { ErrorNote, PageHeader, Section, when } from '../../components/admin/ui';
import DataTable from '../../components/ui/DataTable';
import { Field, Spinner, btn, fieldClass } from '../../components/learning/LearningUI';
import useAdminData from '../../lib/useAdminData';
import { adminPost } from '../../lib/adminApi';
import { errorMessage } from '../../lib/api';

/** Tell students something: under their bell, and optionally as a dashboard banner. */
export default function Announcements() {
  const history = useAdminData('/api/admin/announcements');
  const status = useAdminData('/api/app-status');
  const [form, setForm] = useState({ audience: 'all', area: '', title: '', body: '', banner: false, bannerUntil: '' });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      const r = await adminPost('/api/admin/announcements', { ...form, bannerUntil: form.bannerUntil || null });
      setNote({ ok: true, text: `Sent to ${r.sent} student(s)${r.banner ? ', and shown as the dashboard banner' : ''}.` });
      setForm((f) => ({ ...f, title: '', body: '' }));
      history.reload();
    } catch (err) {
      setNote({ ok: false, text: errorMessage(err, 'Not sent.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout title="ADMIN · ANNOUNCEMENTS">
      <PageHeader title="Announcements" subtitle="Students see these under the bell. Sending is audited." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="New announcement">
          <form onSubmit={send} className="space-y-4 px-6 pb-6">
            <Field id="a-audience" label="Who">
              <Select id="a-audience" value={form.audience} onChange={set('audience')} className="w-full">
                <option value="all">All students</option>
                <option value="area_reporters">Students who recently reported a problem in one area</option>
              </Select>
            </Field>
            {form.audience === 'area_reporters' && (
              <Field id="a-area" label="Area" hint="Everyone who reported in this area in the last 30 days, e.g. after a fix.">
                <Select id="a-area" value={form.area} onChange={set('area')} className="w-full" required>
                  <option value="">Choose…</option>
                  {(status.data?.reports?.areas || []).map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </Select>
              </Field>
            )}
            <Field id="a-title" label="Title" required count={form.title.length} max={120}><input id="a-title" value={form.title} onChange={set('title')} className={fieldClass(false)} /></Field>
            <Field id="a-body" label="Message" optional count={form.body.length} max={1000}><textarea id="a-body" rows={4} value={form.body} onChange={set('body')} className={fieldClass(false)} /></Field>
            <label className="flex items-center gap-2 text-sm text-fg-muted"><input type="checkbox" checked={form.banner} onChange={set('banner')} /> Also show it as the dashboard banner</label>
            {form.banner && <Field id="a-until" label="Banner until" optional><input id="a-until" type="datetime-local" value={form.bannerUntil} onChange={set('bannerUntil')} className={fieldClass(false)} /></Field>}
            {note && <p role={note.ok ? 'status' : 'alert'} className={`text-sm ${note.ok ? 'text-success-fg' : 'text-danger-fg'}`}>{note.text}</p>}
            <button type="submit" disabled={busy || !form.title.trim()} className={btn.primary}>{busy ? <Spinner /> : null}Send</button>
          </form>
        </Section>
        <Section title="Sent">
          <ErrorNote error={history.error} onRetry={history.reload} />
          <DataTable
            rows={history.data?.announcements || []}
            rowKey={(a) => a._id}
            empty="Nothing sent yet."
            columns={[
              { key: 'title', label: 'Title', render: (a) => <span className="font-semibold text-fg">{a.title}</span> },
              { key: 'sent', label: 'Sent to', className: 'tabular-nums' },
              { key: 'read', label: 'Read', className: 'tabular-nums' },
              { key: 'createdAt', label: 'When', render: (a) => when(a.createdAt) },
            ]}
          />
        </Section>
      </div>
    </AdminLayout>
  );
}
