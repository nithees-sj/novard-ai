const { Router } = require('express');
const h = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const requests = require('../controllers/videoRequestController');
const summarizer = require('../controllers/videoSummarizerController');

const router = Router();
router.use([
  '/educational-video-requests', '/recommend-educational-videos',
  '/youtube-videos', '/chat-with-youtube-video', '/summarize-youtube-video',
  '/generate-youtube-quiz', '/save-youtube-quiz-results',
], requireAuth());

// Video Library: learning requests and their recommended videos
router.get('/educational-video-requests/:userId', h(requests.list));
router.post('/educational-video-requests', h(requests.create));
router.delete('/educational-video-requests/:videoRequestId', h(requests.remove));
router.post('/recommend-educational-videos', aiLimiter, h(requests.recommend));

// Video Summarizer: YouTube videos with chat, summary and quizzes
router.post('/youtube-videos', aiLimiter, h(summarizer.create));
router.get('/youtube-videos/:userId', h(summarizer.list));
router.delete('/youtube-videos/:videoId', h(summarizer.remove));
router.post('/chat-with-youtube-video', aiLimiter, h(summarizer.chat));
router.post('/summarize-youtube-video', aiLimiter, h(summarizer.summarize));
router.post('/generate-youtube-quiz', aiLimiter, h(summarizer.generateQuiz));
router.post('/save-youtube-quiz-results', h(summarizer.saveQuizResults));

module.exports = router;
