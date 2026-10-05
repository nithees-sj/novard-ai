const { ChatGroq } = require('@langchain/groq');
const { ChatPromptTemplate, MessagesPlaceholder } = require('@langchain/core/prompts');
const { RunnableWithMessageHistory } = require('@langchain/core/runnables');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { BaseListChatMessageHistory } = require('@langchain/core/chat_history');
const { HumanMessage, AIMessage, SystemMessage } = require('@langchain/core/messages');
const { MODELS, REQUEST_TOKEN_LIMIT, maxOutputTokens } = require('../config/ai');
const { env } = require('../config/env');
const { withRateLimitRetry } = require('./errors');
const { condenseToFit } = require('./condense');
const { beforeCall } = require('./usageGuard');
const { ModelCallHandler } = require('./modelCallLog');
const { withFailover, logged, chainFor, liveModelSettings } = require('./modelGateway');
const settings = require('../services/settingsService');

/**
 * Conversation engine for every chatbot in the app, built on LangChain.
 *
 *   prompt  = system instructions + conversation memory + the new message
 *   chain   = RunnableWithMessageHistory(prompt | ChatGroq | string parser)
 *   memory  = MongoChatHistory: reads/writes the chat array already stored on
 *             each document (notes, videos, doubts, coaching sessions, ...)
 *
 * Memory is a summary buffer: recent turns are passed verbatim; once a chat
 * grows past MEMORY.summarizeAt tokens, the older turns are folded into a
 * running summary saved on the document. The student can keep asking about
 * anything said earlier in the same chat, however long it gets, without the
 * prompt ever overflowing the model's context.
 */

// Sized from the provider's per-request limit (config/ai.js), so the history
// always fits beside the instructions and source text: 2,000 / 1,200 on Groq's
// free tier, and proportionally more once AI_REQUEST_TOKEN_LIMIT is raised.
const MEMORY = {
  summarizeAt: Number(process.env.MEMORY_SUMMARIZE_AT_TOKENS) || Math.round(REQUEST_TOKEN_LIMIT * 0.25),
  keepRecent: Number(process.env.MEMORY_KEEP_RECENT_TOKENS) || Math.round(REQUEST_TOKEN_LIMIT * 0.15),
};

// A conservative estimate (~4 characters per token) - exact counts are not
// needed to decide when to summarise.
const estimateTokens = (text) => Math.ceil(String(text || '').length / 4);

const MEMORY_INSTRUCTIONS = [
  '',
  'Conversation memory:',
  '- You can see this conversation so far (older parts may appear as a summary).',
  '- When the user refers to something earlier ("the first thing you suggested", "that project",',
  '  "what did I ask before?"), answer from the conversation. If it is genuinely not there, say so.',
  '- Stay consistent with what you told them earlier unless they give you new information.',
].join('\n');

/**
 * ChatGroq with the app's model layer at its one HTTP choke point: the admin's
 * switches and limits are checked, a model whose daily quota is used up fails
 * over to the next, and failed attempts are logged. (Successful calls are
 * logged, with their token counts, by ModelCallHandler.)
 */
class NovardChatGroq extends ChatGroq {
  async completionWithRetry(request, options) {
    await beforeCall({ provider: 'groq' }, this.novardContext);
    const live = await liveModelSettings();
    return withFailover(chainFor(request.model, live), async (model, attempt) => {
      if (model === request.model) return this.loggedFailure(model, attempt, () => super.completionWithRetry(request, options));
      return this.loggedFailure(model, attempt, () => super.completionWithRetry({ ...request, model, max_tokens: maxOutputTokens(model) }, options));
    }, { serverTries: 1 }); // LangChain's caller already retries 5xx
  }

  /** Log an attempt only when it fails; success is logged with its tokens by the callback. */
  async loggedFailure(model, attempt, call) {
    try {
      return await call();
    } catch (error) {
      await logged({ provider: 'groq', model, attempt, routedBy: attempt > 1 ? 'failover' : 'default', context: this.novardContext }, () => Promise.reject(error))
        .catch(() => {});
      throw error;
    }
  }
}

function chatModel({ tier = 'REASONING', temperature = 0.6, model: explicitModel } = {}) {
  // Cached settings (no await here): at their defaults this is the old model and 'low' effort.
  const tiers = settings.peek('ai.tiers');
  const params = settings.peek('ai.params');
  const handler = new ModelCallHandler();
  const model = new NovardChatGroq({
    apiKey: env.groqApiKey || 'missing-key',
    model: explicitModel || tiers[tier] || MODELS[tier] || MODELS.REASONING,
    temperature: params.temperature ?? temperature,
    // gpt-oss models are reasoning models; keep the token budget for the answer.
    reasoningEffort: params.reasoningEffort || 'low',
    callbacks: [handler],
  });
  model.novardContext = handler.context;
  return model;
}

const toLangChain = (m) => (m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content));

/**
 * LangChain chat history stored inside an existing Mongo document array.
 * getMessages() returns the *memory view* (summary + recent turns);
 * addMessages() appends atomically with $push, so concurrent requests never
 * overwrite each other's messages.
 */
