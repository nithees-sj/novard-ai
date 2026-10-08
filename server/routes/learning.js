const express = require('express');
const h = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const plans = require('../controllers/skillPlanController');
const roadmaps = require('../controllers/roadmapController');
const skillGap = require('../controllers/skillGapController');
const analytics = require('../controllers/analyticsController');
const profile = require('../controllers/profileController');
const quizHistory = require('../controllers/quizHistoryController');
const usage = require('../controllers/usageController');
const { aiFeature, toolGate } = require('../middleware/featureGate');

/** Skill Unlocker, career tools, analytics, profile, quiz history and study time. */
const router = express.Router();

// Study-time heartbeat: navigator.sendBeacon posts text/plain JSON with the token in the body.
router.post(
  '/api/usage/heartbeat',
  express.text({ type: 'text/plain', limit: '2kb' }),
  (req, res, next) => {
    if (typeof req.body !== 'string') return next();
    try {
      req.body = JSON.parse(req.body || '{}');
      return next();
    } catch {
      return res.status(400).json({ error: 'Invalid body', code: 'BAD_REQUEST' });
    }
  },
  requireAuth({ allowBodyToken: true }),
  h(usage.recordUsage),
);

router.use([
  '/api/skill-unlocker', '/api/roadmaps', '/api/skill-gap',
  '/api/analytics', '/api/profile', '/api/quiz-history',
], requireAuth());

// Skill Unlocker
router.post('/api/skill-unlocker/generate-plan', aiLimiter, aiFeature('skillplan.create'), h(plans.generatePlan));
router.post('/api/skill-unlocker/generate-quiz', aiLimiter, aiFeature('skillplan.quiz'), h(plans.generateQuiz));
router.get('/api/skill-unlocker/plans/:userId', h(plans.getUserPlans));
router.post('/api/skill-unlocker/save-quiz-result', h(plans.saveQuizResult));
router.post('/api/skill-unlocker/toggle-day-completion', h(plans.toggleDayCompletion)); // refused: days complete by quiz
router.post('/api/skill-unlocker/day-quiz', aiLimiter, aiFeature('skillplan.quiz'), h(plans.startDayQuiz));
router.post('/api/skill-unlocker/day-quiz/submit', h(plans.submitDayQuiz));
router.delete('/api/skill-unlocker/plans/:planId', h(plans.deletePlan));
router.post('/api/skill-unlocker/refresh-video', aiLimiter, toolGate('skillUnlocker', { area: 'skill-unlocker' }), h(plans.refreshVideo));

// Smart Roadmap
router.post('/api/roadmaps/generate', aiLimiter, aiFeature('roadmap.generate'), h(roadmaps.generate));
router.get('/api/roadmaps/user/:userId', h(roadmaps.listForUser));
router.get('/api/roadmaps/:id', h(roadmaps.getOne));
router.delete('/api/roadmaps/:id', h(roadmaps.remove));

// Skill Gap coach
router.post('/api/skill-gap/sessions', aiLimiter, aiFeature('skillgap.analyse'), h(skillGap.createSession));
router.get('/api/skill-gap/sessions/user/:userId', h(skillGap.listSessions));
router.get('/api/skill-gap/sessions/:id', h(skillGap.getSession));
router.post('/api/skill-gap/sessions/:id/messages', aiLimiter, aiFeature('skillgap.coach'), h(skillGap.sendMessage));
router.delete('/api/skill-gap/sessions/:id', h(skillGap.deleteSession));

// Dashboard, profile and previous quiz marks
router.get('/api/analytics/:userId', h(analytics.getUserAnalytics));
router.get('/api/profile/:userId/overview', h(profile.getProfileOverview));
router.get('/api/quiz-history/:source/:itemId', h(quizHistory.getQuizHistory));

module.exports = router;
