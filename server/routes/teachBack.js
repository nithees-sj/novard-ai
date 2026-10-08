const { Router } = require('express');
const h = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const { aiFeature } = require('../middleware/featureGate');
const notes = require('../controllers/notesController');
const tb = require('../controllers/teachBackController');

/**
 * Teach-Back Arena. Uploads come after the switch, quota and token checks, so
 * nothing is stored for a request that would be refused. A PDF uploaded here
 * is saved as a note (the notes uploader), so it also appears in Notes & Quiz.
 */
const router = Router();
router.use('/api/teachback', requireAuth());

router.get('/api/teachback', h(tb.list));
router.get('/api/teachback/voice', h(tb.voice));
router.get('/api/teachback/:id', h(tb.get));
router.post('/api/teachback', aiLimiter, aiFeature('teachback.start'), notes.upload.single('pdf'), h(tb.start));
router.post('/api/teachback/:id/turns', aiLimiter, aiFeature('teachback.turn'), tb.voiceUpload, h(tb.turn));
router.post('/api/teachback/:id/finish', aiLimiter, aiFeature('teachback.grade'), h(tb.finish));
router.post('/api/teachback/:id/coach', aiLimiter, aiFeature('teachback.coach'), h(tb.coach));
router.delete('/api/teachback/:id', h(tb.remove));

module.exports = router;
