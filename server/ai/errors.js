/**
 * Handling for errors from the AI providers (Groq, Gemini).
 *
 * Groq's free tier allows a few thousand tokens per minute per model. When a
 * request is refused with "try again in 12.3s", waiting that long and retrying
 * is almost always enough, and far better than failing the student's message.
 */

const MAX_RATE_LIMIT_WAIT_S = 30;
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** Seconds to wait before retrying a rate-limited request, or null if it is not one (or the wait is too long). */
function rateLimitWait(error) {
  const text = String(error?.message || '');
  if (error?.status !== 429 && !/rate limit/i.test(text)) return null;
  const match = text.match(/try again in (?:(\d+)m)?([\d.]+)s/i);
  const seconds = match ? (Number(match[1] || 0) * 60 + Number(match[2])) : 10;
  return seconds <= MAX_RATE_LIMIT_WAIT_S ? Math.ceil(seconds) + 1 : null;
}

/** Run fn, retrying up to `retries` times on a short rate limit. onWait(seconds) is told before each wait. */
async function withRateLimitRetry(fn, { retries = 2, onWait } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn(); // eslint-disable-line no-await-in-loop
    } catch (error) {
      const wait = rateLimitWait(error);
      if (wait === null || attempt >= retries) throw error;
      onWait?.(wait);
      await sleep(wait * 1000); // eslint-disable-line no-await-in-loop
    }
  }
}

const isRateLimit = (error) => rateLimitWait(error) !== null || error?.status === 429 || /rate limit/i.test(String(error?.message));

/**
 * A raw provider error: an SDK error whose message starts with the HTTP status
 * ("429 {...}", "401 Invalid API Key"). Never shown to the student.
 */
const isProviderError = (error) => Boolean(error?.status) && /^\d{3}\b/.test(String(error?.message || ''));

const BUSY_MESSAGE = 'The AI is busy right now (usage limit reached). Please try again in a minute.';

/** A message safe to show the student for an AI failure; never the raw provider error. */
function friendlyAIError(error, fallback) {
  // Our own errors (a report quota, a tool an admin switched off) are written for the student.
  if (error?.name === 'HttpError' && error.expose !== false) return error.message;
  if (isRateLimit(error)) return BUSY_MESSAGE;
  const own = error?.status && error.status < 500 && !isProviderError(error);
  return own ? error.message : fallback;
}

module.exports = { rateLimitWait, withRateLimitRetry, isRateLimit, isProviderError, friendlyAIError, BUSY_MESSAGE };
