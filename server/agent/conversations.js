const ChatbotConversation = require('../models/chatbotConversation');
const { ACTIONS } = require('./actions');
const { friendlyAIError } = require('../ai/errors');
const { badRequest, conflict, notFound, HttpError } = require('../utils/httpError');
const { objectId, text, oneOf } = require('../utils/validate');
const logger = require('../utils/logger');

/**
 * Novard Agent chat history, and the student's decisions on the agent's
 * action cards. The agent's turn itself lives in novardAgent.js.
 */

const STALE_RUNNING_MS = 10 * 60 * 1000;

const fallbackTitle = (input) => {
  const clean = String(input).replace(/\s+/g, ' ').trim();
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean || 'New chat';
};

/** An action left "running" by a server restart would spin forever; show it as failed so it can be retried. */
function present(doc) {
  const now = Date.now();
  return {
    ...doc,
    messages: (doc.messages || []).map((m) => (!m.actions ? m : {
      ...m,
      actions: m.actions.map((a) => (a.status === 'running' && now - new Date(a.updatedAt).getTime() > STALE_RUNNING_MS
        ? { ...a, status: 'failed', error: 'This was interrupted. Please try again.' }
        : a)),
    })),
  };
}

async function listConversations(userId) {
  const docs = await ChatbotConversation.find({ userId })
    .sort({ updatedAt: -1 })
    .select('title updatedAt messages.role')
    .lean();
  return docs.map((d) => ({ _id: d._id, title: d.title, updatedAt: d.updatedAt, messageCount: (d.messages || []).length }));
}

async function getConversation(userId, id) {
  const doc = await ChatbotConversation.findOne({ _id: objectId(id, 'conversation id'), userId })
    .select('title messages updatedAt').lean();
  if (!doc) throw notFound('Conversation not found');
  return present(doc);
}

async function renameConversation(userId, id, title) {
  const clean = text(title, 'Title', { max: 1000 }).slice(0, 120);
  const result = await ChatbotConversation.updateOne({ _id: objectId(id, 'conversation id'), userId }, { $set: { title: clean } });
  if (!result.matchedCount) throw notFound('Conversation not found');
  return { title: clean };
}

async function deleteConversation(userId, id) {
  const result = await ChatbotConversation.deleteOne({ _id: objectId(id, 'conversation id'), userId });
  if (!result.deletedCount) throw notFound('Conversation not found');
}

/**
 * The conversation a new turn belongs to: the given one if it is the
 * student's, otherwise a new one titled from the message.
 */
async function openForTurn(userId, conversationId, input) {
  let conversation = null;
  if (conversationId) {
    conversation = await ChatbotConversation.findOne({ _id: objectId(conversationId, 'conversation id'), userId })
      .select('_id title messages.role').lean();
  }
  const isNew = !conversation || !(conversation.messages || []).length;
  if (!conversation) conversation = await ChatbotConversation.create({ userId, title: fallbackTitle(input) });
  return { conversation, isNew };
}

const setTitle = (id, title) => ChatbotConversation.updateOne({ _id: id }, { $set: { title } });

/**
 * Carry out (or decline) an action card. Only a proposed or failed action
 * can run, and it is claimed atomically, so a double click never creates twice.
 * Returns the updated action; throws with `action` attached when running it failed.
 */
async function decideAction({ userId, userName, conversationId, actionId, decision }) {
  oneOf(decision, 'decision', ['confirm', 'dismiss']);
  const filter = { _id: objectId(conversationId, 'conversation id'), userId };
  if (typeof actionId !== 'string' || !/^[a-f\d]{1,32}$/i.test(actionId)) throw badRequest('A valid action id is required.');

  const doc = await ChatbotConversation.findOne(filter).select('messages').lean();
  if (!doc) throw notFound('Conversation not found');
  const message = doc.messages.find((m) => (m.actions || []).some((a) => a.id === actionId));
  const action = message?.actions.find((a) => a.id === actionId);
  if (!action || !ACTIONS[action.type]) throw notFound('Action not found');

  const setAction = (fields, onlyIf) => ChatbotConversation.updateOne(
    { ...filter, messages: { $elemMatch: { actions: { $elemMatch: { id: actionId, ...(onlyIf ? { status: { $in: onlyIf } } : {}) } } } } },
    { $set: Object.fromEntries(Object.entries({ ...fields, updatedAt: new Date() }).map(([k, v]) => [`messages.$[m].actions.$[a].${k}`, v])) },
    { arrayFilters: [{ 'm.actions.id': actionId }, { 'a.id': actionId }] },
  );

  if (decision === 'dismiss') {
    const r = await setAction({ status: 'dismissed' }, ['proposed', 'failed']);
    if (!r.modifiedCount) throw conflict('This action can no longer be declined.');
    return { ...action, status: 'dismissed' };
  }

  const claimed = await setAction({ status: 'running', error: null }, ['proposed', 'failed']);
  if (!claimed.modifiedCount) {
    throw conflict(action.status === 'done' ? 'This has already been done.' : 'This is already in progress.');
  }

  try {
    // A suggested doubt carries over the explanation it was suggested with; a requested one starts fresh.
    const sourceText = action.origin === 'requested' ? '' : message.content;
    const result = await ACTIONS[action.type].run(action.args || {}, { userId, userName, sourceText });
    await setAction({ status: 'done', result });
    return { ...action, status: 'done', result, error: null };
  } catch (error) {
    logger.error(`Agent action ${action.type} failed`, error.cause || error);
    const reason = friendlyAIError(error.cause || error, error.status === 502 && error.message ? error.message : 'Something went wrong while creating this. Please try again.');
    await setAction({ status: 'failed', error: reason });
    throw new HttpError(error.status === 400 ? 400 : 502, reason, { details: { action: { ...action, status: 'failed', error: reason } } });
  }
}

module.exports = {
  listConversations,
  getConversation,
  renameConversation,
  deleteConversation,
  openForTurn,
  setTitle,
  decideAction,
};
