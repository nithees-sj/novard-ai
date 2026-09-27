const { quizHistory } = require('../services/quizHistoryService');
const { currentUserId } = require('../middleware/auth');

/** GET /api/quiz-history/:source/:itemId - previous marks on one note / video / doubt / plan. */
exports.getQuizHistory = async (req, res) => {
  const userId = currentUserId(req, req.query.userId);
  res.json(await quizHistory(userId, req.params.source, req.params.itemId));
};
