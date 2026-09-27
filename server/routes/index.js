const { Router } = require('express');

/** Every API route. Paths are kept as the client already calls them. */
const router = Router();
router.use(require('./auth'));
router.use(require('./notes'));
router.use(require('./doubts'));
router.use(require('./videos'));
router.use(require('./forum'));
router.use(require('./learning'));
router.use(require('./agent'));

module.exports = router;
