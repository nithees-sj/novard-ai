const User = require('../models/user');
const audit = require('./auditService');
const { ROLES, ADMIN_ROLES } = require('../config/admin');
const { badRequest, forbidden, notFound, conflict } = require('../utils/httpError');
const { isObjectId, oneOf, text } = require('../utils/validate');

/**
 * Admin actions on accounts: roles, suspension. Every function takes the
 * acting admin ({ email, role }) and writes an audit entry.
 *
 * Rules:
 *   - only a superadmin grants or revokes admin, and acts on another admin;
 *   - nobody changes their own role or suspends themselves;
 *   - the last active superadmin can never be demoted or suspended.
 */

const isSuperadmin = (actor) => actor?.role === 'superadmin' || actor === 'cli';
const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

/** A user by id (console) or email (CLI). */
async function findUser(idOrEmail) {
  const query = isObjectId(idOrEmail) ? { _id: idOrEmail } : { email: String(idOrEmail || '').trim().toLowerCase() };
  if (!query._id && !query.email) throw badRequest('A user id is required.');
  const user = await User.findOne(query).lean();
  if (!user) throw notFound('User not found');
  return user;
}

/** Refuse a change that would leave no active superadmin. */
async function assertNotLastSuperadmin(user) {
  if (user.role !== 'superadmin' || user.status === 'suspended') return;
  const others = await User.countDocuments({ _id: { $ne: user._id }, role: 'superadmin', status: 'active' });
  if (!others) throw conflict('This is the last active superadmin. Make someone else a superadmin first.', { code: 'LAST_SUPERADMIN' });
}

const actorEmail = (actor) => (typeof actor === 'string' ? actor : actor?.email);

function assertNotSelf(actor, user, what) {
  if (same(actorEmail(actor), user.email)) throw forbidden(`You cannot ${what} your own account.`, { code: 'SELF_ACTION' });
}

const view = (u) => ({
  _id: u._id,
  name: u.name || '',
  email: u.email,
  role: u.role || 'student',
  status: u.status || 'active',
  suspendedAt: u.suspendedAt || null,
  suspendedReason: u.suspendedReason || '',
});

/** Grant or revoke admin (superadmin only). */
async function setRole(actor, idOrEmail, role, { ip } = {}) {
  if (!isSuperadmin(actor)) throw forbidden('Only a superadmin can grant or revoke admin access.', { code: 'SUPERADMIN_ONLY' });
  const next = oneOf(role, 'Role', ROLES);
  const user = await findUser(idOrEmail);
  if (actor !== 'cli') assertNotSelf(actor, user, 'change the role of');
  const current = user.role || 'student';
  if (current === next) return view(user);
  if (current === 'superadmin') await assertNotLastSuperadmin(user);

  const updated = await User.findOneAndUpdate({ _id: user._id }, { $set: { role: next } }, { new: true }).lean();
  await audit.record({
    actor,
    action: 'user.role',
    target: { type: 'user', id: user.email },
    before: { role: current },
    after: { role: next },
    ip,
  });
  return view(updated);
}

/** Suspend an account. Acting on an admin needs a superadmin. */
async function suspend(actor, idOrEmail, { reason, ip } = {}) {
  const why = text(reason, 'Reason', { required: false, max: 300 });
  const user = await findUser(idOrEmail);
  assertNotSelf(actor, user, 'suspend');
  if (ADMIN_ROLES.includes(user.role) && !isSuperadmin(actor)) {
    throw forbidden('Only a superadmin can suspend an admin.', { code: 'SUPERADMIN_ONLY' });
  }
  if (user.status === 'suspended') return view(user);
  await assertNotLastSuperadmin(user);

  const updated = await User.findOneAndUpdate(
    { _id: user._id },
    { $set: { status: 'suspended', suspendedAt: new Date(), suspendedReason: why } },
    { new: true }
  ).lean();
  await audit.record({
    actor,
    action: 'user.suspend',
    target: { type: 'user', id: user.email },
    before: { status: 'active' },
    after: { status: 'suspended', reason: why },
    ip,
  });
  return view(updated);
}

/** Reactivate a suspended account. Acting on an admin needs a superadmin. */
async function reactivate(actor, idOrEmail, { ip } = {}) {
  const user = await findUser(idOrEmail);
  if (ADMIN_ROLES.includes(user.role) && !isSuperadmin(actor)) {
    throw forbidden('Only a superadmin can reactivate an admin.', { code: 'SUPERADMIN_ONLY' });
  }
  if (user.status !== 'suspended') return view(user);
  const updated = await User.findOneAndUpdate(
    { _id: user._id },
    { $set: { status: 'active' }, $unset: { suspendedAt: 1, suspendedReason: 1 } },
    { new: true }
  ).lean();
  await audit.record({
    actor,
    action: 'user.reactivate',
    target: { type: 'user', id: user.email },
    before: { status: 'suspended', reason: user.suspendedReason || '' },
    after: { status: 'active' },
    ip,
  });
  return view(updated);
}

module.exports = { findUser, setRole, suspend, reactivate, view };
