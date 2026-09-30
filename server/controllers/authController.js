const { signInWithGoogle, adminSessionFor } = require('../services/authService');
const { getProfile } = require('../services/userService');
const { text } = require('../utils/validate');

/** POST /api/auth/google {accessToken} -> {token, user} */
exports.googleSignIn = async (req, res) => {
  const accessToken = text(req.body?.accessToken, 'accessToken', { max: 4096 });
  res.json(await signInWithGoogle(accessToken));
};

/** GET /api/auth/me -> {user}. Lets the client check that its session is still valid. */
exports.me = async (req, res) => {
  res.json({ user: await getProfile(req.user.email) });
};

/** POST /api/auth/admin-session -> {token, admin} for a signed-in admin (403 NOT_ADMIN otherwise). */
exports.adminSession = async (req, res) => {
  res.json(await adminSessionFor(req.user.email));
};
