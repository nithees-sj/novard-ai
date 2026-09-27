const { buildDashboard, readTzOffset } = require('../services/analyticsService');
const { currentUserId } = require('../middleware/auth');

/** GET /api/analytics/:userId?tzOffset=<minutes> - the dashboard numbers. */
exports.getUserAnalytics = async (req, res) => {
  const userId = currentUserId(req, req.params.userId);
  res.json(await buildDashboard(userId, readTzOffset(req.query.tzOffset)));
};
