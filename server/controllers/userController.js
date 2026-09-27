const { updateProfile } = require('../services/userService');
const { currentUserId } = require('../middleware/auth');

/** POST /updateUserProfile {name?, mobile?, bio?} -> {success, message, user, token} */
exports.updateUserProfile = async (req, res) => {
  const email = currentUserId(req, req.body.email);
  const { user, token } = await updateProfile(email, req.body);
  res.json({ success: true, message: 'Profile updated successfully', user, token });
};
