const { Router } = require('express');
const h = require('../../middleware/asyncHandler');
const { requireAdmin, requireSuperadmin } = require('../../middleware/adminAuth');
const { adminAuthLimiter } = require('../../middleware/rateLimit');
const auth = require('../../controllers/admin/authController');
const settings = require('../../controllers/admin/settingsController');
const audit = require('../../controllers/admin/auditController');
const users = require('../../controllers/admin/usersController');
const reports = require('../../controllers/admin/reportsController');

/**
 * The admin console API. Sign-in is the only route without an admin session;
 * everything else re-checks the admin's role and status in the database.
 */
const router = Router();

router.post('/api/admin/auth/google', adminAuthLimiter, h(auth.googleSignIn));

router.use('/api/admin', requireAdmin());

router.get('/api/admin/auth/me', h(auth.me));

router.get('/api/admin/settings', h(settings.list));
router.put('/api/admin/settings/:key', h(settings.update));

router.get('/api/admin/audit-log', h(audit.list));

router.post('/api/admin/users/:id/role', requireSuperadmin(), h(users.setRole));
router.post('/api/admin/users/:id/suspend', h(users.suspend));
router.post('/api/admin/users/:id/reactivate', h(users.reactivate));
router.post('/api/admin/users/:id/reset-quota', h(users.resetQuota));

router.get('/api/admin/reports', h(reports.list));
router.post('/api/admin/reports/resolve', h(reports.resolve));
router.get('/api/admin/reports/:ref', h(reports.get));
router.get('/api/admin/reports/:ref/attachments/:n', h(reports.attachment));
router.post('/api/admin/reports/:ref/reporter-email', h(reports.revealEmail));
router.post('/api/admin/reports/:ref/status', h(reports.setStatus));
router.post('/api/admin/reports/:ref/notes', h(reports.addNote));
router.post('/api/admin/reports/:ref/assign', h(reports.assign));
router.post('/api/admin/areas/:area/resolve', h(reports.resolveArea));

module.exports = router;
