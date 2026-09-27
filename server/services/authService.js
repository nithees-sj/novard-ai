const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { env } = require('../config/env');
const { unauthorized, upstreamError } = require('../utils/httpError');
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

async function googleJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS) });
  } catch (error) {
    throw upstreamError('Could not reach Google to verify your sign-in. Please try again.', { cause: error });
  }
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, body };
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
  try {
    return await User.findOneAndUpdate({ email }, update, { upsert: true, new: true }).lean();
  } catch (error) {
    // Two sign-ins racing on the unique email index: the other one created it.
    if (error?.code === 11000) return User.findOne({ email }).lean();
    throw error;
  }
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

const publicUser = (user, fallback = {}) => ({
  name: user?.name || fallback.name || '',
  email: user?.email || fallback.email,
  picture: user?.picture || fallback.picture || '',
  mobile: user?.mobile || '',
  bio: user?.bio || '',
});

/** Exchange a Google access token for a Novard-AI session. */
async function signInWithGoogle(accessToken) {
  const account = await verifyGoogleAccessToken(accessToken);
  const user = await upsertUser(account);
  const profile = publicUser(user, account);
  return { token: issueSessionToken(profile), user: profile };
}

module.exports = { signInWithGoogle, verifyGoogleAccessToken, issueSessionToken, verifySessionToken, publicUser };
