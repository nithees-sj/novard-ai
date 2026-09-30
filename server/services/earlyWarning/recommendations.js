const crypto = require('crypto');
const RiskAssessment = require('../../models/riskAssessment');
const RiskObject = require('../../models/riskObject');
const settings = require('../settingsService');
const audit = require('../auditService');
const { resolveReports } = require('../reportService');
const { broadcast } = require('../announcementService');
const { TOOLS } = require('../../config/admin');
const { TASKS } = require('../../config/ai');
const { RECOMMENDATION_TYPES } = require('../../config/earlyWarning');
const { notFound, conflict, badRequest } = require('../../utils/httpError');
const { isObjectId } = require('../../utils/validate');

/**
 * An investigation's recommendations (EWDI action node + approve endpoint).
 *
 * The model proposes; the server decides what can run:
 *   - the action type must be in the catalog (config/earlyWarning.js), with
 *     valid parameters, or the recommendation becomes plain advice;
 *   - only `flag_area` executes by itself (internal and reversible), whatever
 *     the model asked for; everything else waits for an admin;
 *   - approving runs it through the SAME service function as the console's
 *     own control (settings, resolve reports, announcements), audited.
 */

const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const MODEL_ID = /^[\w./:-]{2,100}$/;

/** Clean and validate a recommendation's parameters for its type; null if unusable. */
function cleanParams(type, raw = {}, { area }) {
  const p = raw && typeof raw === 'object' ? raw : {};
  switch (type) {
    case 'flag_area':
    case 'advice':
      return {};
    case 'known_issue_banner':
      return TOOLS[p.tool] && clip(p.message, 300) ? { tool: p.tool, message: clip(p.message, 300) } : null;
    case 'set_feature_flag':
      return TOOLS[p.tool] && typeof p.enabled === 'boolean' ? { tool: p.tool, enabled: p.enabled, message: clip(p.message, 300) } : null;
    case 'set_model_route':
      return TASKS[p.task] && MODEL_ID.test(String(p.model || '')) ? { task: p.task, model: String(p.model) } : null;
    case 'bulk_resolve':
      return clip(p.note, 2000) ? { area, note: clip(p.note, 2000) } : null;
    case 'broadcast': {
      const audience = p.audience === 'all' ? 'all' : 'area_reporters';
      return clip(p.title, 120) ? { audience, area, title: clip(p.title, 120), body: clip(p.body, 1000) } : null;
    }
    default:
      return null;
  }
}

/** Turn a model's recommendation into a safe, typed one. */
function normalize(raw = {}, { area, allowedIds = new Set() } = {}) {
  let actionType = RECOMMENDATION_TYPES[raw.actionType] ? raw.actionType : 'advice';
  let params = cleanParams(actionType, raw.params, { area });
  if (!params) {
    actionType = 'advice';
    params = {};
  }
  const auto = Boolean(RECOMMENDATION_TYPES[actionType].auto);
  return {
    id: crypto.randomBytes(4).toString('hex'),
    action: clip(raw.action, 500) || RECOMMENDATION_TYPES[actionType].label,
    actionType,
    params,
    kind: raw.kind === 'preventive' ? 'preventive' : 'corrective',
    priority: Math.max(1, Math.min(5, parseInt(raw.priority, 10) || 3)),
    rationale: clip(raw.rationale, 1000),
    evidenceIds: (Array.isArray(raw.evidenceIds) ? raw.evidenceIds : []).map(String).filter((id) => allowedIds.has(id)).slice(0, 10),
    expectedEffect: clip(raw.expectedEffect, 300),
    execution: auto ? 'auto' : 'manual',
    status: auto ? 'auto_executed' : actionType === 'advice' ? 'advice' : 'awaiting_approval',
  };
}

