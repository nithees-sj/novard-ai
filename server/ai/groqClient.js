const Groq = require('groq-sdk');
const { env } = require('../config/env');
const { MODELS, GROQ_DEFAULTS } = require('../config/ai');
const { withRateLimitRetry } = require('./errors');

/**
 * The one Groq client, and a helper for single-shot completions.
 * Every non-conversational AI call (summaries, quizzes, plans, keywords, ...)
 * goes through complete(), so model defaults and rate-limit retries are the
 * same everywhere, and tests can replace a single module.
 */

const groq = new Groq({ apiKey: env.groqApiKey || 'missing-key' });

/**
 * @param {object} opts
 * @param {Array<{role: string, content: string}>} opts.messages
 * @param {string} [opts.model]        defaults to MODELS.FAST
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @param {number} [opts.topP]
 * @returns {Promise<string>} the reply text ('' when the model returned nothing)
 */
async function complete({ messages, model = MODELS.FAST, temperature = 0.5, maxTokens = 2000, topP }) {
  const completion = await withRateLimitRetry(() => groq.chat.completions.create({
    messages,
    model,
    ...GROQ_DEFAULTS,
    temperature,
    max_tokens: maxTokens,
    ...(topP !== undefined ? { top_p: topP } : {}),
  }), { retries: 1 });
  return completion.choices[0]?.message?.content || '';
}

module.exports = { complete };
