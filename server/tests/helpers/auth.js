const { issueSessionToken, issueAdminToken } = require('../../services/authService');

const ALICE = { email: 'alice@example.com', name: 'Alice Learner' };
const BOB = { email: 'bob@example.com', name: 'Bob Student' };
const ADA = { email: 'ada@example.com', name: 'Ada Admin' };
const ROOT = { email: 'root@example.com', name: 'Root Superadmin' };

/** `Authorization` header value for a signed-in student. */
const bearer = (user = ALICE) => `Bearer ${issueSessionToken(user)}`;

/**
 * Create an admin account (needs the test database) and return the
 * `Authorization` header for its admin console session.
 */
async function adminBearer(user = ADA, role = 'admin', extra = {}) {
  const User = require('../../models/user');
  await User.updateOne(
    { email: user.email },
    { $set: { name: user.name, role, status: 'active', ...extra } },
    { upsert: true }
  );
  return `Bearer ${issueAdminToken({ ...user, role })}`;
}

const superadminBearer = (user = ROOT) => adminBearer(user, 'superadmin');

module.exports = { ALICE, BOB, ADA, ROOT, bearer, adminBearer, superadminBearer };
