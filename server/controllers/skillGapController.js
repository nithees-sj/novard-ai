const SkillGapSession = require('../models/skillGapSession');
const { readProfile, analyse, openingMessage, coachSystemPrompt } = require('../services/skillGapService');
const { converse } = require('../ai/conversation');

const fail = (res, error, fallback) => {
  console.error(fallback, error.cause || error);
  res.status(error.status || 500).json({ error: error.status ? error.message : fallback });
};

/** Start a coaching session: analyse the profile and open the chat with the result. */
const createSession = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const profile = readProfile(req.body);
    if (profile.targetRole.length < 2) {
      return res.status(400).json({ error: 'Tell the coach which role you are aiming for.' });
    }

    const analysis = await analyse(profile);
    const session = await SkillGapSession.create({
      userId,
      profile,
      analysis,
      messages: [{ role: 'assistant', content: openingMessage(profile, analysis) }],
    });
    res.status(201).json(session);
  } catch (error) {
    fail(res, error, 'Failed to analyse your skills');
  }
};

const listSessions = async (req, res) => {
  try {
    const docs = await SkillGapSession.find({ userId: req.params.userId })
      .sort({ updatedAt: -1 })
      .select('profile.targetRole analysis.readiness messages updatedAt createdAt')
      .lean();
    res.json(docs.map((d) => ({
      _id: d._id,
      targetRole: d.profile?.targetRole,
      readiness: d.analysis?.readiness,
      messageCount: (d.messages || []).length,
      updatedAt: d.updatedAt,
    })));
  } catch (error) {
    fail(res, error, 'Failed to load your analyses');
  }
};

const getSession = async (req, res) => {
  try {
    const doc = await SkillGapSession.findOne({ _id: req.params.id, userId: req.query.userId }).lean().catch(() => null);
    if (!doc) return res.status(404).json({ error: 'Analysis not found' });
    res.json(doc);
  } catch (error) {
    fail(res, error, 'Failed to load the analysis');
  }
};

const sendMessage = async (req, res) => {
  try {
    const { userId, message } = req.body;
    const text = String(message || '').trim();
    if (!text) return res.status(400).json({ error: 'Type a message first.' });
    if (text.length > 4000) return res.status(400).json({ error: 'Please keep messages under 4000 characters.' });

    const session = await SkillGapSession.findOne({ _id: req.params.id, userId }).select('profile analysis').lean().catch(() => null);
    if (!session) return res.status(404).json({ error: 'Analysis not found' });

    // LangChain conversation with memory of the whole coaching chat (older turns summarised).
    const content = await converse({
      Model: SkillGapSession,
      filter: { _id: session._id, userId },
      field: 'messages',
      timeKey: 'createdAt',
      system: coachSystemPrompt(session.profile, session.analysis),
      input: text,
      tier: 'REASONING',
      maxTokens: 3000,
      temperature: 0.6,
    });

    const saved = await SkillGapSession.findById(session._id).select('messages').lean();
    const [userMessage, assistantMessage] = saved.messages.slice(-2);
    await SkillGapSession.updateOne({ _id: session._id }, { $set: { updatedAt: new Date() } });
    res.json({ userMessage, assistantMessage: assistantMessage || { role: 'assistant', content, createdAt: new Date() } });
  } catch (error) {
    fail(res, error, 'The coach could not reply');
  }
};

const deleteSession = async (req, res) => {
  try {
    const userId = req.body?.userId || req.query.userId;
    const result = await SkillGapSession.deleteOne({ _id: req.params.id, userId }).catch(() => ({ deletedCount: 0 }));
    if (!result.deletedCount) return res.status(404).json({ error: 'Analysis not found' });
    res.json({ success: true });
  } catch (error) {
    fail(res, error, 'Failed to delete the analysis');
  }
};

module.exports = { createSession, listSessions, getSession, sendMessage, deleteSession };
