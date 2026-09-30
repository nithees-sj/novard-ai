const users = require('../../services/adminUserService');
const { objectId } = require('../../utils/validate');

const target = (req) => objectId(req.params.id, 'user id');

/** POST /api/admin/users/:id/role {role} (superadmin) -> {user} */
exports.setRole = async (req, res) => {
  res.json({ user: await users.setRole(req.admin, target(req), req.body?.role, { ip: req.ip }) });
};

/** POST /api/admin/users/:id/suspend {reason?} -> {user} */
exports.suspend = async (req, res) => {
  res.json({ user: await users.suspend(req.admin, target(req), { reason: req.body?.reason, ip: req.ip }) });
};

/** POST /api/admin/users/:id/reactivate -> {user} */
exports.reactivate = async (req, res) => {
  res.json({ user: await users.reactivate(req.admin, target(req), { ip: req.ip }) });
};

/** POST /api/admin/users/:id/reset-quota -> {user} */
exports.resetQuota = async (req, res) => {
  res.json({ user: await users.resetQuota(req.admin, target(req), { ip: req.ip }) });
};
