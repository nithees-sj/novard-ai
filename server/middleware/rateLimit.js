const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { env } = require('../config/env');
const { HttpError } = require('../utils/httpError');

/**
 * Three budgets:
 *   api   every request, per IP           - stops floods and scraping
 *   ai    AI-backed requests, per student - each one costs model tokens
 *   auth  sign-in attempts, per IP        - stops token-guessing
 * Limits are configurable (see .env.example); tests turn them off.
 */

const limiter = ({ limit, windowMs = env.rateLimit.windowMs, message, keyGenerator }) => rateLimit({
  windowMs,
  limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest && !process.env.RATE_LIMIT_IN_TESTS,
  ...(keyGenerator ? { keyGenerator } : {}),
  handler: (req, res, next) => next(new HttpError(429, message, { code: 'RATE_LIMITED' })),
});

const apiLimiter = limiter({
  limit: env.rateLimit.apiPerMinute,
  message: 'Too many requests. Please slow down and try again in a minute.',
});

const aiLimiter = limiter({
  limit: env.rateLimit.aiPerMinute,
  message: 'You are sending AI requests very quickly. Please wait a minute and try again.',
  keyGenerator: (req) => (req.user?.email ? `user:${req.user.email}` : ipKeyGenerator(req.ip)),
});

const authLimiter = limiter({
  limit: env.rateLimit.authPer15Minutes,
  windowMs: 15 * 60 * 1000,
  message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
});

module.exports = { apiLimiter, aiLimiter, authLimiter };
