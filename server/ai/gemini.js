const { GoogleGenerativeAI } = require('@google/generative-ai');
const { MODELS, maxOutputTokens } = require('../config/ai');
const { env } = require('../config/env');
const logger = require('../utils/logger');
const { beforeCall } = require('./usageGuard');
const { logged } = require('./modelGateway');

/**
 * Gemini text generation with a fallback model.
 *
 * `gemini-flash-latest` is regularly refused with 503 "high demand" (Google's
 * capacity, not this key's quota) or 429 when the key's own limit is hit.
 * Before, that silently turned course discovery into generic placeholders.
 * Now each model is tried once more after a short pause, then the next model
 * in MODELS.GEMINI_FALLBACKS is used.
 */

const apiKey = env.geminiApiKey;
const genAI = new GoogleGenerativeAI(apiKey);

const RETRYABLE = new Set([429, 500, 503]);
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function geminiGenerate(prompt) {
  if (!apiKey) throw new Error('No Gemini API key is configured (GEMINI_API_KEY or GOOGLE_API_KEY)');
  await beforeCall({ provider: 'gemini' });
  const models = [MODELS.GEMINI, ...MODELS.GEMINI_FALLBACKS.filter((m) => m !== MODELS.GEMINI)];
  let lastError;
  let tries = 0;
  for (const name of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      tries += 1;
      try {
        // Every attempt is logged (model, tokens, latency, outcome).
        // eslint-disable-next-line no-await-in-loop
        const result = await logged({ provider: 'gemini', model: name, attempt: tries, routedBy: name === MODELS.GEMINI ? 'default' : 'fallback' }, async () => {
          const response = await genAI.getGenerativeModel({ model: name, generationConfig: { maxOutputTokens: maxOutputTokens(name) } }).generateContent(prompt);
          const usage = response.response.usageMetadata || {};
          return { result: response, tokensIn: usage.promptTokenCount || 0, tokensOut: usage.candidatesTokenCount || 0 };
        });
        if (name !== MODELS.GEMINI) logger.warn(`Gemini: ${MODELS.GEMINI} unavailable, answered by ${name}`);
        return result.response.text();
      } catch (error) {
        lastError = error;
        if (!RETRYABLE.has(error.status)) break; // e.g. 404 retired model: go straight to the next one
        if (attempt === 0) await sleep(1500); // eslint-disable-line no-await-in-loop
      }
    }
  }
  throw lastError;
}

module.exports = { geminiGenerate, hasGeminiKey: Boolean(apiKey) };
