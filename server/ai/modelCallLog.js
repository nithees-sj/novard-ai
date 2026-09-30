const { BaseCallbackHandler } = require('@langchain/core/callbacks/base');
const ModelCall = require('../models/modelCall');
const UsageCounter = require('../models/usageCounter');
const { costUsd } = require('../config/ai');
const { currentAi } = require('./aiContext');
const logger = require('../utils/logger');

/**
 * Model-call logging for every AI feature: one ModelCall row per call attempt
 * (model, feature, tokens, USD, latency, outcome), and the day's spend counter.
 * A logging failure is swallowed: it must never break a student's request.
 */

const DAY_MS = 24 * 3600 * 1000;
const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);

/** Classify a provider error into a ModelCall outcome. */
function outcomeOf(error) {
  const status = error?.status ?? error?.response?.status;
  if (error?.code === 'INVALID_JSON') return 'invalid_json';
  if (error?.code === 'FEATURE_UNAVAILABLE' || error?.code === 'AI_BUDGET_REACHED') return 'blocked';
  if (status === 429) return error?.dailyQuota ? '429_daily' : '429';
  if (status >= 500) return '5xx';
  return 'error';
}

/** Add to today's AI spend (the global daily cap reads it). */
async function addSpend(usd) {
  if (!(usd > 0)) return;
  await UsageCounter.updateOne(
    { key: `spend:${dayKey()}` },
    { $inc: { value: usd }, $setOnInsert: { expiresAt: new Date(Date.now() + 3 * DAY_MS) } },
    { upsert: true }
  );
}

/**
 * Record one call. `context` defaults to the current AI context.
 * @returns {Promise<object|null>} the stored row
 */
async function recordModelCall(entry, context = currentAi()) {
  try {
    const usd = entry.usd ?? costUsd(entry.model, entry.tokensIn || 0, entry.tokensOut || 0);
    const row = await ModelCall.create({
      feature: context.feature,
      area: context.area,
      task: context.task,
      runId: context.runId,
      stepSeq: context.stepSeq,
      conversationId: context.conversationId,
      userId: context.userId,
      ...entry,
      error: entry.error ? String(entry.error).slice(0, 300) : undefined,
      usd,
    });
    await addSpend(usd);
    return row;
  } catch (error) {
    logger.warn('Could not record a model call', { error: error.message });
    return null;
  }
}

/** Token counts from a LangChain result, whichever way the provider reported them. */
function tokensFrom(output) {
  const generation = output?.generations?.[0]?.[0];
  const message = generation?.message;
  const usage = message?.usage_metadata;
  if (usage) return { tokensIn: usage.input_tokens || 0, tokensOut: usage.output_tokens || 0 };
  const meta = message?.response_metadata || {};
  const raw = meta.usage || meta.x_groq?.usage || meta.tokenUsage;
  if (raw) return { tokensIn: raw.prompt_tokens || raw.promptTokens || 0, tokensOut: raw.completion_tokens || raw.completionTokens || 0 };
  const llm = output?.llmOutput?.tokenUsage || output?.llmOutput?.estimatedTokenUsage;
  if (llm) return { tokensIn: llm.promptTokens || 0, tokensOut: llm.completionTokens || 0 };
  return { tokensIn: 0, tokensOut: 0 };
}

/**
 * LangChain callback: logs every chat-model call made through chatModel()
 * (the chats, memory summaries, the Novard Agent, forum replies, titles).
 * The AI context is captured when the model is created, because callbacks may
 * run outside the request's async context.
 */
class ModelCallHandler extends BaseCallbackHandler {
  constructor(context = currentAi()) {
    super({ _awaitHandler: true });
    this.name = 'novard-model-calls';
    this.context = context;
    this.starts = new Map();
  }

  handleChatModelStart(llm, messages, runId, parentRunId, extraParams) {
    this.starts.set(runId, { at: Date.now(), model: extraParams?.invocation_params?.model });
  }

  async handleLLMEnd(output, runId) {
    const start = this.starts.get(runId) || { at: Date.now() };
    this.starts.delete(runId);
    const message = output?.generations?.[0]?.[0]?.message;
    const model = message?.response_metadata?.model_name || message?.response_metadata?.model || start.model || 'unknown';
    await recordModelCall({ provider: 'groq', model, ...tokensFrom(output), latencyMs: Date.now() - start.at, outcome: 'ok' }, this.context);
  }

  async handleLLMError(error, runId) {
    const start = this.starts.get(runId) || { at: Date.now() };
    this.starts.delete(runId);
    // Failures inside the fail-over loop are already logged per attempt.
    if (error?.loggedAttempts) return;
    await recordModelCall({
      provider: 'groq', model: start.model || 'unknown', latencyMs: Date.now() - start.at, outcome: outcomeOf(error), error: error?.message,
    }, this.context);
  }
}

module.exports = { recordModelCall, ModelCallHandler, outcomeOf, tokensFrom, dayKey, addSpend };
