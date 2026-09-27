const multer = require('multer');
const mongoose = require('mongoose');
const { HttpError, CODES } = require('../utils/httpError');
const { isRateLimit, isProviderError, BUSY_MESSAGE } = require('../ai/errors');
const logger = require('../utils/logger');

/**
 * One error format for the whole API:
 *   { error: "<message for the user>", code: "<MACHINE_CODE>", details?: ... }
 *
 * Without this, Express replies to thrown errors with an HTML stack trace,
 * which the client's response.json() then chokes on.
 */

/** Map any thrown value to { status, error, code, details }. */
function toResponse(err) {
  if (err instanceof HttpError) {
    return {
      status: err.status,
      error: err.expose || err.status < 500 ? err.message : 'Internal server error',
      code: err.code,
      details: err.details,
    };
  }

  if (err instanceof multer.MulterError) {
    return err.code === 'LIMIT_FILE_SIZE'
      ? { status: 413, error: 'File is too large.', code: CODES[413] }
      : { status: 400, error: `Upload failed: ${err.message}`, code: CODES[400] };
  }

  // body-parser
  if (err?.type === 'entity.too.large') return { status: 413, error: 'Request body is too large.', code: CODES[413] };
  if (err?.type === 'entity.parse.failed') return { status: 400, error: 'The request body is not valid JSON.', code: CODES[400] };

  if (err instanceof mongoose.Error.CastError) {
    return { status: 400, error: `Invalid ${err.path || 'value'}.`, code: CODES[400] };
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return {
      status: 400,
      error: Object.values(err.errors).map((e) => e.message).join(' ') || 'Invalid data.',
      code: CODES[400],
    };
  }

  // AI provider errors: never show the raw provider message.
  if (isRateLimit(err)) return { status: 429, error: BUSY_MESSAGE, code: 'AI_RATE_LIMITED' };
  if (isProviderError(err)) {
    return { status: 502, error: 'The AI service is unavailable right now. Please try again.', code: 'AI_UNAVAILABLE' };
  }

  // Older code throws Object.assign(new Error(msg), { status }) - its messages are ours.
  if (Number.isInteger(err?.status) && err.status >= 400 && err.status < 600) {
    return { status: err.status, error: err.message || 'Request failed', code: CODES[err.status] || 'ERROR' };
  }

  return { status: 500, error: 'Internal server error', code: CODES[500] };
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const { status, error, code, details } = toResponse(err);

  if (status >= 500) logger.error(`${req.method} ${req.originalUrl} failed`, err);
  else logger.debug(`${req.method} ${req.originalUrl} -> ${status}: ${error}`);

  if (res.headersSent) {
    // A streamed response (the agent's SSE) has already started; just end it.
    res.end();
    return;
  }
  res.status(status).json(details === undefined ? { error, code } : { error, code, details });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}`, code: CODES[404] });
}

module.exports = { errorHandler, notFoundHandler, toResponse };
