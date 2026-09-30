const GatewayEvent = require('../models/gatewayEvent');
const settings = require('./settingsService');
const { currentAi } = require('../ai/aiContext');
const { HttpError } = require('../utils/httpError');
const logger = require('../utils/logger');

/**
 * Logging for the non-AI outside services (YouTube, Google sign-in, PDF
 * reading) and the YouTube on/off switch. Recording never blocks or breaks
 * the caller.
 */

/** Save one event. Fire-and-forget: returns a promise that never rejects. */
function record({ gateway, operation, outcome, latencyMs = 0, error, area }) {
  return GatewayEvent.create({
    gateway,
    operation,
    outcome,
    latencyMs,
    area: area ?? currentAi().area,
    error: error ? String(error.message || error).slice(0, 200) : undefined,
  }).catch((e) => logger.warn('Could not record a gateway event', { error: e.message }));
}

/**
 * Time `fn`, record ok/fail, and return its result (or rethrow its error).
 * `classify(result)` may turn a successful call into 'missing' (e.g. no captions).
 */
async function track({ gateway, operation, classify }, fn) {
  const started = Date.now();
  try {
    const result = await fn();
    record({ gateway, operation, outcome: classify ? classify(result) : 'ok', latencyMs: Date.now() - started });
    return result;
  } catch (error) {
    record({ gateway, operation, outcome: 'fail', latencyMs: Date.now() - started, error });
    throw error;
  }
}

const YOUTUBE_OFF = 'YouTube features are temporarily unavailable. Please try again later.';

/** Throws a friendly 503 when an admin has switched YouTube off. */
async function assertYoutubeEnabled(operation) {
  const { enabled } = await settings.get('gateways.youtube');
  if (enabled) return;
  record({ gateway: 'youtube', operation, outcome: 'disabled' });
  throw new HttpError(503, YOUTUBE_OFF, { code: 'YOUTUBE_DISABLED' });
}

module.exports = { record, track, assertYoutubeEnabled, YOUTUBE_OFF };
