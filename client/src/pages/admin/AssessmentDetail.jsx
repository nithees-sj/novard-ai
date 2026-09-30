import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { ErrorNote, LevelBadge, Loading, PageHeader, Section, pct, usd, when } from '../../components/admin/ui';
import { BarList, Ring } from '../../components/profile/charts';
import { Badge, Spinner, btn, fieldClass } from '../../components/learning/LearningUI';
import useAdminData from '../../lib/useAdminData';
import { adminPost } from '../../lib/adminApi';
import { errorMessage } from '../../lib/api';

const LANE_LABEL = { temporal: 'Trend', peers: 'Peers', history: 'History', semantic: 'What students say', telemetry: 'AI, YouTube & PDF' };
const VERDICT = { accept: ['green', 'Accepted'], revise: ['amber', 'Revised'], need_more_evidence: ['amber', 'Needed more evidence'] };
const STATUS = {
  auto_executed: ['blue', 'Done automatically'], awaiting_approval: ['amber', 'Awaiting approval'], approved: ['green', 'Approved'],
  dismissed: ['gray', 'Dismissed'], failed: ['red', 'Failed'], advice: ['gray', 'Advice'],
};

/** A cited id: reports open in the inbox, evidence ids jump to the evidence. */
function Cite({ id }) {
  if (id.startsWith('NV-')) return <Link to={`/admin/reports/${id}`} className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[11px] text-blue-700 hover:underline">{id}</Link>;
  if (id.startsWith('MC-') || id.startsWith('GW-')) return <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700" title={id.startsWith('MC-') ? 'A logged AI call' : 'A logged YouTube / PDF / sign-in call'}>{id.slice(0, 11)}</span>;
  return <a href={`#ev-${id}`} className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 hover:underline">{id}</a>;
}

function Recommendation({ rec, assessmentId, onChange }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const decide = async (decision) => {
    setBusy(decision);
    setError(null);
    try {
      await adminPost(`/api/admin/risk/assessments/${assessmentId}/recommendations/${rec.id}/${decision}`);
      onChange();
    } catch (err) {
      setError(errorMessage(err, 'That did not work.'));
    } finally {
      setBusy(null);
    }
  };
  const [tone, label] = STATUS[rec.status] || ['gray', rec.status];
  const open = ['awaiting_approval', 'advice'].includes(rec.status);
  return (
    <li className="rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold text-gray-900">{rec.action}</p>
        <Badge tone={tone}>{label}</Badge>
      </div>
      <p className="mt-1 text-xs text-gray-500">{rec.actionType.replace(/_/g, ' ')} · priority {rec.priority} · {rec.kind}{Object.keys(rec.params || {}).length ? ` · ${JSON.stringify(rec.params)}` : ''}</p>
      {rec.rationale && <p className="mt-2 text-sm text-gray-700">{rec.rationale}</p>}
      {rec.expectedEffect && <p className="mt-1 text-xs text-gray-500">Expected: {rec.expectedEffect}</p>}
      {rec.evidenceIds?.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{rec.evidenceIds.map((id) => <Cite key={id} id={id} />)}</div>}
      {rec.approvedBy && <p className="mt-2 text-xs text-gray-500">{label} by {rec.approvedBy} {when(rec.decidedAt)}</p>}
      {rec.error && <p className="mt-2 text-xs text-red-600">{rec.error}</p>}
      {open && (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => decide('approve')} disabled={Boolean(busy)} className={`${btn.primary} py-1.5`}>{busy === 'approve' ? <Spinner /> : null}{rec.status === 'advice' ? 'Mark done' : 'Approve and run'}</button>
          <button type="button" onClick={() => decide('dismiss')} disabled={Boolean(busy)} className={`${btn.secondary} py-1.5`}>Dismiss</button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </li>
  );
}

const WHATIF_FEATURES = [
  ['n_reports', 'report volume'], ['pct_urgent', 'urgent share'], ['pct_negative', 'negative share'], ['pct_unresolved', 'unanswered share'],
  ['ai_error_rate', 'AI error rate'], ['gateway_failure_rate', 'YouTube/PDF failures'], ['ai_report_rate', 'AI answers reported'],
];

function WhatIf({ assessmentId }) {
  const [feature, setFeature] = useState('n_reports');
  const [multiplier, setMultiplier] = useState('0.5');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const run = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      setResult(await adminPost(`/api/admin/risk/assessments/${assessmentId}/whatif`, { deltas: { [feature]: Number(multiplier) } }));
    } catch (err) {
      setError(errorMessage(err, 'The what-if failed.'));
    }
  };
  return (
    <form onSubmit={run} className="mt-4 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-4">
      <label className="text-xs text-gray-600">If<select value={feature} onChange={(e) => setFeature(e.target.value)} className={`${fieldClass(false)} mt-1 py-1.5`}>{WHATIF_FEATURES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label className="text-xs text-gray-600">were ×<input type="number" step="0.1" min="0" max="5" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} className={`${fieldClass(false)} mt-1 w-24 py-1.5`} /></label>
      <button type="submit" className={`${btn.secondary} py-2`}>Re-score</button>
      {result && <p className="w-full text-sm text-gray-700">Score {result.baseScore.toFixed(3)} → <strong>{result.newScore.toFixed(3)}</strong></p>}
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}

