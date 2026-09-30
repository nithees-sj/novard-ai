const { Router } = require('express');
const h = require('../../middleware/asyncHandler');
const { requireAdmin, requireSuperadmin } = require('../../middleware/adminAuth');
const { adminAuthLimiter } = require('../../middleware/rateLimit');
const auth = require('../../controllers/admin/authController');
const settings = require('../../controllers/admin/settingsController');
const audit = require('../../controllers/admin/auditController');
const users = require('../../controllers/admin/usersController');

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

module.exports = router;