class MongoChatHistory extends BaseListChatMessageHistory {
  /**
   * `toText(message)` turns a stored message into the text the model sees;
   * by default its content. The Novard Agent uses it to add the status of the
   * action cards attached to a message.
   */
  constructor({ Model, filter, field, timeKey = 'timestamp', toText = (m) => m.content }) {
    super();
    this.lc_namespace = ['novard', 'memory'];
    this.Model = Model;
    this.filter = filter;
    this.field = field;
    this.timeKey = timeKey;
    this.toText = toText;
  }

  async rawMessages() {
    const doc = await this.Model.findOne(this.filter).select(`${this.field} memory`).lean();
    if (!doc) throw Object.assign(new Error('Conversation not found'), { status: 404 });
    const messages = (doc[this.field] || [])
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
      .map((m) => ({ ...m, content: this.toText(m) }))
      .filter((m) => m.content);
    return { messages, memory: doc.memory || {} };
  }

  async getMessages() {
    const { messages, memory } = await this.rawMessages();
    let summary = memory.summary || '';
    let summarizedCount = Math.min(memory.summarizedCount || 0, messages.length);
    let pending = messages.slice(summarizedCount);

    const pendingTokens = pending.reduce((n, m) => n + estimateTokens(m.content), 0);
    if (pendingTokens > MEMORY.summarizeAt) {
      // Keep the newest turns verbatim; fold everything older into the summary.
      let kept = 0;
      let split = pending.length;
      while (split > 0 && kept + estimateTokens(pending[split - 1].content) <= MEMORY.keepRecent) {
        kept += estimateTokens(pending[split - 1].content);
        split -= 1;
      }
      split = Math.max(1, Math.min(split, pending.length - 2)); // always keep the last exchange verbatim
      const older = pending.slice(0, split);
      summary = await summarize(summary, older);
      summarizedCount += older.length;
      pending = pending.slice(split);
      await this.Model.updateOne(this.filter, { $set: { 'memory.summary': summary, 'memory.summarizedCount': summarizedCount } });
    }

    const view = pending.map(toLangChain);
    if (summary) {
      view.unshift(new SystemMessage(`Summary of the earlier part of this conversation:\n${summary}`));
    }
    return view;
  }

  async addMessages(messages) {
    const now = Date.now();
    const docs = messages.map((m, i) => ({
      role: m._getType() === 'human' ? 'user' : 'assistant',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      [this.timeKey]: new Date(now + i), // keep the user message strictly before the reply
    }));
    await this.Model.updateOne(this.filter, { $push: { [this.field]: { $each: docs } } });
  }

  async addMessage(message) {
    return this.addMessages([message]);
  }

  async clear() {
    await this.Model.updateOne(this.filter, { $set: { [this.field]: [], memory: { summary: '', summarizedCount: 0 } } });
  }
}

/** Extend the running summary with turns that are about to leave the verbatim window. */
async function summarize(existing, messages) {
  const transcript = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
  const { text: newMessages } = await condenseToFit(transcript, { what: 'tutoring conversation' });
  const llm = chatModel({ tier: 'FAST', temperature: 0.2 });
  const result = await withRateLimitRetry(() => llm.invoke([
    new SystemMessage(
      'You maintain the memory of a tutoring conversation. Update the summary so a tutor could continue ' +
      'the conversation without the original messages. Keep: every question the user asked (in order), the key ' +
      'points of each answer, concrete facts, names, numbers, code or commands mentioned, recommendations made, ' +
      'decisions taken, and anything the user said about themselves or their progress. Be dense; use short bullet ' +
      'points; stay under 350 words. Return only the updated summary.'
    ),
    new HumanMessage(`Current summary:\n${existing || '(none yet)'}\n\nNew messages to fold in:\n${newMessages}`),
  ]));
  return String(result.content || existing).trim();
}

const prompt = ChatPromptTemplate.fromMessages([
  // Instructions are passed as a variable, so braces in notes or code never
  // get parsed as template placeholders.
  ['system', '{system}'],
  new MessagesPlaceholder('history'),
  ['human', '{input}'],
]);

/**
 * Answer one turn of a stored conversation and save both messages.
 *
 * @param {object} opts
 * @param {Model}  opts.Model    Mongoose model holding the conversation
 * @param {object} opts.filter   selects the document (include userId for ownership)
 * @param {string} opts.field    array field holding {role, content, <timeKey>} messages
 * @param {string} [opts.timeKey] timestamp key used by that schema
 * @param {string} opts.system   system instructions (context, persona, format rules)
 * @param {string} opts.input    the user's message
 * @returns {Promise<string>} the assistant's reply (already saved)
 */
async function converse({ Model, filter, field, timeKey, system, input, tier, temperature }) {
  const history = new MongoChatHistory({ Model, filter, field, timeKey });
  const chain = new RunnableWithMessageHistory({
    runnable: prompt.pipe(chatModel({ tier, temperature })).pipe(new StringOutputParser()),
    getMessageHistory: async () => history,
    inputMessagesKey: 'input',
    historyMessagesKey: 'history',
  });

  const reply = await withRateLimitRetry(() => chain.invoke(
    { system: `${system}\n${MEMORY_INSTRUCTIONS}`, input },
    { configurable: { sessionId: String(filter._id || JSON.stringify(filter)) } }
  ));

  const text = String(reply || '').trim();
  if (!text) throw Object.assign(new Error('The assistant did not reply. Please try again.'), { status: 502 });
  return text;
}

module.exports = { converse, chatModel, MongoChatHistory, MEMORY, _internal: { estimateTokens, summarize } };
