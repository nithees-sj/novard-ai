const crypto = require('crypto');
const RiskAssessment = require('../../../models/riskAssessment');
const AreaFeature = require('../../../models/areaFeature');
const ModelCall = require('../../../models/modelCall');
const settings = require('../../settingsService');
const audit = require('../../auditService');
const { resolveArea, areaLabel } = require('../../reportAreas');
const { callJson } = require('../../../ai/modelGateway');
const { executeAuto } = require('../recommendations');
const { buildGraph } = require('./build');
const { forget, dropSlots } = require('./trace');
const { GRAPH } = require('../../../config/earlyWarning');
const { badRequest } = require('../../../utils/httpError');
const logger = require('../../../utils/logger');

/**
 * Run an investigation (EWDI build.py run_assessment). startAssessment()
 * returns at once with the run id (the console follows the live view);
 * runAssessment() waits for the result (the admin assistant, schedules, tests).
 */

const ALERT = ['HIGH', 'CRITICAL'];

/** The exact cost of a run, from its logged model calls. */
async function runCost(runId) {
  const [row] = await ModelCall.aggregate([
    { $match: { runId } },
    { $group: { _id: null, usd: { $sum: '$usd' }, tokensIn: { $sum: '$tokensIn' }, tokensOut: { $sum: '$tokensOut' }, calls: { $sum: 1 } } },
  ]);
  return row ? { usd: row.usd, tokens: row.tokensIn + row.tokensOut, tokensIn: row.tokensIn, tokensOut: row.tokensOut, calls: row.calls } : { usd: 0, tokens: 0, tokensIn: 0, tokensOut: 0, calls: 0 };
}

function outcomeOf(final) {
  if (!ALERT.includes(final.risk?.level)) return 'no_investigation_needed';
  const hyps = final.hypotheses || [];
  return hyps.length && hyps.some((h) => !h.degraded) ? 'investigated' : 'investigation_incomplete';
}

async function finish(assessment, final, failure) {
  const cost = await runCost(assessment.runId);
  const hyps = final.hypotheses || [];
  const update = {
    status: failure ? 'error' : 'done',
    outcome: failure ? 'investigation_incomplete' : outcomeOf(final),
    risk: final.risk || null,
    riskObjectId: final.riskObjectId || null,
    riskState: final.riskState || null,
    lanesDone: [...new Set(final.lanesDone || [])],
    supervisorReason: final.supervisorReason || '',
    evidence: final.evidence || [],
    hypotheses: hyps,
    verification: final.verification || null,
    revisionCount: final.revisionCount || 0,
    predictions: final.prediction || null,
    recommendations: final.recommendations || [],
    degraded: Boolean(failure || final.degraded || (final.runErrors || []).length || hyps.some((h) => h.degraded)),
    runErrors: [...(final.runErrors || []), ...(failure ? [failure.message] : [])].slice(0, 30),
    'budget.usdUsed': cost.usd,
    'budget.tokensUsed': cost.tokens,
    endedAt: new Date(),
  };
  const saved = await RiskAssessment.findByIdAndUpdate(assessment._id, { $set: update }, { new: true }).lean();
  if (!failure) await executeAuto(saved);
  forget(assessment.runId);
  dropSlots(assessment.runId);
  return { ...saved, cost };
}

/**
 * Start an investigation of `area` (its latest window by default).
 * @returns {{ runId, assessmentId, done: Promise<object> }}
 */
async function startAssessment({ area, windowEnd, trigger = 'admin', actor, ip, deps = { callJson } }) {
  const target = await resolveArea(area);
  if (!target) throw badRequest(`Unknown area: ${area}`);
  let we = windowEnd ? new Date(windowEnd) : null;
  if (!we) {
    const latest = await AreaFeature.findOne({ area: target }).sort({ windowEnd: -1 }).select('windowEnd').lean();
    we = latest?.windowEnd || new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  }
  const budget = await settings.get('risk.budget');
  const runId = `run_${crypto.randomBytes(6).toString('hex')}`;
  const assessment = await RiskAssessment.create({
    runId, area: target, windowEnd: we, trigger, triggeredBy: typeof actor === 'string' ? actor : actor?.email,
    status: 'running', budget: { usdMax: budget.usdMax, tokensMax: budget.tokensMax, usdUsed: 0, tokensUsed: 0 },
  });
  await audit.record({ actor: actor || 'system', action: 'risk.investigate', target: { type: 'area', id: target }, after: { runId, trigger }, ip });

  const graph = buildGraph(deps);
  const init = {
    runId, area: target, areaLabel: await areaLabel(target), windowEnd: we, budget, loopCount: 0, revisionCount: 0,
  };
  const done = graph.invoke(init, { recursionLimit: GRAPH.recursionLimit })
    .then((final) => finish(assessment, final))
    .catch((error) => {
      logger.error('Investigation failed', { runId, error: error.message });
      return finish(assessment, {}, error);
    });
  return { runId, assessmentId: assessment._id, done };
}

/** Start and wait: { runId, outcome, cost, assessment }. */
async function runAssessment(options) {
  const { runId, done } = await startAssessment(options);
  const result = await done;
  return { runId, outcome: result.outcome, status: result.status, cost: result.cost, assessment: result };
}

module.exports = { startAssessment, runAssessment, runCost, outcomeOf };
