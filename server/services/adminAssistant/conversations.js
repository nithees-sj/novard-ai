const AdminConversation = require('../../models/adminConversation');
const settings = require('../settingsService');
const audit = require('../auditService');
const { resolveReports } = require('../reportService');
const { startAssessment, runCost } = require('../earlyWarning/graph/runner');
const { badRequest, conflict, notFound } = require('../../utils/httpError');
const { objectId, oneOf, text } = require('../../utils/validate');
const logger = require('../../utils/logger');

/**
 * The admin assistant's chats, and the admin's decision on its cards. A card
 * is claimed atomically (proposed -> running) before it runs, so a double
 * click never runs it twice; it runs through the console's own services and
 * is audited.
 */

const fallbackTitle = (input) => {
  const clean = String(input).replace(/\s+/g, ' ').trim();
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean || 'New chat';
};

async function listConversations(adminId) {
  const docs = await AdminConversation.find({ adminId }).sort({ updatedAt: -1 }).limit(100).select('title updatedAt messages.role').lean();
  return docs.map((d) => ({ _id: d._id, title: d.title, updatedAt: d.updatedAt, messageCount: (d.messages || []).length }));
}

async function getConversation(adminId, id) {
  const doc = await AdminConversation.findOne({ _id: objectId(id, 'conversation id'), adminId }).select('title messages updatedAt').lean();
  if (!doc) throw notFound('Conversation not found');
  return doc;
}

async function renameConversation(adminId, id, title) {
  const clean = text(title, 'Title', { max: 1000 }).slice(0, 120);
  const r = await AdminConversation.updateOne({ _id: objectId(id, 'conversation id'), adminId }, { $set: { title: clean } });
  if (!r.matchedCount) throw notFound('Conversation not found');
  return { title: clean };
}

async function deleteConversation(adminId, id) {
  const r = await AdminConversation.deleteOne({ _id: objectId(id, 'conversation id'), adminId });
  if (!r.deletedCount) throw notFound('Conversation not found');
}

async function openForTurn(adminId, conversationId, input) {
  let conversation = null;
  if (conversationId) conversation = await AdminConversation.findOne({ _id: objectId(conversationId, 'conversation id'), adminId }).select('_id title').lean();
  const isNew = !conversation;
  if (!conversation) conversation = (await AdminConversation.create({ adminId, title: fallbackTitle(input) })).toObject();
  return { conversation, isNew };
}

/** Run a confirmed card through the console's own services. */
async function execute(action, { admin, ip, onRunFinished }) {
  const a = action.args || {};
  switch (action.type) {
    case 'start_investigation': {
      const { runId, done } = await startAssessment({ area: a.area, trigger: 'assistant', actor: admin, ip });
      done.then(onRunFinished).catch(() => {});
      return { itemId: runId, route: `/admin/runs/${runId}`, label: 'Watch it run', note: 'running' };
    }
    case 'resolve_reports': {
      const r = await resolveReports({ ...(a.refs ? { refs: a.refs } : { area: a.area }), note: a.note, actor: admin, ip });
      return { label: 'Resolved', note: `${r.resolved} resolved, ${r.students} student(s) notified` };
    }
    case 'set_feature_flag':
      await settings.set(`features.${a.feature}`, { enabled: a.enabled, message: a.message || '' }, { actor: admin, ip });
      return { route: '/admin/settings', label: 'Features & limits', note: `${a.feature} ${a.enabled ? 'on' : 'off'}` };
    case 'set_model_route': {
      const routes = await settings.get('ai.routes');
      await settings.set('ai.routes', { ...routes, [a.task]: a.model }, { actor: admin, ip });
      return { route: '/admin/gateways/groq', label: 'Model settings', note: `${a.task} -> ${a.model}` };
    }
    default:
      throw badRequest(`Unknown action ${action.type}`);
  }
}

/** Confirm or dismiss a card. Returns the updated action. */
async function decideAction({ admin, conversationId, actionId, decision, ip }) {
  oneOf(decision, 'decision', ['confirm', 'dismiss']);
  if (typeof actionId !== 'string' || !/^[a-f\d]{1,32}$/i.test(actionId)) throw badRequest('A valid action id is required.');
  const filter = { _id: objectId(conversationId, 'conversation id'), adminId: admin.email };
  const doc = await AdminConversation.findOne(filter).select('messages').lean();
  if (!doc) throw notFound('Conversation not found');
  const action = doc.messages.flatMap((m) => m.actions || []).find((x) => x.id === actionId);
  if (!action) throw notFound('Action not found');

  const setAction = (fields, onlyIf) => AdminConversation.updateOne(
    { ...filter, messages: { $elemMatch: { actions: { $elemMatch: { id: actionId, ...(onlyIf ? { status: { $in: onlyIf } } : {}) } } } } },
    { $set: Object.fromEntries(Object.entries({ ...fields, updatedAt: new Date() }).map(([k, v]) => [`messages.$[m].actions.$[a].${k}`, v])) },
    { arrayFilters: [{ 'm.actions.id': actionId }, { 'a.id': actionId }] },
  );

  if (decision === 'dismiss') {
    const r = await setAction({ status: 'dismissed' }, ['proposed']);
    if (!r.modifiedCount) throw conflict('This can no longer be declined.');
    await audit.record({ actor: admin, action: 'assistant.action.dismiss', target: { type: 'assistant_card', id: actionId }, after: { type: action.type, args: action.args }, ip });
    return { ...action, status: 'dismissed' };
  }

  const claimed = await setAction({ status: 'running', error: null }, ['proposed']);
  if (!claimed.modifiedCount) throw conflict(action.status === 'done' ? 'This has already been done.' : 'This is already in progress or was declined.');
  await audit.record({ actor: admin, action: 'assistant.action.confirm', target: { type: 'assistant_card', id: actionId }, after: { type: action.type, args: action.args }, ip });

  try {
    const onRunFinished = async (finished) => {
      // The investigation's outcome and exact cost, on the card, when it ends.
      const cost = await runCost(finished.runId).catch(() => ({ usd: finished.budget?.usdUsed || 0 }));
      await setAction({ 'result.note': `${String(finished.outcome || finished.status).replace(/_/g, ' ')} · $${Number(cost.usd || 0).toFixed(4)}` });
    };
    const result = await execute(action, { admin, ip, onRunFinished });
    await setAction({ status: 'done', result });
    return { ...action, status: 'done', result };
  } catch (error) {
    logger.warn('Admin assistant action failed', { type: action.type, error: error.message });
    await setAction({ status: 'failed', error: error.message });
    throw error;
  }
}

module.exports = { listConversations, getConversation, renameConversation, deleteConversation, openForTurn, decideAction };
