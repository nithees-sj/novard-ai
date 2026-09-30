const path = require('path');
const crypto = require('crypto');

/**
 * Environment configuration, read once and validated at startup.
 *
 * `.env` is loaded from the server directory (not the working directory), so
 * `node server/server.js` from the repo root finds it too. Tests never load
 * it: they must not pick up real API keys or the developer's database.
 */

const SERVER_ROOT = path.resolve(__dirname, '..');

if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config({ path: path.join(SERVER_ROOT, '.env') });
}

const list = (value) => String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
const int = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

// Outside production a missing JWT_SECRET falls back to a random per-process
// secret, so a fresh checkout still runs; sessions then end on every restart.
const configuredJwtSecret = process.env.JWT_SECRET || '';
const jwtSecret = configuredJwtSecret || (isProduction ? '' : crypto.randomBytes(48).toString('hex'));

/** "1", "2", "true", "false" or unset -> the value Express's `trust proxy` expects. */
function trustProxy(value) {
  if (value === undefined || value === '') return isProduction ? 1 : false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return int(value, false);
}

const env = Object.freeze({
  nodeEnv,
  isProduction,
  isTest,
  serverRoot: SERVER_ROOT,
  port: int(process.env.PORT, 5000),
  mongoUri: process.env.MONGO_URI || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  // Either name: the code has always read GEMINI_API_KEY while Docker/Cloud Run pass GOOGLE_API_KEY.
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
  jwtSecret,
  jwtSecretGenerated: !configuredJwtSecret && !isProduction,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // Admin console sessions are separate tokens with a shorter lifetime.
  adminJwtExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '12h',
  // These accounts become superadmin when they sign in (bootstrap the first admin).
  superadminEmails: list(process.env.SUPERADMIN_EMAILS).map((e) => e.toLowerCase()),
  // Shared secret for Cloud Scheduler's POST /api/internal/risk/rescan. Unset = endpoint disabled.
  riskCronSecret: process.env.RISK_CRON_SECRET || '',
  // How long runtime settings are cached per instance before checking for changes.
  settingsCacheMs: int(process.env.SETTINGS_CACHE_MS, isTest ? 0 : 30000),
  // The Google OAuth client ID(s) whose sign-in tokens this API accepts.
  googleClientIds: list(process.env.GOOGLE_CLIENT_ID),
  // Browser origins allowed to call the API. Empty = any origin (the API uses
  // bearer tokens, not cookies, so this is not a CSRF control).
  corsOrigins: list(process.env.CORS_ORIGINS),
  trustProxy: trustProxy(process.env.TRUST_PROXY),
  uploadDir: path.resolve(SERVER_ROOT, process.env.UPLOAD_DIR || 'uploads'),
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || '1mb',
  rateLimit: {
    windowMs: 60 * 1000,
    apiPerMinute: int(process.env.RATE_LIMIT_API_PER_MINUTE, 300),
    aiPerMinute: int(process.env.RATE_LIMIT_AI_PER_MINUTE, 30),
    authPer15Minutes: int(process.env.RATE_LIMIT_AUTH_PER_15_MIN, 30),
    adminAuthPer15Minutes: int(process.env.RATE_LIMIT_ADMIN_AUTH_PER_15_MIN, 10),
  },
});

/** Names of required variables that are missing. */
function missingEnv() {
  const missing = [];
  if (!env.mongoUri) missing.push('MONGO_URI');
  if (!env.groqApiKey) missing.push('GROQ_API_KEY');
  if (!env.jwtSecret) missing.push('JWT_SECRET');
  if (!env.googleClientIds.length) missing.push('GOOGLE_CLIENT_ID');
  return missing;
}

module.exports = { env, missingEnv };
