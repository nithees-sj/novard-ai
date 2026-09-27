const doubts = require('../services/doubtService');
const { currentUserId } = require('../middleware/auth');

exports.list = async (req, res) => {
  res.json(await doubts.listDoubts(currentUserId(req, req.params.userId)));
};

exports.create = async (req, res) => {
  const { title, description, imageUrl } = req.body;
  const saved = await doubts.createDoubt({ title, description, imageUrl, userId: currentUserId(req, req.body.userId) });
  res.status(201).json(saved);
};

exports.remove = async (req, res) => {
  await doubts.deleteDoubt({ userId: currentUserId(req, req.body?.userId), doubtId: req.params.doubtId });
  res.json({ message: 'Doubt clearance deleted successfully' });
};

exports.chat = async (req, res) => {
  const { doubtId, message } = req.body;
  res.json({ response: await doubts.chatWithDoubt({ userId: currentUserId(req, req.body.userId), doubtId, message }) });
};

exports.summarize = async (req, res) => {
  res.json({ summary: await doubts.summarizeDoubt({ userId: currentUserId(req, req.body.userId), doubtId: req.body.doubtId }) });
};

exports.generateQuiz = async (req, res) => {
  res.json(await doubts.generateDoubtQuiz({ userId: currentUserId(req, req.body.userId), doubtId: req.body.doubtId, body: req.body }));
};

exports.saveQuizResults = async (req, res) => {
  const { doubtId, quizIndex, score } = req.body;
  await doubts.saveDoubtQuizResult({ userId: currentUserId(req, req.body.userId), doubtId, quizIndex, score });
  res.json({ message: 'Quiz results saved successfully' });
};

exports.recommendVideos = async (req, res) => {
  res.json(await doubts.recommendVideosForDoubt({ userId: currentUserId(req, req.body.userId), doubtId: req.body.doubtId }));
};
