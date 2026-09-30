const { env } = require('../config/env');
const { MODELS, EMBED_DIM, costUsd } = require('../config/ai');
const settings = require('../services/settingsService');
const { beforeCall } = require('./usageGuard');
const { logged } = require('./modelGateway');

/**
 * Report embeddings (Gemini, through the existing @google/generative-ai),
 * truncated to EMBED_DIM dimensions. Optional: without a Gemini key the
 * semantic lane and topics fall back to text search and enrichment intents.
 */

let client;
function embedModel() {
  if (!client) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    client = new GoogleGenerativeAI(env.geminiApiKey).getGenerativeModel({ model: MODELS.EMBED });
  }
  return client;
}

/** Are embeddings available right now? */
async function embeddingsEnabled() {
  if (!env.geminiApiKey) return false;
  return (await settings.get('ai.providers')).gemini !== false;
}

/** One vector per text (same order). Throws when Gemini is unavailable. */
async function embedTexts(texts) {
  if (!texts.length) return [];
  if (!env.geminiApiKey) throw new Error('No Gemini API key: embeddings are off.');
  await beforeCall({ provider: 'gemini' });
  const tokensIn = texts.reduce((n, t) => n + Math.ceil(String(t).length / 4), 0);
  return logged({ provider: 'gemini', model: MODELS.EMBED, attempt: 1, routedBy: 'default' }, async () => {
    const response = await embedModel().batchEmbedContents({
      requests: texts.map((text) => ({
        content: { role: 'user', parts: [{ text: String(text).slice(0, 8000) }] },
        taskType: 'CLUSTERING',
        outputDimensionality: EMBED_DIM,
      })),
    });
    const vectors = (response.embeddings || []).map((e) => (e.values || []).slice(0, EMBED_DIM));
    if (vectors.length !== texts.length) throw new Error('Gemini returned the wrong number of embeddings');
    return { result: vectors, tokensIn, tokensOut: 0, usd: costUsd(MODELS.EMBED, tokensIn, 0) };
  });
}

module.exports = { embedTexts, embeddingsEnabled };
