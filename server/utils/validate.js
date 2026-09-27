const { badRequest } = require('./httpError');

/**
 * Small input validators for request bodies, params and queries.
 *
 * Each returns the cleaned value or throws a 400 HttpError with a message the
 * student can act on. Ids are checked before they reach a query, which also
 * stops operator injection ({ "$ne": null } in place of an id).
 */

const OBJECT_ID = /^[a-f\d]{24}$/i;

const isObjectId = (value) => typeof value === 'string' && OBJECT_ID.test(value);

function objectId(value, label = 'id') {
  if (!isObjectId(value)) throw badRequest(`A valid ${label} is required.`);
  return value;
}

/** Collapse whitespace and trim. Non-strings (objects, arrays) are rejected, not stringified. */
function text(value, label, { required = true, max = 1000, min = 1, collapse = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`${label} is required.`);
    return '';
  }
  if (typeof value !== 'string' && typeof value !== 'number') throw badRequest(`${label} must be text.`);
  const out = collapse ? String(value).replace(/\s+/g, ' ').trim() : String(value).trim();
  if (required && out.length < min) {
    throw badRequest(min > 1 ? `${label} must be at least ${min} characters.` : `${label} is required.`);
  }
  if (out.length > max) throw badRequest(`${label} must be ${max} characters or fewer.`);
  return out;
}

function integer(value, label, { min = -Infinity, max = Infinity, required = true, fallback } = {}) {
  if (value === undefined || value === null || value === '') {
    if (!required) return fallback;
    throw badRequest(`${label} is required.`);
  }
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(n)) throw badRequest(`${label} must be a whole number.`);
  if (n < min || n > max) throw badRequest(`${label} must be between ${min} and ${max}.`);
  return n;
}

function number(value, label, { min = -Infinity, max = Infinity } = {}) {
  const n = typeof value === 'number' ? value : Number(value);
  if (value === null || value === '' || !Number.isFinite(n)) throw badRequest(`${label} must be a number.`);
  if (n < min || n > max) throw badRequest(`${label} must be between ${min} and ${max}.`);
  return n;
}

function oneOf(value, label, options, { fallback } = {}) {
  if ((value === undefined || value === null || value === '') && fallback !== undefined) return fallback;
  if (!options.includes(value)) throw badRequest(`${label} must be one of: ${options.join(', ')}.`);
  return value;
}

/** An http(s) URL, or null. Anything else (javascript:, data:, relative) is refused. */
function httpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

module.exports = { isObjectId, objectId, text, integer, number, oneOf, httpUrl };
