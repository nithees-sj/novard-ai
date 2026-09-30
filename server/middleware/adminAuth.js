const User = require('../models/user');
const { verifyAdminToken } = require('../services/authService');
const { bearerToken } = require('./auth');
const { ADMIN_ROLES } = require('../config/admin');
const { unauthorized, forbidden } = require('../utils/httpError');

/**
 * Admin console access.
 *
 * The admin token proves who is calling; the role and status are then read
 * from the database on every request (one indexed lookup), so an admin who is
 * demoted or suspended loses access immediately, not when the token expires.
 * The authenticated admin is req.admin = { email, name, role }.
 */

const revoked = () => unauthorized('Your admin access has changed. Please sign in to the admin console again.', { code: 'ADMIN_REVOKED' });

function requireAdmin() {
  return async (req, res, next) => {
    const token = bearerToken(req);
    if (!token) return next(unauthorized('Please sign in to the admin console.', { code: 'ADMIN_SIGN_IN' }));
    let claims;
    try {
      claims = verifyAdminToken(token);
    } catch {
      return next(unauthorized('Your admin session has expired. Please sign in again.', { code: 'SESSION_EXPIRED' }));
    }
    try {
      const user = await User.findOne({ email: claims.email }).select('email name role status').lean();
      if (!user || !ADMIN_ROLES.includes(user.role) || user.status !== 'active') return next(revoked());
      req.admin = { email: user.email, name: user.name || claims.name, role: user.role };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/** After requireAdmin: only a superadmin may continue. */
function requireSuperadmin() {
  return (req, res, next) => {
    if (!req.admin) return next(unauthorized('Please sign in to the admin console.', { code: 'ADMIN_SIGN_IN' }));
    if (req.admin.role !== 'superadmin') return next(forbidden('Only a superadmin can do this.', { code: 'SUPERADMIN_ONLY' }));
    return next();
  };
}

module.exports = { requireAdmin, requireSuperadmin };
