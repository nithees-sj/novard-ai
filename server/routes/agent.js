const { Router } = require('express');
const h = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const agent = require('../controllers/agentController');
const { aiFeature } = require('../middleware/featureGate');

/** Novard Agent: streaming chat (SSE), action cards, chat history, learner profile */
const router = Router();
router.use('/api/agent', requireAuth());

router.post('/api/agent/chat', aiLimiter, aiFeature('agent.chat'), h(agent.chat));
router.post('/api/agent/conversations/:id/actions/:actionId', aiLimiter, aiFeature('agent.action'), h(agent.decideAction));
router.get('/api/agent/profile', h(agent.getProfile));
router.put('/api/agent/profile', h(agent.updateProfile));
router.get('/api/agent/conversations/user/:userId', h(agent.listConversations));
router.get('/api/agent/conversations/:id', h(agent.getConversation));
router.patch('/api/agent/conversations/:id', h(agent.renameConversation));
router.delete('/api/agent/conversations/:id', h(agent.deleteConversation));

module.exports = router;
