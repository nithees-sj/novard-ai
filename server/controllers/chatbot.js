const ChatbotConversation = require('../models/chatbotConversation');
const { runTurn, titleFor } = require('../agent/novardAgent');
const { ACTIONS } = require('../agent/actions');
const { friendlyAIError } = require('../ai/conversation');

/**
 * The Novard Agent (the floating assistant): streaming chat turns, the
 * student's decisions on the agent's action cards, and chat history.
 * The agent itself lives in agent/novardAgent.js; the actions it can take in
 * agent/actions.js.
 */

const MAX_MESSAGE = 6000;
const STALE_RUNNING_MS = 10 * 60 * 1000;

const fallbackTitle = (text) => {
  const clean = String(text).replace(/\s+/g, ' ').trim();
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

/**
 * POST /api/agent/chat  {userId, userName?, message, conversationId?}
 * Streams Server-Sent Events: meta, token, status, action, title, done, error.
 */
exports.chat = async (req, res) => {
  const userId = String(req.body.userId || '').trim();
  const userName = String(req.body.userName || '').trim().slice(0, 80);
  const input = typeof req.body.message === 'string' ? req.body.message.trim() : '';

  if (!userId) return res.status(400).json({ error: 'userId is required' });
  if (!input) return res.status(400).json({ error: 'Please type a message.' });
  if (input.length > MAX_MESSAGE) return res.status(400).json({ error: `Please keep messages under ${MAX_MESSAGE} characters.` });

  let conversation = null;
  if (req.body.conversationId) {
    conversation = await ChatbotConversation.findOne({ _id: req.body.conversationId, userId }).select('_id title messages.role').lean().catch(() => null);
  }
  const isNew = !conversation || !(conversation.messages || []).length;
  if (!conversation) {
    conversation = await ChatbotConversation.create({ userId, title: fallbackTitle(input) });
  }

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
        await ChatbotConversation.updateOne({ _id: conversation._id }, { $set: { title } });
        send('title', { title });
      }
    }
    send('done', { message });
  } catch (error) {
    console.error('Novard Agent turn failed:', error.cause || error);
    send('error', { error: friendlyAIError(error, 'The agent could not reply just now. Please try again.') });
  } finally {
    res.end();
  }
};

/**
 * POST /api/agent/conversations/:id/actions/:actionId  {userId, userName?, decision: 'confirm'|'dismiss'}
 * Carries out (or declines) an action card. Only a proposed or failed action
 * can run, and it is claimed atomically, so a double click never creates twice.
 */
exports.decideAction = async (req, res) => {
  const { id, actionId } = req.params;
  const userId = String(req.body.userId || '').trim();
  const userName = String(req.body.userName || '').trim().slice(0, 80);
  const decision = req.body.decision;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  if (!['confirm', 'dismiss'].includes(decision)) return res.status(400).json({ error: 'decision must be confirm or dismiss' });

  const filter = { _id: id, userId };
  const doc = await ChatbotConversation.findOne(filter).select('messages').lean().catch(() => null);
  if (!doc) return res.status(404).json({ error: 'Conversation not found' });
  const message = doc.messages.find((m) => (m.actions || []).some((a) => a.id === actionId));
  const action = message?.actions.find((a) => a.id === actionId);
  if (!action || !ACTIONS[action.type]) return res.status(404).json({ error: 'Action not found' });

  const setAction = (fields, onlyIf) => ChatbotConversation.updateOne(
    { ...filter, messages: { $elemMatch: { actions: { $elemMatch: { id: actionId, ...(onlyIf ? { status: { $in: onlyIf } } : {}) } } } } },
    { $set: Object.fromEntries(Object.entries({ ...fields, updatedAt: new Date() }).map(([k, v]) => [`messages.$[m].actions.$[a].${k}`, v])) },
    { arrayFilters: [{ 'm.actions.id': actionId }, { 'a.id': actionId }] },
  );

  if (decision === 'dismiss') {
    const r = await setAction({ status: 'dismissed' }, ['proposed', 'failed']);
    if (!r.modifiedCount) return res.status(409).json({ error: 'This action can no longer be declined.' });
    return res.json({ action: { ...action, status: 'dismissed' } });
  }

  const claimed = await setAction({ status: 'running', error: null }, ['proposed', 'failed']);
  if (!claimed.modifiedCount) {
    return res.status(409).json({ error: action.status === 'done' ? 'This has already been done.' : 'This is already in progress.' });
  }

  try {
    // A suggested doubt carries over the explanation it was suggested with; a requested one starts fresh.
    const sourceText = action.origin === 'requested' ? '' : message.content;
    const result = await ACTIONS[action.type].run(action.args || {}, { userId, userName, sourceText });
    await setAction({ status: 'done', result });
    res.json({ action: { ...action, status: 'done', result, error: null } });
  } catch (error) {
    console.error(`Agent action ${action.type} failed:`, error.cause || error);
    const reason = friendlyAIError(error.cause || error, error.status === 502 && error.message ? error.message : 'Something went wrong while creating this. Please try again.');
    await setAction({ status: 'failed', error: reason });
    res.status(error.status === 400 ? 400 : 502).json({ error: reason, action: { ...action, status: 'failed', error: reason } });
  }
};

exports.listConversations = async (req, res) => {
  try {
    const docs = await ChatbotConversation.find({ userId: req.params.userId })
      .sort({ updatedAt: -1 })
      .select('title updatedAt messages.role')
      .lean();
    res.json(docs.map((d) => ({ _id: d._id, title: d.title, updatedAt: d.updatedAt, messageCount: (d.messages || []).length })));
  } catch (error) {
    console.error('Error listing conversations:', error);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
};

exports.getConversation = async (req, res) => {
  try {
    const doc = await ChatbotConversation.findOne({ _id: req.params.id, userId: req.query.userId })
      .select('title messages updatedAt').lean().catch(() => null);
    if (!doc) return res.status(404).json({ error: 'Conversation not found' });
    res.json(present(doc));
  } catch (error) {
    console.error('Error loading conversation:', error);
    res.status(500).json({ error: 'Failed to load conversation' });
  }
};

exports.renameConversation = async (req, res) => {
  try {
    const title = String(req.body.title || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const r = await ChatbotConversation.updateOne({ _id: req.params.id, userId: req.body.userId }, { $set: { title } }).catch(() => ({ matchedCount: 0 }));
    if (!r.matchedCount) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ title });
  } catch (error) {
    console.error('Error renaming conversation:', error);
    res.status(500).json({ error: 'Failed to rename conversation' });
  }
};

exports.deleteConversation = async (req, res) => {
  try {
    const userId = req.body?.userId || req.query.userId;
    const result = await ChatbotConversation.deleteOne({ _id: req.params.id, userId }).catch(() => ({ deletedCount: 0 }));
    if (!result.deletedCount) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
};
