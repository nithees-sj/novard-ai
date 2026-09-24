const ChatbotConversation = require('../models/chatbotConversation');
const { converse } = require('../ai/conversation');
const { FORMAT_RULES } = require('../ai/prompts');

/**
 * The general assistant behind the floating chatbot button.
 *
 * Every conversation is stored and runs through the LangChain conversation
 * engine, so follow-up questions ("and the second one?", "what did you say
 * about X earlier?") work. It used to answer each message in isolation.
 */

const SYSTEM = `You are Novard, the learning and career assistant inside the Novard-AI platform.
You help students learn technical topics, plan their studies, prepare for interviews and grow their careers.
Be friendly and practical. Give specific, current advice (real tools, concrete steps, realistic timelines).
If a question would be better served by one of the platform's tools, mention it briefly: Skill Unlocker (day-by-day learning plans), Smart Roadmap (personalised career roadmaps), Skill Gap Analysis (a coaching chat about skill gaps), Notes (chat with uploaded PDFs), Doubt Clearance, Video Summarizer, and the AI Forum.

${FORMAT_RULES}`;

const titleFrom = (text) => {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean || 'New chat';
};

exports.processChatbotPrompt = async (req, res) => {
  const { prompt, conversationId } = req.body;
  const userId = req.body.userId || 'anonymous';
  const input = typeof prompt === 'string' ? prompt.trim() : '';

  if (!input) {
    return res.status(400).json({ error: 'Invalid or missing prompt in the request body.' });
  }
  if (input.length > 6000) {
    return res.status(400).json({ error: 'Please keep messages under 6000 characters.' });
  }

  try {
    let conversation = conversationId
      ? await ChatbotConversation.findOne({ _id: conversationId, userId }).select('_id title').catch(() => null)
      : null;
    // Unknown or someone else's id: start a fresh conversation rather than failing.
    if (!conversation) {
      conversation = await ChatbotConversation.create({ userId, title: titleFrom(input) });
    }

    const response = await converse({
      Model: ChatbotConversation,
      filter: { _id: conversation._id, userId },
      field: 'messages',
      timeKey: 'createdAt',
      system: SYSTEM,
      input,
      tier: 'REASONING',
      maxTokens: 2500,
      temperature: 0.6,
    });

    res.status(200).json({ response, conversationId: conversation._id, title: conversation.title });
  } catch (error) {
    console.error('Error processing chatbot prompt:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Error processing chatbot prompt.' });
  }
};

exports.listConversations = async (req, res) => {
  try {
    const docs = await ChatbotConversation.find({ userId: req.params.userId })
      .sort({ updatedAt: -1 })
      .select('title updatedAt messages')
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
    res.json(doc);
  } catch (error) {
    console.error('Error loading conversation:', error);
    res.status(500).json({ error: 'Failed to load conversation' });
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
