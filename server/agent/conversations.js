const ChatbotConversation = require('../models/chatbotConversation');
const { defFor, withMeta, applyEdits, profilePatchFrom } = require('./actions');
const { updateProfile } = require('../services/learnerProfileService');
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

/**
 * Cards as the client renders them (with their form fields and summary). An
 * action left "running" by a server restart would spin forever; it is shown
 * as failed so it can be retried.
 */
function present(doc) {
  const now = Date.now();
  return {
    ...doc,
    messages: (doc.messages || []).map((m) => (!m.actions ? m : {
      ...m,
      actions: m.actions.map((a) => withMeta(a.status === 'running' && now - new Date(a.updatedAt).getTime() > STALE_RUNNING_MS
        ? { ...a, status: 'failed', error: 'This was interrupted. Please try again.' }
        : a)),
    })),
  };
}

/**
 * The agent's explanation a doubt should open with: the latest substantial
 * answer at or shortly before the card, so "save this as a doubt" keeps it.
 */
function explanationBefore(messages, index) {
  for (let i = index; i >= Math.max(0, index - 6); i -= 1) {
    const m = messages[i];
    if (m.role === 'assistant' && String(m.content || '').length > 300) return m.content;
  }
  return '';
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
 * The student's decision on a card:
 *   create   run a draft, with the student's edits (re-checked like the model's
 *            input). `remember` saves the details they gave to their profile.
 *   accept   say Yes to a suggestion; the client then continues in the chat,
 *            where the agent gathers the details and prepares a draft
 *   confirm  say Yes to a "remember this?" card
 *   dismiss  decline a suggestion or draft
 * A card is claimed atomically before it runs, so a double click never creates twice.
 * Returns the updated action; throws with `action` attached when running it failed.
 */
async function decideAction({ userId, userName, conversationId, actionId, decision, args, remember = false }) {
  oneOf(decision, 'decision', ['create', 'accept', 'confirm', 'dismiss']);
  const filter = { _id: objectId(conversationId, 'conversation id'), userId };
  if (typeof actionId !== 'string' || !/^[a-f\d]{1,32}$/i.test(actionId)) throw badRequest('A valid action id is required.');
  if (args !== undefined && (args === null || typeof args !== 'object' || Array.isArray(args))) throw badRequest('The draft details must be an object.');

  const doc = await ChatbotConversation.findOne(filter).select('messages').lean();
  if (!doc) throw notFound('Conversation not found');
  const index = doc.messages.findIndex((m) => (m.actions || []).some((a) => a.id === actionId));
  const action = doc.messages[index]?.actions.find((a) => a.id === actionId);
  const def = action && defFor(action.type);
  if (!def) throw notFound('Action not found');

  const setAction = (fields, onlyIf) => ChatbotConversation.updateOne(
    { ...filter, messages: { $elemMatch: { actions: { $elemMatch: { id: actionId, ...(onlyIf ? { status: { $in: onlyIf } } : {}) } } } } },
    { $set: Object.fromEntries(Object.entries({ ...fields, updatedAt: new Date() }).map(([k, v]) => [`messages.$[m].actions.$[a].${k}`, v])) },
    { arrayFilters: [{ 'm.actions.id': actionId }, { 'a.id': actionId }] },
  );
  const busy = () => conflict({ done: 'This has already been done.', running: 'This is already in progress.' }[action.status] || 'This can no longer be changed.');

  if (decision === 'dismiss') {
    const r = await setAction({ status: 'dismissed' }, ['proposed', 'draft', 'failed']);
    if (!r.modifiedCount) throw conflict('This can no longer be declined.');
    return withMeta({ ...action, status: 'dismissed' });
  }

  if (decision === 'accept') {
    if (action.type === 'profile_update') throw badRequest('Use confirm for this card.');
    const r = await setAction({ status: 'accepted' }, ['proposed']);
    if (!r.modifiedCount) throw busy();
    return withMeta({ ...action, status: 'accepted' });
  }

  const isProfile = action.type === 'profile_update';
  if (decision === 'confirm' && !isProfile) throw badRequest('Use create for this card.');
  if (decision === 'create' && isProfile) throw badRequest('Use confirm for this card.');

  // The student's edits are checked before the card is claimed, so a bad edit leaves the draft as it was.
  const { args: runArgs, provenance } = isProfile
    ? { args: action.args || {}, provenance: undefined }
    : applyEdits(def, action, args);

  const claimed = await setAction(
    { status: 'running', error: null, args: runArgs, ...(provenance ? { provenance } : {}) },
    isProfile ? ['proposed', 'failed'] : ['draft', 'failed'],
  );
  if (!claimed.modifiedCount) throw busy();

  const updated = { ...action, args: runArgs, ...(provenance ? { provenance } : {}) };
  try {
    const sourceText = action.type === 'create_doubt' ? explanationBefore(doc.messages, index) : '';
    const result = await def.run(runArgs, { userId, userName, sourceText });
    await setAction({ status: 'done', result });
    if (remember && !isProfile) {
      await updateProfile(userId, profilePatchFrom(def, runArgs, provenance), { strict: false, mergeLists: true })
        .catch((error) => logger.warn('Agent: could not save to the learner profile', { error: error.message }));
    }
    return withMeta({ ...updated, status: 'done', result, error: null });
  } catch (error) {
    logger.error(`Agent action ${action.type} failed`, error.cause || error);
    const reason = friendlyAIError(error.cause || error, error.status === 502 && error.message ? error.message : 'Something went wrong while creating this. Please try again.');
    await setAction({ status: 'failed', error: reason });
    throw new HttpError(error.status === 400 ? 400 : 502, reason, { details: { action: withMeta({ ...updated, status: 'failed', error: reason }) } });
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
