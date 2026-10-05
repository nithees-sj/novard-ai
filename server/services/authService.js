const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { env } = require('../config/env');
const { ADMIN_ROLES } = require('../config/admin');
const { unauthorized, forbidden, upstreamError } = require('../utils/httpError');
const logger = require('../utils/logger');

/**
 * Sign-in: the browser gets a Google OAuth access token (implicit flow) and
 * sends it here once. We ask Google whether the token is valid, was issued to
 * *our* OAuth client (otherwise a token from any other Google app could be
 * replayed here) and belongs to a verified email. Then we issue our own
 * short-lived session token, which every other API call carries as
 * `Authorization: Bearer <token>`.
 */

const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GOOGLE_TIMEOUT_MS = 8000;
const JWT_OPTIONS = { issuer: 'novard-ai', audience: 'novard-ai-web', algorithm: 'HS256' };
// Admin console sessions are a different audience: a student token never
// passes an admin check, and an admin token is never a student session.
const ADMIN_JWT_OPTIONS = { ...JWT_OPTIONS, audience: 'novard-ai-admin' };

const SUSPENDED_MESSAGE = 'Your Novard-AI account has been suspended. If you think this is a mistake, please contact support.';

async function googleJson(url, options = {}) {
  const operation = url.startsWith(TOKENINFO_URL) ? 'tokeninfo' : 'userinfo';
  const started = Date.now();
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS) });
  } catch (error) {
    gatewayEvent({ operation, outcome: 'fail', latencyMs: Date.now() - started, error });
    throw upstreamError('Could not reach Google to verify your sign-in. Please try again.', { cause: error });
  }
  const body = await response.json().catch(() => ({}));
  // A 4xx is Google working and turning down a bad or expired token, not Google failing.
  const outcome = response.ok ? 'ok' : response.status < 500 ? 'rejected' : 'fail';
  gatewayEvent({ operation, outcome, latencyMs: Date.now() - started, area: 'sign-in' });
  return { ok: response.ok, body };
}

/** Sign-in success/failure counts for the admin console's Google OAuth page. */
function gatewayEvent(event) {
  // Required lazily: this module loads before the settings layer in some tests.
  require('./gatewayEvents').record({ gateway: 'oauth', area: 'sign-in', ...event });
}

