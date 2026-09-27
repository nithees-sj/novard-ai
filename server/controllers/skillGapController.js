const skillGap = require('../services/skillGapService');
const { currentUserId } = require('../middleware/auth');

/** Start a coaching session: analyse the profile and open the chat with the result. */
exports.createSession = async (req, res) => {
  res.status(201).json(await skillGap.startSession(currentUserId(req, req.body.userId), req.body));
};

exports.listSessions = async (req, res) => {
  res.json(await skillGap.listSessions(currentUserId(req, req.params.userId)));
};

exports.getSession = async (req, res) => {
  res.json(await skillGap.getSession(currentUserId(req, req.query.userId), req.params.id));
};

exports.sendMessage = async (req, res) => {
  res.json(await skillGap.sendCoachMessage(currentUserId(req, req.body.userId), req.params.id, req.body.message));
};

exports.deleteSession = async (req, res) => {
  await skillGap.deleteSession(currentUserId(req, req.body?.userId || req.query.userId), req.params.id);
  res.json({ success: true });
};
