const { MODELS, route, costUsd } = require('../config/ai');
const { env } = require('../config/env');
const settings = require('../services/settingsService');
const { rateLimitWait, withRateLimitRetry } = require('./errors');
const { currentAi } = require('./aiContext');
const { recordModelCall, outcomeOf } = require('./modelCallLog');
const { beforeCall } = require('./usageGuard');
const { parseModelJson } = require('../utils/parseModelJson');
const { HttpError } = require('../utils/httpError');
const logger = require('../utils/logger');

/**
 * The model layer shared by every AI call (EWDI app/llm.py, in Novard terms):
 *
 *   routing        config/ai.js route(): model per task, escalation on retry,
 *                  admin overrides (`ai.routes`), verifier != author
 *   tiers          the existing features' REASONING / FAST models can be
 *                  switched from the console (`ai.tiers`)
 *   fail-over      a DAILY-quota 429 moves to the next model (`ai.failover`);
 *                  the per-minute "try again in N s" limit keeps waiting
 *                  (ai/errors.js withRateLimitRetry), as before
 *   backoff        5xx: exponential backoff, 3 tries per model
 *   JSON repair    parseModelJson, then one retry with the error in context
 *   final error    AIUnavailableError, so callers degrade deterministically
 *   logging        one ModelCall row per attempt (ai/modelCallLog.js)
 */

const BACKOFF_BASE_MS = env.isTest ? 1 : 1000;
// Gemini's SDK has no default timeout; a stuck call once held an investigation for 3.5 minutes.
const GEMINI_TIMEOUT_MS = 30000;
const MAX_5XX_TRIES = 3;
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

class AIUnavailableError extends HttpError {
  constructor(cause) {
    super(502, 'The AI service is unavailable right now. Please try again.', { code: 'AI_UNAVAILABLE', cause });
    this.name = 'AIUnavailableError';
  }
}

const statusOf = (error) => error?.status ?? error?.response?.status;

/** A 429 that waiting a few seconds will not fix: the model's daily quota is used up. */
function isDailyQuota(error) {
  if (statusOf(error) !== 429) return false;
  if (/per day|daily|\bRPD\b|\bTPD\b/i.test(String(error?.message || ''))) return true;
  return rateLimitWait(error) === null; // "try again in 25m": too long to sit out
}

const isServerError = (error) => statusOf(error) >= 500 && statusOf(error) < 600;
const unique = (list) => [...new Set(list.filter(Boolean))];

/** The live model settings that shape every call. */
async function liveModelSettings() {
  return settings.getMany(['ai.tiers', 'ai.failover', 'ai.params', 'ai.routes', 'ai.providers']);
}

/** Which tier a model id belongs to (by its default or its current setting), or null. */
function tierOf(model, tiers) {
  if (model === MODELS.REASONING || model === tiers.REASONING) return 'REASONING';
  if (model === MODELS.FAST || model === tiers.FAST) return 'FAST';
  return null;
}

/** The models to try, in order, for a call that asked for `model`. */
function chainFor(model, live) {
  const tier = tierOf(model, live['ai.tiers']);
  if (!tier) return [model];
  return unique([live['ai.tiers'][tier], ...live['ai.failover'][tier]]);
}

/**
 * Run `attempt(model, n)` over the fail-over chain. `attempt` does the call
 * and logs it. Daily quota -> next model; 5xx -> backoff on the same model
 * (`serverTries` in all; 1 where the SDK already retries 5xx itself);
 * anything else is rethrown untouched (per-minute 429s are the caller's
 * withRateLimitRetry's to handle, exactly as before).
 */