/** Verify a Google access token and return the account it belongs to. */
async function verifyGoogleAccessToken(accessToken) {
  const info = await googleJson(`${TOKENINFO_URL}?access_token=${encodeURIComponent(accessToken)}`);
  if (!info.ok) throw unauthorized('Google sign-in could not be verified. Please sign in again.');

  const { aud, azp, email } = info.body;
  if (!env.googleClientIds.includes(aud) && !env.googleClientIds.includes(azp)) {
    logger.warn('Rejected a Google token issued to another client', { aud, azp });
    throw unauthorized('This sign-in was not issued for Novard-AI.');
  }
  if (!email || String(info.body.email_verified) !== 'true') {
    throw unauthorized('Your Google account email is not verified.');
  }

  // Name and picture are cosmetic; sign-in still works if this call fails.
  const profile = await googleJson(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
    .catch(() => ({ ok: false, body: {} }));

  return {
    email,
    name: profile.ok ? String(profile.body.name || '') : '',
    picture: profile.ok ? String(profile.body.picture || '') : '',
  };
}

/** Create the account on first sign-in. An existing account keeps the name the student set on their profile. */
async function upsertUser({ email, name, picture }) {
  const update = { $setOnInsert: { email, name, picture } };
  let user;
  try {
    user = await User.findOneAndUpdate({ email }, update, { upsert: true, new: true }).lean();
  } catch (error) {
    // Two sign-ins racing on the unique email index: the other one created it.
    if (error?.code !== 11000) throw error;
    user = await User.findOne({ email }).lean();
  }
  return bootstrapSuperadmin(user);
}

/**
 * SUPERADMIN_EMAILS: these accounts become superadmin when they sign in, so the
 * first admin can be created without touching the database.
 */
async function bootstrapSuperadmin(user) {
  if (!user || user.role === 'superadmin' || !env.superadminEmails.includes(String(user.email).toLowerCase())) return user;
  const updated = await User.findOneAndUpdate(
    { _id: user._id },
    { $set: { role: 'superadmin', status: 'active' }, $unset: { suspendedAt: 1, suspendedReason: 1 } },
    { new: true }
  ).lean();
  // Required lazily: the audit service is not needed by the student sign-in path otherwise.
  await require('./auditService').record({
    actor: 'env',
    action: 'user.role.bootstrap',
    target: { type: 'user', id: user.email },
    before: { role: user.role || 'student', status: user.status || 'active' },
    after: { role: 'superadmin', status: 'active' },
  });
  logger.info('SUPERADMIN_EMAILS: promoted an account to superadmin', { email: user.email });
  return updated;
}

function issueSessionToken({ email, name }) {
  return jwt.sign({ name: name || '' }, env.jwtSecret, { ...JWT_OPTIONS, subject: email, expiresIn: env.jwtExpiresIn });
}

/** @returns {{ email: string, name: string }} or throws when invalid or expired. */
function verifySessionToken(token) {
  const payload = jwt.verify(token, env.jwtSecret, {
    issuer: JWT_OPTIONS.issuer,
    audience: JWT_OPTIONS.audience,
    algorithms: [JWT_OPTIONS.algorithm],
  });
  if (!payload.sub) throw new Error('Session token has no subject');
  return { email: payload.sub, name: payload.name || '' };
}

function issueAdminToken({ email, name, role }) {
  return jwt.sign({ name: name || '', role }, env.jwtSecret, { ...ADMIN_JWT_OPTIONS, subject: email, expiresIn: env.adminJwtExpiresIn });
}

/**
 * @returns {{ email: string, name: string, role: string }} from an admin token.
 * The role in the token is a hint only: requireAdmin re-reads it from the DB.
 */
function verifyAdminToken(token) {
  const payload = jwt.verify(token, env.jwtSecret, {
    issuer: ADMIN_JWT_OPTIONS.issuer,
    audience: ADMIN_JWT_OPTIONS.audience,
    algorithms: [ADMIN_JWT_OPTIONS.algorithm],
  });
  if (!payload.sub) throw new Error('Admin token has no subject');
  return { email: payload.sub, name: payload.name || '', role: payload.role || '' };
}

const publicUser = (user, fallback = {}) => ({
  name: user?.name || fallback.name || '',
  email: user?.email || fallback.email,
  picture: user?.picture || fallback.picture || '',
  mobile: user?.mobile || '',
  bio: user?.bio || '',
  role: user?.role || 'student',
  theme: user?.theme || null,
});

const suspended = () => forbidden(SUSPENDED_MESSAGE, { code: 'ACCOUNT_SUSPENDED' });

const isActiveAdmin = (user) => Boolean(user) && ADMIN_ROLES.includes(user.role) && user.status !== 'suspended';

/**
 * Exchange a Google access token for a Novard-AI session. One sign-in for
 * everyone: an active admin also gets an admin console session (`admin`), so
 * "Continue with Google" is all an admin needs. Students get exactly the
 * session they always did.
 */
async function signInWithGoogle(accessToken) {
  const account = await verifyGoogleAccessToken(accessToken);
  const user = await upsertUser(account);
  if (user?.status === 'suspended') throw suspended();
  const profile = publicUser(user, account);
  return {
    token: issueSessionToken(profile),
    user: profile,
    ...(isActiveAdmin(user) ? { admin: { token: issueAdminToken(profile), admin: profile } } : {}),
  };
}

/**
 * An admin console session for someone already signed in to the app (their
 * admin token expired, but their app session did not). The role is read from
 * the database, never from the token.
 */
async function adminSessionFor(email) {
  const user = await User.findOne({ email }).lean();
  if (user?.status === 'suspended') throw suspended();
  if (!isActiveAdmin(user)) throw forbidden('This account is not a Novard-AI admin.', { code: 'NOT_ADMIN' });
  const profile = publicUser(user);
  return { token: issueAdminToken(profile), admin: profile };
}

/**
 * Admin console sign-in: the same Google OAuth client, then the role is
 * checked on the server. A non-admin never receives an admin token.
 */
async function signInAsAdmin(accessToken) {
  const account = await verifyGoogleAccessToken(accessToken);
  const user = await upsertUser(account);
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    logger.warn('Admin sign-in refused: not an admin', { email: account.email });
    throw forbidden('This Google account is not a Novard-AI admin. Ask a superadmin to grant you access.', { code: 'NOT_ADMIN' });
  }
  if (user.status !== 'active') {
    throw forbidden('This admin account is suspended.', { code: 'ACCOUNT_SUSPENDED' });
  }
  const profile = publicUser(user, account);
  return { token: issueAdminToken(profile), admin: profile };
}

module.exports = {
  signInWithGoogle,
  signInAsAdmin,
  adminSessionFor,
  verifyGoogleAccessToken,
  issueSessionToken,
  verifySessionToken,
  issueAdminToken,
  verifyAdminToken,
  publicUser,
  SUSPENDED_MESSAGE,
};
