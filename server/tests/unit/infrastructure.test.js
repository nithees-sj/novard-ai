const mongoose = require('mongoose');
const multer = require('multer');
const { toResponse } = require('../../middleware/errorHandler');
const { HttpError, badRequest } = require('../../utils/httpError');
const { objectId, text, integer, oneOf, httpUrl } = require('../../utils/validate');
const { rateLimitWait, friendlyAIError } = require('../../ai/errors');
const { currentUserId } = require('../../middleware/auth');

describe('validators', () => {
  it('objectId accepts only 24-hex strings', () => {
    expect(objectId('64b7f0c2a1b2c3d4e5f60718')).toBe('64b7f0c2a1b2c3d4e5f60718');
    expect(() => objectId({ $ne: null })).toThrow(HttpError);
    expect(() => objectId('123')).toThrow(/valid id/);
  });

  it('text trims, collapses and bounds', () => {
    expect(text('  a \n b ', 'T')).toBe('a b');
    expect(text(' a \n b ', 'T', { collapse: false })).toBe('a \n b');
    expect(text(undefined, 'T', { required: false })).toBe('');
    expect(() => text('   ', 'Title')).toThrow('Title is required.');
    expect(() => text('abc', 'Title', { max: 2 })).toThrow('Title must be 2 characters or fewer.');
    expect(() => text({ a: 1 }, 'Title')).toThrow('Title must be text.');
  });

  it('integer and oneOf', () => {
    expect(integer('7', 'N', { min: 1, max: 9 })).toBe(7);
    expect(() => integer('7.5', 'N')).toThrow(/whole number/);
    expect(() => integer(10, 'N', { max: 9 })).toThrow(/between/);
    expect(integer(undefined, 'N', { required: false, fallback: 3 })).toBe(3);
    expect(oneOf(undefined, 'P', ['a'], { fallback: 'a' })).toBe('a');
    expect(() => oneOf('b', 'P', ['a'])).toThrow('P must be one of: a.');
  });

  it('httpUrl refuses other schemes', () => {
    expect(httpUrl('https://x.dev/a')).toBe('https://x.dev/a');
    expect(httpUrl('javascript:alert(1)')).toBeNull();
    expect(httpUrl('/relative')).toBeNull();
  });
});

describe('error responses', () => {
  it.each([
    ['HttpError', badRequest('Nope'), { status: 400, error: 'Nope', code: 'BAD_REQUEST' }],
    ['legacy status error', Object.assign(new Error('Tell us the role'), { status: 400 }), { status: 400, error: 'Tell us the role' }],
    ['multer size', new multer.MulterError('LIMIT_FILE_SIZE'), { status: 413, error: 'File is too large.' }],
    ['bad JSON', Object.assign(new SyntaxError('x'), { type: 'entity.parse.failed' }), { status: 400 }],
    ['cast error', new mongoose.Error.CastError('ObjectId', 'x', '_id'), { status: 400, error: 'Invalid _id.' }],
    ['provider 429', Object.assign(new Error('429 {"error":{"message":"Rate limit reached"}}'), { status: 429 }), { status: 429, code: 'AI_RATE_LIMITED' }],
    ['provider 401', Object.assign(new Error('401 Invalid API Key'), { status: 401 }), { status: 502, code: 'AI_UNAVAILABLE' }],
    ['unknown', new Error('db exploded: secret details'), { status: 500, error: 'Internal server error' }],
  ])('maps %s', (_, err, expected) => expect(toResponse(err)).toMatchObject(expected));

  it('hides the message of an unexposed 5xx HttpError', () => {
    expect(toResponse(new HttpError(500, 'stack details', { expose: false })).error).toBe('Internal server error');
  });
});

describe('AI error helpers', () => {
  it('reads Groq’s retry-after hint', () => {
    expect(rateLimitWait({ status: 429, message: 'Please try again in 12.3s' })).toBe(14);
    expect(rateLimitWait({ status: 429, message: 'try again in 2m5s' })).toBeNull(); // too long to wait
    expect(rateLimitWait({ status: 500, message: 'boom' })).toBeNull();
  });

  it('never shows raw provider errors', () => {
    expect(friendlyAIError({ status: 429, message: '429 x' }, 'fallback')).toMatch(/busy/);
    expect(friendlyAIError({ status: 400, message: 'A roadmap needs a target role.' }, 'fallback')).toBe('A roadmap needs a target role.');
    expect(friendlyAIError({ status: 400, message: '400 bad request from provider' }, 'fallback')).toBe('fallback');
    expect(friendlyAIError(new Error('socket hang up'), 'fallback')).toBe('fallback');
  });
});

describe('currentUserId', () => {
  const req = { user: { email: 'alice@example.com' } };
  it('returns the session’s user and checks any claimed id', () => {
    expect(currentUserId(req)).toBe('alice@example.com');
    expect(currentUserId(req, undefined, '', 'ALICE@example.com')).toBe('alice@example.com');
    expect(() => currentUserId(req, 'bob@example.com')).toThrow(/your own data/);
    expect(() => currentUserId({})).toThrow(/sign in/);
  });
});
