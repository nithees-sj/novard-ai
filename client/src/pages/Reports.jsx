import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Navigationinner } from '../components/navigationinner';
import Sidebar from '../components/Sidebar';
import { Badge, EmptyState, Icon, Spinner, btn, fieldClass, formatDate } from '../components/learning/LearningUI';
import { useReportProblem } from '../context/ReportContext';
import { reportsApi, attachmentUrl, STATUS_LABEL, STATUS_TONE } from '../lib/reports';
import { errorMessage } from '../lib/api';
import { rowFocus } from '../components/ui/DataTable';

const StatusBadge = ({ status }) => <Badge tone={STATUS_TONE[status] || 'gray'}>{STATUS_LABEL[status] || status}</Badge>;

function ReportList({ reports, loading, onOpen }) {
  const openReport = useReportProblem();
  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-gray-500"><Spinner className="mr-2 h-5 w-5 text-blue-600" /> Loading your reports…</div>;
  }
  if (!reports.length) {
    return (
      <EmptyState
        icon="flag"
        title="No reports yet"
        text="If something in Novard-AI does not work, or an AI answer is wrong, tell us. You can report from any AI answer too."
        action={<button type="button" onClick={() => openReport({})} className={btn.primary}><Icon name="flag" /> Report a problem</button>}
      />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-gray-100 bg-gray-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <th className="px-6 py-2.5">Report</th>
            <th className="px-4 py-2.5">Area</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5">Sent</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {reports.map((r) => (
            <tr
              key={r.ref}
              className={`cursor-pointer hover:bg-gray-50/60 ${rowFocus}`}
              onClick={() => onOpen(r.ref)}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(r.ref); }}
            >
              <td className="px-6 py-3">
                <p className="font-semibold text-gray-900">{r.ref}</p>
                <p className="line-clamp-1 max-w-md text-xs text-gray-500">{r.text}</p>
              </td>
              <td className="px-4 py-3 text-gray-700">{r.areaLabel}</td>
              <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Attachment({ reportRef, attachment }) {
  const [error, setError] = useState('');
  const open = async () => {
    setError('');
    try {
      window.open(await attachmentUrl(reportRef, attachment.n), '_blank', 'noopener');
    } catch (e) {
      setError(e.message);
    }
  };
  const icon = { screenshot: 'image', voice: 'mic', pdf: 'paperclip' }[attachment.kind] || 'paperclip';
  return (
    <div>
      <button type="button" onClick={open} className={`${btn.secondary} py-1.5`}><Icon name={icon} /> {attachment.originalName || attachment.kind}</button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ReportDetail({ reportRef, onBack }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setReport(null);
    setError('');
    reportsApi.get(reportRef).then(setReport).catch((e) => setError(errorMessage(e, 'This report could not be loaded.')));
  }, [reportRef]);

  const send = async (e) => {
    e.preventDefault();
    if (reply.trim().length < 1) return;
    setSending(true);
    setError('');
    try {
      setReport(await reportsApi.reply(reportRef, reply.trim()));
      setReply('');
    } catch (err) {
      setError(errorMessage(err, 'Your message could not be sent.'));
    } finally {
      setSending(false);
    }
  };

  if (!report) {
    return error
      ? <div className="p-6"><p role="alert" className="text-sm text-red-600">{error}</p><button type="button" onClick={onBack} className={`${btn.ghost} mt-3`}>Back to my reports</button></div>
      : <div className="flex items-center justify-center py-16 text-sm text-gray-500"><Spinner className="mr-2 h-5 w-5 text-blue-600" /> Loading…</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="mb-2 text-xs font-semibold text-blue-600 hover:underline">← All my reports</button>
          <h2 className="text-xl font-bold text-gray-900">{report.ref}</h2>
          <p className="text-sm text-gray-500">{report.areaLabel} · sent {formatDate(report.createdAt)}{report.resolvedAt ? ` · resolved ${formatDate(report.resolvedAt)}` : ''}</p>
        </div>
        <StatusBadge status={report.status} />
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">What you reported</h3>
        <p className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-surface px-4 py-3 text-sm text-gray-800">{report.text}</p>
        {report.transcript && <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700"><strong className="text-gray-900">Voice note: </strong>{report.transcript}</p>}
        {report.source?.excerpt && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">About this AI output</p>
            <p className="line-clamp-6 whitespace-pre-wrap text-sm text-gray-700">{report.source.excerpt}</p>
          </div>
        )}
        {report.attachments?.length > 0 && (
          <div className="flex flex-wrap gap-2">{report.attachments.map((a) => <Attachment key={a.n} reportRef={report.ref} attachment={a} />)}</div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Conversation</h3>
        {report.notes.length === 0 && <p className="text-sm text-gray-500">No replies yet. The Novard team will reply here, and you will get a notification.</p>}
        <ol className="space-y-3">
          {report.notes.map((n, i) => (
            <li key={i} className={`rounded-lg border px-4 py-3 text-sm ${n.authorRole === 'student' ? 'border-gray-200 bg-surface' : 'border-blue-100 bg-blue-50/60'}`}>
              <p className="mb-1 text-xs font-semibold text-gray-500">{n.from === 'you' ? 'You' : 'Novard team'} · {formatDate(n.at)}</p>
              <p className="whitespace-pre-wrap text-gray-800">{n.body}</p>
            </li>
          ))}
        </ol>
        <form onSubmit={send} className="space-y-2">
          <label htmlFor="report-reply" className="text-sm font-semibold text-gray-900">
            {report.status === 'resolved' || report.status === 'closed' ? 'Still a problem? Reply to reopen it' : 'Add more detail'}
          </label>
          <textarea id="report-reply" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={4000} className={fieldClass(false)} placeholder="Write a message to the Novard team…" disabled={sending} />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={sending || !reply.trim()} className={btn.primary}>{sending ? <><Spinner /> Sending…</> : 'Send'}</button>
        </form>
      </section>
    </div>
  );
}

/** The student's problem reports: /reports (list) and /reports/:ref (one report). */
export default function Reports() {
  const { ref } = useParams();
  const navigate = useNavigate();
  const openReport = useReportProblem();
  const [data, setData] = useState({ reports: [], maxOpenPerArea: 2 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    reportsApi.mine().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load, ref]);

  return (
    <>
      <Navigationinner title="MY REPORTS" hideLogo={true} />
      <div className="flex min-h-screen bg-gray-50 pt-14">
        <Sidebar />
        <div className="ml-64 flex-1 p-8">
          <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">My reports</h1>
                <p className="text-sm text-gray-500">Problems you told us about, and what we did. You can have up to {data.maxOpenPerArea} open reports per area.</p>
              </div>
              <button type="button" onClick={() => openReport({})} className={btn.primary}><Icon name="flag" /> Report a problem</button>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-surface">
              {ref
                ? <ReportDetail reportRef={ref} onBack={() => navigate('/reports')} />
                : <ReportList reports={data.reports} loading={loading} onOpen={(r) => navigate(`/reports/${r}`)} />}
            </div>
            {!ref && data.reports.length > 0 && (
              <p className="text-center text-xs text-gray-500">Something else? <Link to="#" onClick={(e) => { e.preventDefault(); openReport({}); }} className="text-blue-600 hover:underline">Send another report</Link></p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
