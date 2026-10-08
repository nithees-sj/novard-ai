const { Router } = require('express');
const h = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const { aiFeature } = require('../middleware/featureGate');
const notes = require('../controllers/notesController');
const exams = require('../controllers/examController');

/**
 * Exam Autopilot. Reading the syllabus and writing quizzes are AI routes
 * (switch, quota, token limit); the plan itself is computed, so following it,
 * grading and re-planning always work. A syllabus PDF is checked before it is
 * stored, and saved as a note.
 */
const router = Router();
router.use('/api/exams', requireAuth());

router.post('/api/exams/draft', aiLimiter, aiFeature('exam.syllabus'), notes.upload.single('pdf'), h(exams.draft));
router.get('/api/exams', h(exams.list));
router.get('/api/exams/:id', h(exams.get));
router.post('/api/exams/:id/activate', h(exams.activate));
router.patch('/api/exams/:id', h(exams.update));
router.delete('/api/exams/:id', h(exams.remove));
router.patch('/api/exams/:id/tasks/:taskId', h(exams.setTask));
router.post('/api/exams/:id/tasks/:taskId/quiz', aiLimiter, aiFeature('exam.quiz'), h(exams.taskQuiz));
router.post('/api/exams/:id/mock', aiLimiter, aiFeature('exam.quiz'), h(exams.mock));
router.get('/api/exams/:id/quizzes/:quizId', h(exams.getQuiz));
router.post('/api/exams/:id/tutor', aiLimiter, aiFeature('exam.tutor'), h(exams.tutor));
router.delete('/api/exams/:id/tutor', h(exams.clearTutor));
router.post('/api/exams/:id/quizzes/:quizId/submit', h(exams.submitQuiz));

module.exports = router;
