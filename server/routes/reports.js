const { Router } = require('express');
const h = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const { toolGate, aiFeature } = require('../middleware/featureGate');
const { checkQuotaFirst } = require('../services/reportService');
const reports = require('../controllers/reportController');
const notifications = require('../controllers/notificationController');

const router = Router();
router.use(['/api/reports', '/api/notifications'], requireAuth());

// Order matters: the quota is checked before multer parses (and stores) any upload.
router.post(
  '/api/reports',
  aiLimiter,
  toolGate('reports'),
  // Enrichment and transcription are logged under the student; reporting never uses up their AI quota.
  aiFeature('reports.enrich', { gate: false, quota: false }),
  checkQuotaFirst(),
  reports.upload,
  h(reports.create)
);
router.get('/api/reports/mine', h(reports.mine));
router.get('/api/reports/:ref', h(reports.get));
router.post('/api/reports/:ref/notes', h(reports.addNote));
router.get('/api/reports/:ref/attachments/:n', h(reports.attachment));

router.get('/api/notifications', h(notifications.list));
router.post('/api/notifications/read', h(notifications.markRead));

module.exports = router;
