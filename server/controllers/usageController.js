const { recordUsage } = require('../services/usageService');
const { currentUserId } = require('../middleware/auth');

/**
 * POST /api/usage/heartbeat {day, seconds}
 * Study-time heartbeat from the client's tracker. navigator.sendBeacon posts
 * text/plain (it cannot set headers), so the session token may be in the body;
 * the route parses that body before authenticating.
 */
exports.recordUsage = async (req, res) => {
  const userId = currentUserId(req, req.body.userId);
  res.json(await recordUsage(userId, req.body));
};
