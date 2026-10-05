const { Router } = require('express');
const h = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { tokenUsage } = require('../ai/tokenLimits');

const router = Router();

/**
 * GET /api/ai-usage -> {period, resetsAt, tools: [{tool, label, used, limit, reached, message?}]}
 * The signed-in student's AI token use per tool against the admin's limits.
 */
router.get('/api/ai-usage', requireAuth(), h(async (req, res) => {
  res.json(await tokenUsage(req.user.email));
}));

module.exports = router;