async function withFailover(chain, attempt, { serverTries = MAX_5XX_TRIES } = {}) {
  let last;
  let n = 0;
  for (let i = 0; i < chain.length; i += 1) {
    for (let tries = 0; ; tries += 1) {
      n += 1;
      try {
        // eslint-disable-next-line no-await-in-loop
        return await attempt(chain[i], n);
      } catch (error) {
        last = error;
        if (error && typeof error === 'object') error.loggedAttempts = true;
        if (isDailyQuota(error)) {
          if (i < chain.length - 1) logger.warn(`AI: ${chain[i]} has used its daily quota, failing over to ${chain[i + 1]}`);
          break;
        }
        if (isServerError(error) && tries < serverTries - 1) {
          // eslint-disable-next-line no-await-in-loop
          await sleep(BACKOFF_BASE_MS * 2 ** tries + Math.random() * BACKOFF_BASE_MS);
          continue;
        }
        if (isServerError(error)) break; // this model keeps failing: try the next one
        throw error;
      }
    }
  }
  const final = new AIUnavailableError(last);
  final.loggedAttempts = true;
  throw final;
}

/**
 * One logged provider call: times it, records the outcome, returns its result.
 * `call` returns { result, tokensIn, tokensOut }.
 */
async function logged({ provider, model, attempt, routedBy, context }, call) {
  const started = Date.now();
  try {
    const { result, tokensIn = 0, tokensOut = 0, usd } = await call();
    await recordModelCall({ provider, model, attempt, routedBy, tokensIn, tokensOut, usd, latencyMs: Date.now() - started, outcome: 'ok' }, context);
    return result;
  } catch (error) {
    if (error && typeof error === 'object') error.dailyQuota = isDailyQuota(error);
    await recordModelCall({
      provider, model, attempt, routedBy, latencyMs: Date.now() - started, outcome: outcomeOf(error), error: error?.message,
      tokensIn: error?.tokensIn || 0, tokensOut: error?.tokensOut || 0,
    }, context);
    throw error;
  }
}

// ── JSON calls for the early-warning tasks ─────────────────────────────────

let groqSdk;
let geminiSdk;
function groq() {
  if (!groqSdk) {
    const Groq = require('groq-sdk');
    groqSdk = new Groq({ apiKey: env.groqApiKey || 'missing-key' });
  }
  return groqSdk;
}
function gemini() {
  if (!geminiSdk) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    geminiSdk = new GoogleGenerativeAI(env.geminiApiKey);
  }
  return geminiSdk;
}

async function groqJson({ model, system, user, maxTokens, temperature, reasoningEffort }) {
  const completion = await groq().chat.completions.create({
    model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    response_format: { type: 'json_object' },
    max_tokens: maxTokens,
    temperature,
    ...(/gpt-oss/.test(model) ? { reasoning_effort: reasoningEffort } : {}),
  }, { maxRetries: 0 });
  return {
    result: completion.choices?.[0]?.message?.content || '',
    tokensIn: completion.usage?.prompt_tokens || 0,
    tokensOut: completion.usage?.completion_tokens || 0,
  };
}

async function geminiJson({ model, system, user, maxTokens, temperature }) {
  const response = await gemini().getGenerativeModel({
    model,
    systemInstruction: system,
    generationConfig: { responseMimeType: 'application/json', maxOutputTokens: maxTokens, temperature },
  }, { timeout: GEMINI_TIMEOUT_MS }).generateContent(user);
  const usage = response.response.usageMetadata || {};
  return { result: response.response.text(), tokensIn: usage.promptTokenCount || 0, tokensOut: usage.candidatesTokenCount || 0 };
}

/**
 * A JSON answer for one of the early-warning tasks (config/ai.js TASKS).
 *
 * The prompt should state the fields and allowed values in words: Groq
 * rejects a whole response whose JSON does not match a strict schema, so only
 * `json_object` mode is used and the caller cleans the result.
 *
 * @returns {Promise<{data: object, model: string, provider: string, tokensIn: number, tokensOut: number, usd: number, attempts: number}>}
 */
