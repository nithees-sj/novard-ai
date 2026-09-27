const { Router } = require('express');
const h = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const doubts = require('../controllers/doubtController');

/** Doubt Clearance */
const router = Router();
router.use([
  '/doubt-clearances', '/chat-with-doubt-clearance', '/summarize-doubt-clearance',
  '/generate-doubt-quiz', '/save-doubt-quiz-results', '/get-youtube-recommendations',
], requireAuth());

router.get('/doubt-clearances/:userId', h(doubts.list));
router.post('/doubt-clearances', aiLimiter, h(doubts.create));
router.delete('/doubt-clearances/:doubtId', h(doubts.remove));
router.post('/chat-with-doubt-clearance', aiLimiter, h(doubts.chat));
router.post('/summarize-doubt-clearance', aiLimiter, h(doubts.summarize));
router.post('/generate-doubt-quiz', aiLimiter, h(doubts.generateQuiz));
router.post('/save-doubt-quiz-results', h(doubts.saveQuizResults));
router.post('/get-youtube-recommendations', aiLimiter, h(doubts.recommendVideos));

module.exports = router;