/** An investigation's findings, audit, outlook and recommendations. */
export default function AssessmentDetail() {
  const { id } = useParams();
  const { data, error, loading, reload } = useAdminData(`/api/admin/risk/assessments/${id}`);
  const [feedbackNote, setFeedbackNote] = useState(null);
  const a = data?.assessment;

  const sendFeedback = async (label) => {
    try {
      await adminPost(`/api/admin/risk/assessments/${id}/feedback`, { label });
      setFeedbackNote(label === 'accurate' ? 'Thanks: marked accurate.' : 'Thanks: marked not accurate.');
    } catch (err) {
      setFeedbackNote(errorMessage(err, 'Feedback was not saved.'));
    }
  };

  const [vTone, vLabel] = VERDICT[a?.verification?.verdict] || ['gray', 'Not verified'];
  const lanes = a ? [...new Set(a.evidence.map((e) => e.lane))] : [];

  return (
    <AdminLayout title="ADMIN · INVESTIGATION">
      <PageHeader
        title={a ? `Investigation: ${a.area}` : 'Investigation'}
        subtitle={a ? `${when(a.startedAt)} · ${a.trigger} · ${(a.outcome || a.status).replace(/_/g, ' ')} · ${usd(a.budget?.usdUsed)} · ${(a.budget?.tokensUsed || 0).toLocaleString()} tokens` : ''}
        actions={a && (
          <>
            <Link to={`/admin/runs/${a.runId}`} className={btn.secondary}>Run timeline</Link>
            <Link to={`/admin/risk/${a.area}`} className={btn.secondary}>Area</Link>
          </>
        )}
      />
      <ErrorNote error={error} onRetry={reload} />
      {loading && !a ? <Loading /> : a && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <LevelBadge level={a.risk?.level} />
            {a.risk && <span className="text-sm text-gray-600">score {Number(a.risk.score).toFixed(3)}</span>}
            {a.degraded && <Badge tone="amber">Degraded: some steps ran without a model</Badge>}
            {a.status === 'interrupted' && <Badge tone="red">Interrupted</Badge>}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Section title="Findings" subtitle="Each claim cites the evidence it rests on" className="lg:col-span-2">
              <ul className="space-y-3 px-6 pb-6">
                {a.hypotheses.map((h, i) => (
                  <li key={i} className="flex gap-4 rounded-lg border border-gray-200 p-4">
                    <Ring value={Math.round((h.confidence || 0) * 100)} size={56} color={h.degraded ? '#9ca3af' : '#0284c7'} label={`confidence ${Math.round((h.confidence || 0) * 100)}%`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900">{h.cause}</p>
                      {h.uncited && <p className="mt-1 text-xs text-amber-700">No valid citation: confidence capped at 35%.</p>}
                      <div className="mt-2 flex flex-wrap gap-1">{(h.evidenceIds || []).map((cid) => <Cite key={cid} id={cid} />)}</div>
                      {h.contradictingIds?.length > 0 && <p className="mt-2 text-xs text-gray-500">Contradicted by: {h.contradictingIds.map((cid) => <Cite key={cid} id={cid} />)}</p>}
                    </div>
                  </li>
                ))}
                {!a.hypotheses.length && <li className="text-sm text-gray-500">No findings: {a.outcome === 'no_investigation_needed' ? 'the area was not at HIGH risk, so nothing was investigated.' : 'the run did not finish.'}</li>}
              </ul>
            </Section>

            <Section title="Review" subtitle="A second model audits the findings">
              <div className="space-y-2 px-6 pb-6 text-sm">
                <Badge tone={vTone}>{vLabel}</Badge>
                {a.verification?.note && <p className="text-gray-700">{a.verification.note}</p>}
                {a.verification?.model && <p className="text-xs text-gray-500">Reviewer: {a.verification.model}</p>}
                {a.revisionCount > 0 && <p className="text-xs text-gray-500">Revised {a.revisionCount} time(s) after review.</p>}
                {(a.verification?.unsupported || []).map((u) => <p key={u} className="text-xs text-amber-700">Unsupported: {u}</p>)}
                <div className="border-t border-gray-100 pt-3">
                  <p className="mb-2 text-xs font-semibold text-gray-500">Was this accurate?</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => sendFeedback('accurate')} className={`${btn.secondary} py-1.5`}>Accurate</button>
                    <button type="button" onClick={() => sendFeedback('not_accurate')} className={`${btn.secondary} py-1.5`}>Not accurate</button>
                  </div>
                  {feedbackNote && <p className="mt-2 text-xs text-gray-600" role="status">{feedbackNote}</p>}
                </div>
              </div>
            </Section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Recommendations" subtitle="Only internal flags run by themselves; everything else waits for you">
              <ul className="space-y-3 px-6 pb-6">
                {a.recommendations.map((r) => <Recommendation key={r.id} rec={r} assessmentId={a._id} onChange={reload} />)}
                {!a.recommendations.length && <li className="text-sm text-gray-500">No recommendations.</li>}
              </ul>
            </Section>
            <Section title="Outlook" subtitle={a.predictions ? `${a.predictions.horizonDays}-day view · ${a.predictions.method}` : ''}>
              {a.predictions ? (
                <div className="px-6 pb-6">
                  <p className="mb-4 text-sm text-gray-700">Chance this becomes an incident: <strong>{pct(a.predictions.pIncident)}</strong> (score now {a.predictions.baseScore.toFixed(3)})</p>
                  <BarList rows={Object.entries(a.predictions.whatif).map(([label, v]) => ({ label: `If ${label}`, value: Math.round(v * 100), note: `score ${v.toFixed(3)}` }))} />
                  <WhatIf assessmentId={a._id} />
                </div>
              ) : <p className="px-6 pb-6 text-sm text-gray-500">No outlook for this run.</p>}
            </Section>
          </div>

          <Section title="Evidence" subtitle={a.supervisorReason ? `Supervisor: ${a.supervisorReason}` : ''}>
            <div className="space-y-5 px-6 pb-6">
              {lanes.map((lane) => (
                <div key={lane}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{LANE_LABEL[lane] || lane}</h3>
                  <ul className="space-y-2">
                    {a.evidence.filter((e) => e.lane === lane).map((e) => (
                      <li key={e.id} id={`ev-${e.id}`} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                        <span className="mr-2 font-mono text-[11px] text-gray-500">{e.id}</span>
                        <span className="text-gray-800">{e.summary}</span>
                        {e.citeIds?.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{e.citeIds.slice(0, 12).map((cid) => <Cite key={cid} id={cid} />)}</div>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {a.runErrors?.length > 0 && <p className="text-xs text-gray-500">Notes: {a.runErrors.join(' · ')}</p>}
            </div>
          </Section>
        </div>
      )}
    </AdminLayout>
  );
}
