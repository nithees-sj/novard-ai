const { Router } = require('express');
const h = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const auth = require('../controllers/authController');
const users = require('../controllers/userController');

const router = Router();

router.post('/api/auth/google', authLimiter, h(auth.googleSignIn));
router.get('/api/auth/me', requireAuth(), h(auth.me));
router.post('/updateUserProfile', requireAuth(), h(users.updateUserProfile));

module.exports = router;
