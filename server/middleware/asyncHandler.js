/**
 * Express 4 does not catch rejected promises from async handlers: the request
 * just hangs. Wrapping a handler forwards any rejection to the error handler.
 */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
