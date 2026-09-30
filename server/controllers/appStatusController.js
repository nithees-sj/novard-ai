const { appStatus } = require('../services/appStatusService');

/** GET /api/app-status -> feature switches, maintenance and the dashboard banner. */
exports.get = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await appStatus());
};
