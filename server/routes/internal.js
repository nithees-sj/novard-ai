const { Router } = require('express');
const h = require('../middleware/asyncHandler');
const { authLimiter } = require('../middleware/rateLimit');
const internal = require('../controllers/internalController');

const router = Router();

// Machine-to-machine (Cloud Scheduler): its own shared secret, not a user session.
router.post('/api/internal/risk/rescan', authLimiter, h(internal.rescan));

module.exports = router;
