const audit = require('../../services/auditService');
const { rescanAll } = require('../../services/earlyWarning/rescan');

/** POST /api/admin/risk/rescan {full?} -> the rescan summary. */
exports.rescan = async (req, res) => {
  const result = await rescanAll({ trigger: 'admin', full: req.body?.full === true });
  await audit.record({ actor: req.admin, action: 'risk.rescan', target: { type: 'risk', id: 'all' }, after: { full: req.body?.full === true, alerts: result.alerts?.length ?? 0, skipped: Boolean(result.skipped) }, ip: req.ip });
  res.json(result);
};

const { startAssessment } = require('../../services/earlyWarning/graph/runner');
const recommendations = require('../../services/earlyWarning/recommendations');
const runs = require('../../services/earlyWarning/runs');
const { GRAPH } = require('../../config/earlyWarning');

/** POST /api/admin/risk/areas/:area/assess -> 202 {runId}. The run continues in the background. */
exports.assess = async (req, res) => {
  const { runId, assessmentId, done } = await startAssessment({ area: req.params.area, trigger: 'admin', actor: req.admin, ip: req.ip });
  done.catch(() => {}); // failures are recorded on the assessment
  res.status(202).json({ runId, assessmentId });
};

/** GET /api/admin/risk/assessments/:id -> {assessment, feedback} */
exports.getAssessment = async (req, res) => {
  res.json(await runs.getAssessment(req.params.id));
};

exports.approve = async (req, res) => {
  res.json(await recommendations.approve(req.admin, req.params.id, req.params.recId, { ip: req.ip }));
};

exports.dismiss = async (req, res) => {
  res.json(await recommendations.dismiss(req.admin, req.params.id, req.params.recId, { ip: req.ip }));
};

exports.feedback = async (req, res) => {
  res.json(await runs.feedback(req.admin, req.params.id, req.body || {}, { ip: req.ip }));
};

exports.whatIf = async (req, res) => {
  res.json(await runs.whatIf(req.params.id, req.body?.deltas));
};

/** GET /api/admin/risk/runs?area&limit */
exports.listRuns = async (req, res) => {
  res.json(await runs.listRuns(req.query));
};

/** GET /api/admin/risk/runs/:id -> {assessment, steps, calls} */
exports.getRun = async (req, res) => {
  const trace = await runs.runTrace(req.params.id);
  if (!trace.assessment) return res.status(404).json({ error: 'Run not found', code: 'NOT_FOUND' });
  return res.json(trace);
};

/**
 * GET /api/admin/risk/runs/:id/stream (SSE, the same framing as /api/agent/chat).
 * Tails the run's steps and model calls from MongoDB every 500 ms, so it works
 * whichever Cloud Run instance runs the graph. Events: snapshot, step, call, done.
 */
exports.streamRun = async (req, res) => {
  const first = await runs.runTrace(req.params.id);
  if (!first.assessment) return res.status(404).json({ error: 'Run not found', code: 'NOT_FOUND' });
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  let closed = false;
  req.on('close', () => { closed = true; });

  let afterSeq = 0;
  let afterCallId;
  const emit = (trace) => {
    trace.steps.forEach((s) => { send('step', s); afterSeq = Math.max(afterSeq, s.seq); });
    trace.calls.forEach((c) => { send('call', c); afterCallId = c._id; });
  };
  send('snapshot', { runId: first.assessment.runId, area: first.assessment.area, status: first.assessment.status, startedAt: first.assessment.startedAt });
  emit(first);

  const deadline = Date.now() + GRAPH.streamMaxMinutes * 60 * 1000;
  let trace = first;
  while (!closed && trace.assessment.status === 'running' && Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => { setTimeout(r, 500); });
    // eslint-disable-next-line no-await-in-loop
    trace = await runs.runTrace(req.params.id, { afterSeq, afterCallId });
    emit(trace);
  }
  if (!closed) {
    const a = trace.assessment;
    send('done', { status: a.status, outcome: a.outcome, degraded: a.degraded, usd: a.budget?.usdUsed || 0, tokens: a.budget?.tokensUsed || 0, assessmentId: a._id });
    res.end();
  }
  return undefined;
};