async function callJson({ task, system, user, maxTokens = 800, temperature = 0.2, attempt = 0, confidence, avoid, context, onWait }) {
  // The caller's AI context (feature, run id, step, conversation), so every call is logged against it.
  const ctx = { ...currentAi(), ...(context || {}), task };
  const live = await liveModelSettings();
  const geminiAvailable = Boolean(env.geminiApiKey) && live['ai.providers'].gemini !== false;
  const pick = route(task, { attempt, confidence, overrides: live['ai.routes'], avoid, geminiAvailable });
  const params = live['ai.params'];
  const scaledTokens = Math.max(64, Math.round(maxTokens * params.maxTokensScale));
  const temp = params.temperature ?? temperature;

  // Gemini first when routed there, then Groq (never the model to avoid).
  const candidates = pick.provider === 'gemini'
    ? [pick, route(task, { overrides: {}, avoid, geminiAvailable: false })]
    : [pick];

  const usage = { tokensIn: 0, tokensOut: 0, usd: 0, attempts: 0 };
  let lastError;
  for (const candidate of candidates) {
    // Groq: the tier's fail-over chain. Gemini: its configured fallbacks (flash-lite), as ai/gemini.js does.
    const chain = candidate.provider === 'groq'
      ? unique([candidate.model, ...chainFor(candidate.model, live)]).filter((m) => m !== avoid)
      : unique([candidate.model, ...MODELS.GEMINI_FALLBACKS]).filter((m) => m !== avoid);
    let repair = '';
    for (let jsonTry = 0; jsonTry < 2; jsonTry += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await beforeCall({ provider: candidate.provider }, ctx);
        // eslint-disable-next-line no-await-in-loop
        const out = await withFailover(chain, (model) => {
          // The per-minute limit ("try again in N s") is waited out, as everywhere else in the app.
          return withRateLimitRetry(() => {
            usage.attempts += 1;
            return logged({ provider: candidate.provider, model, attempt: usage.attempts, routedBy: candidate.routedBy, context: ctx }, async () => {
              const res = candidate.provider === 'gemini'
                ? await geminiJson({ model, system, user: user + repair, maxTokens: scaledTokens, temperature: temp })
                : await groqJson({ model, system, user: user + repair, maxTokens: scaledTokens, temperature: temp, reasoningEffort: candidate.reasoningEffort || params.reasoningEffort });
              usage.tokensIn += res.tokensIn;
              usage.tokensOut += res.tokensOut;
              usage.usd += costUsd(model, res.tokensIn, res.tokensOut);
              let data;
              try {
                data = parseModelJson(res.result, { context: task });
              } catch (parseError) {
                throw Object.assign(new Error(`${task}: the model did not return valid JSON (${String(parseError.message).slice(0, 120)})`), {
                  code: 'INVALID_JSON', tokensIn: res.tokensIn, tokensOut: res.tokensOut,
                });
              }
              if (!data || typeof data !== 'object' || Array.isArray(data)) {
                throw Object.assign(new Error(`${task}: the model did not return a JSON object`), { code: 'INVALID_JSON', tokensIn: res.tokensIn, tokensOut: res.tokensOut });
              }
              return { ...res, result: { data, model } };
            });
          }, { retries: 2, onWait });
        }, { serverTries: candidate.provider === 'gemini' ? 2 : MAX_5XX_TRIES });
        return { data: out.data, model: out.model, provider: candidate.provider, ...usage };
      } catch (error) {
        lastError = error;
        if (error?.code !== 'INVALID_JSON') break; // this provider is out: try the next candidate
        repair = '\n\nYour previous output was not valid JSON. Return ONLY one JSON object, nothing else.';
      }
    }
  }
  if (lastError instanceof HttpError && lastError.status === 503) throw lastError; // switched off / capped
  throw lastError instanceof AIUnavailableError ? lastError : new AIUnavailableError(lastError);
}

module.exports = {
  AIUnavailableError,
  isDailyQuota,
  isServerError,
  withFailover,
  logged,
  chainFor,
  tierOf,
  liveModelSettings,
  callJson,
  _internal: { groqJson, geminiJson },
};
