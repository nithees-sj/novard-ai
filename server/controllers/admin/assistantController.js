const { runTurn } = require('../../services/adminAssistant/assistant');
const conversations = require('../../services/adminAssistant/conversations');
const { friendlyAIError } = require('../../ai/errors');
const { badRequest } = require('../../utils/httpError');
const logger = require('../../utils/logger');

const MAX_MESSAGE = 4000;

/**
 * POST /api/admin/assistant/chat {message, conversationId?}
 * Server-sent events, as /api/agent/chat: meta, status, tool, action, token, done, error.
 */
exports.chat = async (req, res) => {
  const input = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!input) throw badRequest('Please type a message.');
  if (input.length > MAX_MESSAGE) throw badRequest(`Please keep messages under ${MAX_MESSAGE} characters.`);
  const { conversation, isNew } = await conversations.openForTurn(req.admin.email, req.body?.conversationId, input);

  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  const send = (event, data) => { if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  const controller = new AbortController();
  res.on('close', () => { if (!res.writableFinished) controller.abort(); });

  send('meta', { conversationId: conversation._id, title: conversation.title, isNew });
  try {
    const message = await runTurn({ conversationId: conversation._id, admin: req.admin, input, emit: send, signal: controller.signal });
    send('done', { message });
  } catch (error) {
    logger.error('Admin assistant turn failed', error.cause || error);
    send('error', { error: friendlyAIError(error, 'The assistant could not reply just now. Please try again.') });
  } finally {
    res.end();
  }
};

exports.list = async (req, res) => res.json({ conversations: await conversations.listConversations(req.admin.email) });
exports.get = async (req, res) => res.json(await conversations.getConversation(req.admin.email, req.params.id));
exports.rename = async (req, res) => res.json(await conversations.renameConversation(req.admin.email, req.params.id, req.body?.title));
exports.remove = async (req, res) => {
  await conversations.deleteConversation(req.admin.email, req.params.id);
  res.status(204).end();
};

/** POST /api/admin/assistant/conversations/:id/actions/:actionId {decision: 'confirm'|'dismiss'} -> {action} */
exports.decide = async (req, res) => {
  const action = await conversations.decideAction({ admin: req.admin, conversationId: req.params.id, actionId: req.params.actionId, decision: req.body?.decision, ip: req.ip });
  res.json({ action });
};
