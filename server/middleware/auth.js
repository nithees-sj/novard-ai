const mongoose = require('mongoose');
const User = require('../models/user');
const { verifySessionToken, SUSPENDED_MESSAGE } = require('../services/authService');
const { unauthorized, forbidden } = require('../utils/httpError');

/**
 * Every route except sign-in and health checks requires a session.
 * The authenticated student is req.user = { email, name }; `email` is the
 * userId that every collection is keyed by.
 */

function bearerToken(req) {
  const header = req.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}

/**
 * @param {object} [options]
 * @param {boolean} [options.allowBodyToken] also accept `token` in the body, for
 *   navigator.sendBeacon, which cannot set headers (the study-time heartbeat).
 */
function requireAuth({ allowBodyToken = false } = {}) {
  return (req, res, next) => {
    const token = bearerToken(req) || (allowBodyToken && typeof req.body?.token === 'string' ? req.body.token : null);
    if (!token) return next(unauthorized('Please sign in to continue.'));
    try {
      req.user = verifySessionToken(token);
    } catch {
      return next(unauthorized('Your session has expired. Please sign in again.', { code: 'SESSION_EXPIRED' }));
    }
    // A suspended account is signed out on its next request (one indexed read).
    if (mongoose.connection.readyState !== 1) return next();
    return User.findOne({ email: req.user.email }).select('status').lean()
      .then((user) => next(user?.status === 'suspended' ? forbidden(SUSPENDED_MESSAGE, { code: 'ACCOUNT_SUSPENDED' }) : undefined))
      .catch(next);
  };
}

const sameUser = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/**
 * The signed-in student's id. Older clients also send the user id in the URL
 * or body; if one is given it must be the student's own, so a request can
 * never be pointed at somebody else's data.
 */
function currentUserId(req, ...claimed) {
  const me = req.user?.email;
  if (!me) throw unauthorized('Please sign in to continue.');
  claimed.forEach((value) => {
    if (value !== undefined && value !== null && value !== '' && !sameUser(value, me)) {
      throw forbidden('You can only access your own data.');
    }
  });
  return me;
}

module.exports = { requireAuth, currentUserId, sameUser, bearerToken };
