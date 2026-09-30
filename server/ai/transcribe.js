const fs = require('fs');
const { env } = require('../config/env');
const { MODELS, AUDIO_PRICING_PER_HOUR } = require('../config/ai');
const settings = require('../services/settingsService');
const { beforeCall } = require('./usageGuard');
const { logged } = require('./modelGateway');

/**
 * Voice notes on problem reports: Groq Whisper through the existing groq-sdk.
 * Voice is offered only when this is available (voiceEnabled()).
 */

/** Can students attach a voice note right now? */
async function voiceEnabled() {
  if (!env.groqApiKey) return false;
  const [flag, providers] = await Promise.all([settings.get('features.voiceReports'), settings.get('ai.providers')]);
  return flag.enabled && providers.groq !== false;
}

/** The spoken text of an audio file ('' when nothing was said). Throws when Whisper is unavailable. */
async function transcribe(filePath) {
  await beforeCall({ provider: 'groq' });
  const { groq } = require('./groqClient');
  const model = MODELS.WHISPER;
  return logged({ provider: 'groq', model, attempt: 1, routedBy: 'default' }, async () => {
    const result = await groq.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model,
      response_format: 'verbose_json',
    });
    const seconds = Number(result.duration) || 0;
    return {
      result: String(result.text || '').trim(),
      usd: (seconds / 3600) * (AUDIO_PRICING_PER_HOUR[model] || 0),
    };
  });
}

module.exports = { transcribe, voiceEnabled };
