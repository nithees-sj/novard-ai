const { signInAsAdmin } = require('../../services/authService');
const { text } = require('../../utils/validate');

/** POST /api/admin/auth/google {accessToken} -> {token, admin}. 403 NOT_ADMIN for anyone else. */
exports.googleSignIn = async (req, res) => {
  const accessToken = text(req.body?.accessToken, 'accessToken', { max: 4096 });
  res.json(await signInAsAdmin(accessToken));
};

/** GET /api/admin/auth/me -> {admin}. The role here is the one in the database right now. */
exports.me = async (req, res) => {
  res.json({ admin: req.admin });
};