/** Run a recommendation. Each branch is the console's own control. */
async function execute(rec, { actor, ip, assessment }) {
  const p = rec.params || {};
  switch (rec.actionType) {
    case 'flag_area': {
      const filter = assessment.riskObjectId ? { _id: assessment.riskObjectId } : { area: assessment.area, state: { $ne: 'resolved' } };
      const { modifiedCount } = await RiskObject.updateMany(filter, { $set: { flagged: true, flaggedReason: clip(rec.action, 300) } });
      await audit.record({ actor, action: 'risk.flag', target: { type: 'area', id: assessment.area }, after: { flagged: true, run: assessment.runId }, ip });
      return { flagged: modifiedCount };
    }
    case 'known_issue_banner':
      return { setting: await settings.set(`features.${p.tool}`, { notice: p.message }, { actor, ip }) };
    case 'set_feature_flag':
      return { setting: await settings.set(`features.${p.tool}`, { enabled: p.enabled, message: p.message || '' }, { actor, ip }) };
    case 'set_model_route': {
      const routes = await settings.get('ai.routes');
      return { setting: await settings.set('ai.routes', { ...routes, [p.task]: p.model }, { actor, ip }) };
    }
    case 'bulk_resolve':
      return resolveReports({ area: p.area, note: p.note, actor, ip });
    case 'broadcast':
      return broadcast(actor, { audience: p.audience, area: p.area, title: p.title, body: p.body }, { ip });
    case 'advice':
      return { note: 'Acknowledged' };
    default:
      throw badRequest(`Unknown recommendation type: ${rec.actionType}`);
  }
}

/** Run the auto recommendations of a finished assessment (as "system"). */
async function executeAuto(assessment) {
  for (const rec of assessment.recommendations.filter((r) => r.execution === 'auto' && r.status === 'auto_executed')) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await execute(rec, { actor: 'system', assessment });
      // eslint-disable-next-line no-await-in-loop
      await RiskAssessment.updateOne({ _id: assessment._id, 'recommendations.id': rec.id }, { $set: { 'recommendations.$.result': result } });
    } catch (error) {
      // eslint-disable-next-line no-await-in-loop
      await RiskAssessment.updateOne({ _id: assessment._id, 'recommendations.id': rec.id }, { $set: { 'recommendations.$.status': 'failed', 'recommendations.$.error': error.message } });
    }
  }
}

async function findAssessment(id) {
  if (!isObjectId(String(id))) throw badRequest('A valid assessment id is required.');
  const assessment = await RiskAssessment.findById(id).lean();
  if (!assessment) throw notFound('Assessment not found');
  return assessment;
}

/**
 * Approve a recommendation: claimed atomically (awaiting_approval -> approved),
 * so a double click or two admins can never run it twice; then executed.
 */
async function approve(actor, assessmentId, recId, { ip } = {}) {
  const assessment = await findAssessment(assessmentId);
  const rec = (assessment.recommendations || []).find((r) => r.id === recId);
  if (!rec) throw notFound('Recommendation not found');
  const claimed = await RiskAssessment.updateOne(
    { _id: assessment._id, recommendations: { $elemMatch: { id: recId, status: { $in: ['awaiting_approval', 'advice'] } } } },
    { $set: { 'recommendations.$.status': 'approved', 'recommendations.$.approvedBy': actor.email, 'recommendations.$.decidedAt': new Date() } }
  );
  if (!claimed.modifiedCount) throw conflict(`This recommendation is already ${rec.status.replace(/_/g, ' ')}.`);

  let result;
  let error;
  try {
    result = await execute(rec, { actor, ip, assessment });
  } catch (e) {
    error = e;
  }
  await RiskAssessment.updateOne({ _id: assessment._id, 'recommendations.id': recId }, {
    $set: error
      ? { 'recommendations.$.status': 'failed', 'recommendations.$.error': error.message }
      : { 'recommendations.$.result': JSON.parse(JSON.stringify(result ?? {})) },
  });
  await audit.record({
    actor, action: 'recommendation.approve', target: { type: 'assessment', id: `${assessment.runId}:${recId}` },
    after: { actionType: rec.actionType, params: rec.params, ok: !error, error: error?.message }, ip,
  });
  if (error) throw error;
  return { recommendation: { ...rec, status: 'approved', approvedBy: actor.email }, result };
}

async function dismiss(actor, assessmentId, recId, { ip } = {}) {
  const assessment = await findAssessment(assessmentId);
  const claimed = await RiskAssessment.updateOne(
    { _id: assessment._id, recommendations: { $elemMatch: { id: recId, status: { $in: ['awaiting_approval', 'advice'] } } } },
    { $set: { 'recommendations.$.status': 'dismissed', 'recommendations.$.approvedBy': actor.email, 'recommendations.$.decidedAt': new Date() } }
  );
  if (!claimed.modifiedCount) throw conflict('This recommendation was already decided.');
  await audit.record({ actor, action: 'recommendation.dismiss', target: { type: 'assessment', id: `${assessment.runId}:${recId}` }, ip });
  return { dismissed: true };
}

module.exports = { normalize, cleanParams, execute, executeAuto, approve, dismiss, findAssessment };
