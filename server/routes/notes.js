const { Router } = require('express');
const h = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const notes = require('../controllers/notesController');
const { aiFeature, toolGate } = require('../middleware/featureGate');

/** Notes & Quiz */
const router = Router();
router.use(['/upload-notes', '/chat-with-notes', '/summarize-notes', '/generate-quiz', '/notes', '/save-quiz-results'], requireAuth());

router.post('/upload-notes', aiLimiter, toolGate('notes', { area: 'notes' }), notes.upload.single('pdf'), h(notes.uploadNotes));
router.post('/chat-with-notes', aiLimiter, aiFeature('notes.chat'), h(notes.chatWithNotes));
router.post('/summarize-notes', aiLimiter, aiFeature('notes.summary'), h(notes.summarizeNotes));
router.post('/generate-quiz', aiLimiter, aiFeature('notes.quiz'), h(notes.generateQuiz));
router.get('/notes/:userId', h(notes.getUserNotes));
router.delete('/notes/:noteId', h(notes.deleteNote));
router.post('/save-quiz-results', h(notes.saveQuizResults));

module.exports = router;
