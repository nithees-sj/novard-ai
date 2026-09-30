const { Router } = require('express');
const h = require('../middleware/asyncHandler');
const status = require('../controllers/appStatusController');

const router = Router();

// Public: the landing page shows maintenance mode before anyone signs in.
router.get('/api/app-status', h(status.get));

module.exports = router;
