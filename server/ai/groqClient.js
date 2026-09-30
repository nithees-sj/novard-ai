const Groq = require('groq-sdk');
const { env } = require('../config/env');
const { MODELS, GROQ_DEFAULTS } = require('../config/ai');
const { withRateLimitRetry } = require('./errors');
const { beforeCall } = require('./usageGuard');
const { withFailover, logged, chainFor, liveModelSettings } = require('./modelGateway');

/**
 * The one Groq client, and a helper for single-shot completions.
 * Every non-conversational AI call (summaries, quizzes, plans, keywords, ...)
 * goes through complete(), so model defaults and rate-limit retries are the
 * same everywhere, and tests can replace a single module.
 *
 * Each attempt is logged (ai/modelCallLog.js); the admin's switches and limits
 * are checked first (ai/usageGuard.js); a model whose daily quota is used up
 * fails over to the next (ai/modelGateway.js). With the settings at their
 * defaults the request is exactly what it was before.
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
  await beforeCall({ provider: 'groq' });
  const live = await liveModelSettings();
  const params = live['ai.params'];
  const request = {
    messages,
    ...GROQ_DEFAULTS,
    reasoning_effort: params.reasoningEffort,
    temperature: params.temperature ?? temperature,
    max_tokens: Math.max(64, Math.round(maxTokens * params.maxTokensScale)),
    ...(topP !== undefined ? { top_p: topP } : {}),
  };

  const completion = await withFailover(chainFor(model, live), (candidate, attempt) => withRateLimitRetry(
    () => logged({ provider: 'groq', model: candidate, attempt, routedBy: candidate === model ? 'default' : 'failover' }, async () => {
      // The SDK's own retries (429 with retry-after, 5xx) are kept, as before.
      const result = await groq.chat.completions.create({ ...request, model: candidate });
      return { result, tokensIn: result.usage?.prompt_tokens || 0, tokensOut: result.usage?.completion_tokens || 0 };
    }),
    { retries: 1 }
  ), { serverTries: 1 });
  return completion.choices[0]?.message?.content || '';
}

module.exports = { complete, groq };
