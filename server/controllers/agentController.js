const { runTurn, titleFor } = require('../agent/novardAgent');
const conversations = require('../agent/conversations');
const learnerProfile = require('../services/learnerProfileService');
const { friendlyAIError } = require('../ai/errors');
const { currentUserId } = require('../middleware/auth');
const { badRequest, HttpError } = require('../utils/httpError');
const logger = require('../utils/logger');

/**
 * The Novard Agent (the floating assistant): streaming chat turns, the
 * student's decisions on the agent's action cards, and chat history.
 */

const MAX_MESSAGE = 6000;

/**
 * POST /api/agent/chat  {message, conversationId?}
 * Streams Server-Sent Events: meta, token, status, action, ask, superseded, title, done, error.
 * Validation errors are ordinary JSON responses; once streaming has started,
 * failures arrive as an `error` event.
 */
exports.chat = async (req, res) => {
  const userId = currentUserId(req, req.body.userId);
  const userName = req.user.name || String(req.body.userName || '').trim().slice(0, 80);
  const input = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  if (!input) throw badRequest('Please type a message.');
  if (input.length > MAX_MESSAGE) throw badRequest(`Please keep messages under ${MAX_MESSAGE} characters.`);

  const { conversation, isNew } = await conversations.openForTurn(userId, req.body.conversationId, input);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event, data) => {
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // The student pressed Stop or closed the tab: stop generating.
  const controller = new AbortController();
  res.on('close', () => { if (!res.writableFinished) controller.abort(); });

  send('meta', { conversationId: conversation._id, title: conversation.title, isNew });
  const titlePromise = isNew ? titleFor(input) : null;

  try {
    const message = await runTurn({
      conversationId: conversation._id,
      userId,
      userName,
      input,
      emit: send,
      signal: controller.signal,
    });
    if (titlePromise) {
      const title = await titlePromise;
      if (title) {
        await conversations.setTitle(conversation._id, title);
        send('title', { title });
      }
    }
    send('done', { message });
  } catch (error) {
    logger.error('Novard Agent turn failed', error.cause || error);
    send('error', { error: friendlyAIError(error, 'The agent could not reply just now. Please try again.') });
  } finally {
    res.end();
  }
};

/**
 * POST /api/agent/conversations/:id/actions/:actionId
 *   {decision: 'create'|'accept'|'confirm'|'dismiss', args?, remember?} -> {action}
 */
exports.decideAction = async (req, res) => {
  try {
    const action = await conversations.decideAction({
      userId: currentUserId(req, req.body.userId),
      userName: req.user.name || String(req.body.userName || '').trim().slice(0, 80),
      conversationId: req.params.id,
      actionId: req.params.actionId,
      decision: req.body.decision,
      args: req.body.args,
      remember: req.body.remember === true,
    });
    res.json({ action });
  } catch (error) {
    // A failed run returns the card's new state next to the error, so the UI can show "Try again".
    if (error instanceof HttpError && error.details?.action) {
      res.status(error.status).json({ error: error.message, code: error.code, action: error.details.action });
      return;
    }
    throw error;
  }
};

/** GET /api/agent/profile -> {profile, derivedKeys, saved, updatedAt} */
exports.getProfile = async (req, res) => {
  res.json(await learnerProfile.getProfile(currentUserId(req)));
};

/** PUT /api/agent/profile {field: value | null, ...} -> the updated profile */
exports.updateProfile = async (req, res) => {
  res.json(await learnerProfile.updateProfile(currentUserId(req), req.body?.profile ?? req.body));
};

exports.listConversations = async (req, res) => {
  res.json(await conversations.listConversations(currentUserId(req, req.params.userId)));
};

exports.getConversation = async (req, res) => {
  res.json(await conversations.getConversation(currentUserId(req, req.query.userId), req.params.id));
};

exports.renameConversation = async (req, res) => {
  res.json(await conversations.renameConversation(currentUserId(req, req.body.userId), req.params.id, req.body.title));
};

exports.deleteConversation = async (req, res) => {
  await conversations.deleteConversation(currentUserId(req, req.body?.userId || req.query.userId), req.params.id);
  res.json({ success: true });
};
