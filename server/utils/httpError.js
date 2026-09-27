/**
 * Errors that carry an HTTP status. Throw one anywhere below a route and the
 * central error handler (middleware/errorHandler.js) turns it into
 *   { error: <message>, code: <CODE>, details?: <any> }
 * with that status. Messages of 4xx errors are shown to the user, so write
 * them for a student, not a developer.
 */

const CODES = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL',
  502: 'UPSTREAM_ERROR',
  503: 'UNAVAILABLE',
};

class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {{ code?: string, details?: any, cause?: Error, expose?: boolean }} [options]
   */
  constructor(status, message, { code, details, cause, expose } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code || CODES[status] || 'ERROR';
    if (details !== undefined) this.details = details;
    if (cause) this.cause = cause;
    // Our own 5xx messages (e.g. "The quiz could not be generated") are safe to show.
    this.expose = expose ?? true;
  }
}

const make = (status) => (message, options) => new HttpError(status, message, options);

module.exports = {
  HttpError,
  CODES,
  badRequest: make(400),
  unauthorized: make(401),
  forbidden: make(403),
  notFound: make(404),
  conflict: make(409),
  payloadTooLarge: make(413),
  unsupportedMediaType: make(415),
  unprocessable: make(422),
  upstreamError: make(502),
};
