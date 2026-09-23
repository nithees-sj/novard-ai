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
  // Heavier reasoning: curriculum design, quiz authoring, skills/projects/resume
  // synthesis, doubt clearance, forum answers.
  REASONING: process.env.GROQ_MODEL_REASONING || 'openai/gpt-oss-120b',

  // High-volume, lower-stakes: notes chat, summarisation, video Q&A.
  FAST: process.env.GROQ_MODEL_FAST || 'openai/gpt-oss-20b',

  // Third-party course discovery. "latest" alias on purpose: pinned Gemini
  // snapshots get retired and start returning 404 to new callers.
  GEMINI: process.env.GEMINI_MODEL || 'gemini-flash-latest',
};

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

module.exports = { MODELS, GROQ_DEFAULTS };
