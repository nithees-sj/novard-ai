const { Router } = require('express');
const h = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const auth = require('../controllers/authController');
const users = require('../controllers/userController');

const router = Router();

router.post('/api/auth/google', authLimiter, h(auth.googleSignIn));
router.get('/api/auth/me', requireAuth(), h(auth.me));
// An admin signed in to the app can open the console without a second sign-in.
router.post('/api/auth/admin-session', authLimiter, requireAuth(), h(auth.adminSession));
router.post('/updateUserProfile', requireAuth(), h(users.updateUserProfile));
router.put('/api/auth/preferences', requireAuth(), h(users.updatePreferences));

module.exports = router;
