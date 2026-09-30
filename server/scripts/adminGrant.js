/**
 * Give an account a role in the admin console.
 *
 *   npm run admin:grant --prefix server -- --email you@gmail.com --role superadmin
 *   npm run admin:grant --prefix server -- --email someone@gmail.com --role admin
 *   npm run admin:grant --prefix server -- --email someone@gmail.com --role student   # revoke
 *
 * The account does not have to exist yet: it is created, and gets its name and
 * picture from Google on first sign-in. The last active superadmin is protected
 * here too. Audited as "cli".
 */
const User = require('../models/user');
const { setRole } = require('../services/adminUserService');
const { ROLES } = require('../config/admin');
const { run, print } = require('./lib/cli');

run(async ({ email, role }) => {
  const address = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(address) || !ROLES.includes(role)) {
    throw new Error(`Usage: npm run admin:grant --prefix server -- --email <address> --role <${ROLES.join('|')}>`);
  }
  await User.updateOne({ email: address }, { $setOnInsert: { email: address, name: '' } }, { upsert: true });
  const user = await setRole('cli', address, role);
  print(`${user.email} is now ${user.role}${user.status === 'suspended' ? ' (the account is suspended)' : ''}.`);
});
