const { Router } = require('express');
const h = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const forum = require('../controllers/forumController');

/** AI Forum */
const router = Router();
router.use('/api/forum', requireAuth());

router.post('/api/forum/issues', aiLimiter, h(forum.createIssue));
router.get('/api/forum/issues', h(forum.getAllIssues));
router.get('/api/forum/issues/:issueId', h(forum.getIssueById));
router.get('/api/forum/issues/:issueId/comments', h(forum.getIssueComments));
router.put('/api/forum/issues/:issueId/status', h(forum.updateIssueStatus));
router.delete('/api/forum/issues/:issueId', h(forum.deleteIssue));
router.post('/api/forum/comments', aiLimiter, h(forum.addComment));
router.post('/api/forum/comments/:commentId/ai-response', aiLimiter, h(forum.generateAIResponseForComment));

module.exports = router;
