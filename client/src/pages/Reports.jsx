import React, { useCallback, useEffect, useRef, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Badge, EmptyState, Icon, Spinner, btn, fieldClass, formatDate } from '../components/learning/LearningUI';
import { useReportProblem, REPORT_SENT_EVENT } from '../context/ReportContext';
import { useAppStatus } from '../context/AppStatusContext';
import { reportsApi, attachmentUrl, STATUS_LABEL, STATUS_TONE } from '../lib/reports';
import { errorMessage } from '../lib/api';
import { rowFocus } from '../components/ui/DataTable';
import { SkeletonRows } from '../components/ui/States';
import { PageHeader } from '../components/ui/Headers';

const StatusBadge = ({ status }) => <Badge tone={STATUS_TONE[status] || 'gray'}>{STATUS_LABEL[status] || status}</Badge>;

function ReportList({ reports, loading, onOpen }) {
  const openReport = useReportProblem();
  if (loading) {
    return <SkeletonRows rows={3} label="Loading your reports" />;
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
          <tr className="border-b border-line-subtle bg-sunken/60 text-left text-caption font-medium text-fg-subtle">
            <th className="px-6 py-2.5">Report</th>
            <th className="px-4 py-2.5">Area</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5">Sent</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-subtle">
          {reports.map((r) => (
            <tr
              key={r.ref}
              className={`cursor-pointer animate-view-in hover:bg-sunken/60 ${rowFocus}`}
              onClick={() => onOpen(r.ref)}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(r.ref); }}
            >
              <td className="px-6 py-3">
                <p className="num font-medium text-fg">{r.ref}</p>
                <p className="line-clamp-1 max-w-md text-xs text-fg-subtle">{r.text}</p>
              </td>
              <td className="px-4 py-3 text-fg-muted">{r.areaLabel}</td>
              <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
              <td className="px-4 py-3 text-fg-subtle whitespace-nowrap">{formatDate(r.createdAt)}</td>
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
      <button type="button" onClick={open} className={btn.secondary}><Icon name={icon} /> {attachment.originalName || attachment.kind}</button>
      {error && <p className="mt-1 text-xs text-danger-fg">{error}</p>}
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
      ? <div className="p-6"><p role="alert" className="text-sm text-danger-fg">{error}</p><button type="button" onClick={onBack} className={`${btn.ghost} mt-3`}>Back to my reports</button></div>
      : <div className="p-6"><SkeletonRows rows={3} label="Loading the report" /></div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="-ml-1 mb-2 inline-flex items-center gap-1 rounded px-1 py-0.5 text-small text-fg-subtle hover:bg-sunken hover:text-fg"><Icon name="arrowLeft" className="h-3.5 w-3.5" /> All my reports</button>
          <h2 className="num text-title font-semibold text-fg">{report.ref}</h2>
          <p className="text-sm text-fg-subtle">{report.areaLabel} · sent {formatDate(report.createdAt)}{report.resolvedAt ? ` · resolved ${formatDate(report.resolvedAt)}` : ''}</p>
        </div>
        <StatusBadge status={report.status} />
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-fg">What you reported</h3>
        <p className="whitespace-pre-wrap text-body text-fg">{report.text}</p>
        {report.transcript && <p className="rounded-lg bg-sunken px-4 py-3 text-body text-fg-muted"><strong className="text-fg">Voice note: </strong>{report.transcript}</p>}
        {report.source?.excerpt && (
          <div className="rounded-lg bg-sunken px-4 py-3">
            <p className="mb-1 text-caption font-medium text-fg-subtle">About this AI output</p>
            <p className="line-clamp-6 whitespace-pre-wrap text-sm text-fg-muted">{report.source.excerpt}</p>
          </div>
        )}
        {report.attachments?.length > 0 && (
          <div className="flex flex-wrap gap-2">{report.attachments.map((a) => <Attachment key={a.n} reportRef={report.ref} attachment={a} />)}</div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-fg">Conversation</h3>
        {report.notes.length === 0 && <p className="text-sm text-fg-subtle">No replies yet. The Novard team will reply here, and you will get a notification.</p>}
        <ol className="divide-y divide-line-subtle border-y border-line-subtle">
          {report.notes.map((n, i) => (
            <li key={i} className={`py-3 text-body ${n.authorRole === 'student' ? '' : 'pl-3 shadow-[inset_2px_0_0_rgb(var(--accent))]'}`}>
              <p className="mb-1 text-caption font-medium text-fg-subtle">{n.from === 'you' ? 'You' : 'Novard team'} · {formatDate(n.at)}</p>
              <p className="whitespace-pre-wrap text-fg">{n.body}</p>
            </li>
          ))}
        </ol>
        <form onSubmit={send} className="space-y-2">
          <label htmlFor="report-reply" className="text-sm font-semibold text-fg">
            {report.status === 'resolved' || report.status === 'closed' ? 'Still a problem? Reply to reopen it' : 'Add more detail'}
          </label>
          <textarea id="report-reply" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={4000} className={fieldClass(false)} placeholder="Write a message to the Novard team…" disabled={sending} />
          {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
          <button type="submit" disabled={sending || !reply.trim()} className={btn.primary}>{sending ? <><Spinner /> Sending…</> : 'Send'}</button>
        </form>
      </section>
    </div>
  );
}

/**
 * The report area for the page the student came from, when the page alone
 * says which part of the app it is (hub pages hold several tools, so they
 * are left for the student to choose).
 */
const PAGE_AREAS = { '/forum': 'forum', '/chatbot': 'agent', '/skill-unlocker': 'skill-unlocker', '/home': 'dashboard', '/profile': 'dashboard' };
const areaForPage = (page = '') => PAGE_AREAS[page.split('?')[0]] || null;

/** The student's problem reports: /reports (list) and /reports/:ref (one report). */
export default function Reports() {
  const { ref } = useParams();
  const navigate = useNavigate();
  const openReport = useReportProblem();
  const [data, setData] = useState({ reports: [], maxOpenPerArea: 2 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    reportsApi.mine().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load, ref]);

  // A report sent from here (or anywhere) appears in the list without a reload.
  useEffect(() => {
    const onSent = () => load({ quiet: true });
    window.addEventListener(REPORT_SENT_EVENT, onSent);
    return () => window.removeEventListener(REPORT_SENT_EVENT, onSent);
  }, [load]);

  // "Report a problem" from the sidebar or account menu lands here: once the
  // page has settled in, open the dialog, recording the page the student came
  // from. The request is cleared so Back or a refresh does not reopen it.
  const location = useLocation();
  const { status: appStatus } = useAppStatus();
  const newReport = location.state?.newReport;
  const from = location.state?.from;
  const pendingOpen = useRef(null);
  useEffect(() => {
    if (!newReport) return;
    clearTimeout(pendingOpen.current);
    const guess = areaForPage(from);
    // Only pre-select an area that is currently offered (areas can be merged or renamed).
    const area = guess && (appStatus.reports?.areas || []).some((a) => a.id === guess) ? guess : null;
    pendingOpen.current = setTimeout(() => openReport(from ? { ...(area ? { area } : {}), source: { page: from } } : {}), 380);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);
  useEffect(() => () => clearTimeout(pendingOpen.current), []);

  return (
    <AppShell page="reports">
          <div className="space-y-6">
            <PageHeader
              className="mb-0"
              title="My reports"
              description={`Problems you told us about, and what we did. You can have up to ${data.maxOpenPerArea} open reports per area.`}
              actions={<button type="button" onClick={() => openReport({})} className={btn.primary}><Icon name="flag" /> Report a problem</button>}
            />
            <div className="overflow-hidden rounded-xl bg-raised ring-1 ring-line-subtle">
              {ref
                ? <ReportDetail reportRef={ref} onBack={() => navigate('/reports')} />
                : <ReportList reports={data.reports} loading={loading} onOpen={(r) => navigate(`/reports/${r}`)} />}
            </div>
            {!ref && data.reports.length > 0 && (
              <p className="text-center text-small text-fg-subtle">Something else? <Link to="#" onClick={(e) => { e.preventDefault(); openReport({}); }} className="text-accent-fg hover:underline">Send another report</Link></p>
            )}
          </div>
    </AppShell>
  );
}
