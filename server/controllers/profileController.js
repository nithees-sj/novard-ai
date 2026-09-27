const { buildProfileOverview, readTzOffset } = require('../services/profileService');
const { currentUserId } = require('../middleware/auth');

/** GET /api/profile/:userId/overview?tzOffset=<minutes> - everything the profile page shows. */
exports.getProfileOverview = async (req, res) => {
  const userId = currentUserId(req, req.params.userId);
  res.json(await buildProfileOverview(userId, readTzOffset(req.query.tzOffset)));
};
