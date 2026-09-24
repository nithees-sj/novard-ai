const { GoogleGenerativeAI } = require('@google/generative-ai');
const { MODELS } = require('../config/ai');

/**
 * Gemini text generation with a fallback model.
 *
 * `gemini-flash-latest` is regularly refused with 503 "high demand" (Google's
 * capacity, not this key's quota) or 429 when the key's own limit is hit.
 * Before, that silently turned course discovery into generic placeholders.
 * Now each model is tried once more after a short pause, then the next model
 * in MODELS.GEMINI_FALLBACKS is used.
 */

// Accept either name: the code has always read GEMINI_API_KEY while the
// Docker/Cloud Run configs pass GOOGLE_API_KEY.
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const RETRYABLE = new Set([429, 500, 503]);
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function geminiGenerate(prompt) {
  const models = [MODELS.GEMINI, ...MODELS.GEMINI_FALLBACKS.filter((m) => m !== MODELS.GEMINI)];
  let lastError;
  for (const name of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await genAI.getGenerativeModel({ model: name }).generateContent(prompt);
        if (name !== MODELS.GEMINI) console.warn(`Gemini: ${MODELS.GEMINI} unavailable, answered by ${name}`);
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
