require('./env'); // load .env before reading the model overrides below

/**
 * Single source of truth for the model IDs this app talks to.
 *
 * These were previously hard-coded as string literals in ~30 places across 12
 * controllers. When Groq decommissioned the Llama 3.x models every AI feature
 * broke at once with "model does not exist", and each literal had to be found
 * by hand. Keep them here so the next deprecation is a one-line change.
 *
 * Check what your key can actually reach:
 *   curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"
 *   curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GOOGLE_API_KEY"
 */

const MODELS = {
  // Heavier reasoning: curriculum design, quiz authoring, roadmaps and skill-gap
  // analysis, doubt clearance, forum answers.
  REASONING: process.env.GROQ_MODEL_REASONING || 'openai/gpt-oss-120b',

  // High-volume, lower-stakes: notes chat, summarisation, video Q&A.
  FAST: process.env.GROQ_MODEL_FAST || 'openai/gpt-oss-20b',

  // Third-party course discovery. "latest" alias on purpose: pinned Gemini
  // snapshots get retired and start returning 404 to new callers.
  GEMINI: process.env.GEMINI_MODEL || 'gemini-flash-latest',
  // Tried in order when the main Gemini model is overloaded or rate-limited (see ai/gemini.js).
  GEMINI_FALLBACKS: (process.env.GEMINI_FALLBACK_MODELS || 'gemini-flash-lite-latest').split(',').map((m) => m.trim()).filter(Boolean),

  // Voice notes on problem reports (Groq Whisper, through groq-sdk).
  WHISPER: process.env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3-turbo',
  // Report embeddings for semantic search and topic clustering (Gemini).
  EMBED: process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001',
};

const csv = (value) => String(value || '').split(',').map((m) => m.trim()).filter(Boolean);

/** Dimensions stored per report embedding (Gemini embeddings support MRL truncation). */
const EMBED_DIM = Number(process.env.EMBED_DIM) || 768;

/**
 * Where to go when a model's DAILY quota is used up (a 429 that a short wait
 * will not fix). The per-minute "try again in N s" limit is still handled by
 * waiting (ai/errors.js). Check what your key can reach before adding models:
 *   curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"
 */
const FAILOVER = {
  REASONING: csv(process.env.GROQ_FAILOVER_REASONING).length ? csv(process.env.GROQ_FAILOVER_REASONING) : [MODELS.REASONING, MODELS.FAST],
  FAST: csv(process.env.GROQ_FAILOVER_FAST).length ? csv(process.env.GROQ_FAILOVER_FAST) : [MODELS.FAST, MODELS.REASONING],
};

/**
 * Approximate USD per 1M tokens [input, output], for the cost views and the
 * daily spend cap. Free-tier keys are billed $0; these exist so spend is
 * visible and capped. Update from the providers' pricing pages as needed.
 * Whisper is priced per hour of audio.
 */
const PRICING = {
  'openai/gpt-oss-120b': [0.15, 0.6],
  'openai/gpt-oss-20b': [0.075, 0.3],
  'gemini-flash-latest': [0.3, 2.5],
  'gemini-flash-lite-latest': [0.1, 0.4],
  'gemini-embedding-001': [0.15, 0],
};
const AUDIO_PRICING_PER_HOUR = { 'whisper-large-v3-turbo': 0.04, 'whisper-large-v3': 0.111 };

/** USD for one call; unknown models cost 0 (still counted, just not priced). */
function costUsd(model, tokensIn = 0, tokensOut = 0) {
  const [pin, pout] = PRICING[model] || [0, 0];
  return (tokensIn / 1e6) * pin + (tokensOut / 1e6) * pout;
}

/**
 * The model tasks added by the early-warning work, and the tier each runs on.
 * route() below picks the concrete model.
 */
const TASKS = {
  report_enrich: 'FAST',
  report_transcribe: 'WHISPER',
  report_embed: 'EMBED',
  risk_supervisor: 'FAST',
  risk_lane: 'FAST',
  risk_root_cause: 'REASONING',
  risk_verifier: 'GEMINI', // a different model family from the author; FAST without a Gemini key
  admin_assistant: 'REASONING',
};

/**
 * Pick the model for a task (EWDI app/llm.py route()).
 *
 * Cheap by default, one rung up when the first attempt failed or came back
 * unconfident. An admin override (the `ai.routes` setting) wins. The verifier
 * is never the model that wrote the analysis it audits (`avoid`).
 *
 * @returns {{ provider: 'groq'|'gemini', model: string, reasoningEffort?: string, routedBy: string }}
 */
function route(task, { attempt = 0, confidence, overrides = {}, avoid, geminiAvailable = false } = {}) {
  const tier = TASKS[task];
  if (!tier) throw new Error(`Unknown AI task: ${task}`);
  const escalate = attempt > 0 || (typeof confidence === 'number' && confidence < 0.6);

  let pick;
  if (overrides[task]) {
    pick = { model: overrides[task], routedBy: 'override' };
  } else if (tier === 'GEMINI') {
    pick = geminiAvailable ? { model: MODELS.GEMINI, routedBy: 'default' } : { model: MODELS.FAST, routedBy: 'no-gemini' };
  } else if (tier === 'WHISPER' || tier === 'EMBED') {
    pick = { model: MODELS[tier], routedBy: 'default' };
  } else if (task === 'risk_root_cause' && escalate) {
    pick = { model: MODELS.REASONING, reasoningEffort: 'medium', routedBy: 'escalated' };
  } else if (escalate && (task === 'risk_lane' || task === 'risk_supervisor')) {
    pick = { model: MODELS.REASONING, routedBy: 'escalated' };
  } else {
    pick = { model: MODELS[tier], routedBy: 'default' };
  }

  if (avoid && pick.model === avoid) {
    const alternative = [MODELS.FAST, MODELS.REASONING, ...(geminiAvailable ? [MODELS.GEMINI] : [])].find((m) => m !== avoid);
    pick = { model: alternative, routedBy: 'not-author' };
  }
  const provider = /^gemini/i.test(pick.model) ? 'gemini' : 'groq';
  return { provider, ...pick };
}

/**
 * gpt-oss models are reasoning models: they spend completion tokens on an
 * internal `reasoning` field before emitting `content`. At this app's existing
 * max_tokens values that budget gets consumed by reasoning and `content` comes
 * back as an empty string. Keeping the effort low leaves the budget for the
 * answer (measured: ~118 reasoning tokens at default vs ~7 at "low").
 */
const GROQ_DEFAULTS = {
  reasoning_effort: 'low',
};

module.exports = { MODELS, GROQ_DEFAULTS, EMBED_DIM, FAILOVER, PRICING, AUDIO_PRICING_PER_HOUR, costUsd, TASKS, route };
