const crypto = require('crypto');
const { SystemMessage, HumanMessage, AIMessage, ToolMessage } = require('@langchain/core/messages');
const AdminConversation = require('../../models/adminConversation');
const ModelCall = require('../../models/modelCall');
const settings = require('../settingsService');
const { chatModel, MongoChatHistory } = require('../../ai/conversation');
const { withRateLimitRetry } = require('../../ai/errors');
const { runWithAi } = require('../../ai/aiContext');
const { READ, MUTATING, TOOL_DEFS, allowedArgs, MAX_RESULT_CHARS, LOG_RESULT_CHARS } = require('./tools');
const { needsEvidence, refusalFor, unsupportedFigures } = require('./guard');
const logger = require('../../utils/logger');

/**
 * The admin assistant: the console's copy of the Novard Agent's engine (a
 * LangChain tool-calling loop with summary-buffer memory, served over SSE),
 * with its own admin-only tools (EWDI copilot, in Novard terms).
 *
 * Unlike the student agent the reply is not streamed token by token: the
 * guards below may send an answer back before anyone sees it.
 *
 * Emits: status {text} · tool {name, args} · action {action} · token {text} · done {message}
 */

const CARD_STATUS = { proposed: 'waiting for the admin to confirm', running: 'running', done: 'done', dismissed: 'declined by the admin', failed: 'failed' };

function systemPrompt(adminName) {
  const today = new Date().toISOString().slice(0, 10);
  return `You are the Novard-AI admin assistant, inside the admin console of Novard-AI (a student learning platform). Today is ${today}.${adminName ? ` You are helping ${adminName}.` : ''}
You read the live platform through tools, start investigations and propose changes. Rules:
- Anything about the live state (risk, reports, costs, gateways, users, runs) comes from a tool first. Never answer it from memory.
- Every number you give must come from a tool result in this conversation. Quote them; never estimate or invent one.
- Lead with the finding, then the figures. Be brief and concrete.
- "Investigate / diagnose / why is X at risk" -> start_investigation. "Resolve / close reports" -> resolve_reports, only when clearly asked, with a note for the students. Switching tools on or off -> set_feature_flag. Changing a model -> set_model_route.
- Those four tools only put a confirmation card in the chat: nothing happens until the admin presses Confirm. Say so in one sentence; never claim it is done.
- You cannot see or change API keys, grant or revoke admin access, or suspend accounts: point the admin to the Gateways or Users page.
- Say plainly when a tool returns nothing useful.`;
}

/** What the model remembers of an earlier message: its text and its cards' status. */
function messageForModel(m) {
  const cards = (m.actions || []).map((a) => `[Card: ${a.args?.summary || a.type} - ${CARD_STATUS[a.status] || a.status}${a.result?.note ? ` (${a.result.note})` : ''}]`);
  return [m.content, ...cards].filter(Boolean).join('\n\n');
}

/** gpt-oss sometimes leaves tool-citation markers like "【functions.risk_board】" in its text. */
const cleanReply = (content) => (typeof content === 'string' ? content.replace(/【[^】]{0,80}】/g, '').replace(/[ \t]+\n/g, '\n').trim() : '');

const trimResult = (result, max) => {
  const json = JSON.stringify(result ?? null);
  return json.length > max ? `${json.slice(0, max)}…(truncated)` : json;
};

/** USD spent by this conversation's model calls since `since`. */
async function spentSince(conversationId, since) {
  const [row] = await ModelCall.aggregate([
    { $match: { conversationId: String(conversationId), createdAt: { $gte: since } } },
    { $group: { _id: null, usd: { $sum: '$usd' } } },
  ]);
  return row?.usd || 0;
}

/**
 * One turn.
 * @param {object} opts { conversationId, admin: {email, name, role}, input, emit, signal, deps? }
 * @returns {Promise<object>} the stored assistant message
 */
async function runTurn({ conversationId, admin, input, emit = () => {}, signal, deps = {} }) {
  const filter = { _id: conversationId, adminId: admin.email };
  const history = new MongoChatHistory({ Model: AdminConversation, filter, field: 'messages', timeKey: 'createdAt', toText: messageForModel });
  const started = new Date();
  const past = await history.getMessages();
  await AdminConversation.updateOne(filter, { $push: { messages: { role: 'user', content: input, createdAt: started } } });

  const save = async (content, extra = {}) => {
    const stored = { role: 'assistant', content, createdAt: new Date(), ...extra };
    await AdminConversation.updateOne(filter, { $push: { messages: stored } });
    return stored;
  };

  // Refused outright: no model call, a pointer to the page that does it.
  const refusal = refusalFor(input);
  if (refusal) {
    emit('token', { text: refusal.reply });
    return save(refusal.reply, { flags: { refused: true } });
  }

  const { maxSteps, turnUsdMax } = await settings.get('assistant');
  const routes = await settings.get('ai.routes');
  return runWithAi({ feature: 'admin.assistant', userId: admin.email, conversationId: String(conversationId) }, async () => {
    const base = deps.model || chatModel({ tier: 'REASONING', maxTokens: 1500, temperature: 0.2, model: routes.admin_assistant });
    const withTools = base.bindTools(TOOL_DEFS);
    const messages = [new SystemMessage(systemPrompt(admin.name)), ...past, new HumanMessage(input)];

    const toolResults = [];
    const traces = [];
    const actions = [];
    const usedMutating = new Set();
    const flags = {};
    let forced = false;
    let text = '';

    const runTool = async (call) => {
      const name = call.name;
      const t0 = Date.now();
      if (READ[name]) {
        const args = allowedArgs(READ[name], call.args);
        emit('tool', { name, args });
        emit('status', { text: `Looking up ${name.replace(/_/g, ' ')}…` });
        let result;
        try {
          result = await READ[name].run(args);
        } catch (error) {
          result = { error: error.message };
        }
        toolResults.push(result);
        traces.push({ name, args, ok: !result?.error, ms: Date.now() - t0, preview: trimResult(result, LOG_RESULT_CHARS) });
        return result;
      }
      if (MUTATING[name]) {
        // At most once per mutating tool per turn (EWDI), and never more than two cards.
        if (usedMutating.has(name) || actions.length >= 2) return { error: `${name} was already proposed this turn. Stop here.` };
        const args = allowedArgs(MUTATING[name], call.args);
        const prepared = await MUTATING[name].prepare(args);
        traces.push({ name, args, ok: !prepared.error, ms: Date.now() - t0, preview: trimResult(prepared, LOG_RESULT_CHARS) });
        if (prepared.error) return prepared;
        usedMutating.add(name);
        const action = {
          id: crypto.randomBytes(6).toString('hex'), type: name, status: 'proposed', origin: 'requested',
          args: { ...prepared.args, summary: prepared.summary }, updatedAt: new Date(),
        };
        actions.push(action);
        emit('action', { action });
        return { ok: true, card: prepared.summary, note: 'A confirmation card is shown. Nothing happens until the admin presses Confirm. Say that in one sentence.' };
      }
      return { error: `Unknown tool ${name}.` };
    };

    for (let step = 0; step < maxSteps; step += 1) {
      // eslint-disable-next-line no-await-in-loop
      if (await spentSince(conversationId, started) >= turnUsdMax) {
        flags.capped = true;
        if (!text) text = 'I stopped here: this turn reached its cost limit. Ask again, or narrow the question.';
        break;
      }
      const last = step === maxSteps - 1;
      // eslint-disable-next-line no-await-in-loop
      const reply = await withRateLimitRetry(() => (last ? base : withTools).invoke(messages, { signal }), {
        retries: 3,
        onWait: (seconds) => emit('status', { text: `The AI is busy - continuing in ${seconds}s…` }),
      });
      const calls = reply.tool_calls || [];
      const content = cleanReply(reply.content);

      if (!calls.length) {
        // Evidence guard (EWDI): live data answered without looking anything up -> look it up, once.
        if (!toolResults.length && !actions.length && !forced && needsEvidence(input) && !last) {
          forced = true;
          flags.forcedTool = true;
          messages.push(new AIMessage(content));
          messages.push(new HumanMessage('(system) You answered about live data without calling a tool. Call the right tool first (risk_board, list_reports, cost_report, gateway_status, platform_stats, ...), then answer using only its figures.'));
          continue;
        }
        text = content;
        break;
      }
      messages.push(new AIMessage({ content, tool_calls: calls }));
      for (const call of calls) {
        // eslint-disable-next-line no-await-in-loop
        const result = await runTool(call);
        messages.push(new ToolMessage({ content: trimResult(result, MAX_RESULT_CHARS), tool_call_id: call.id }));
      }
      emit('status', { text: '' });
    }

    // Numeric check: every figure must come from a tool result; one repair, then say so.
    if (text && !flags.capped) {
      let bad = unsupportedFigures(text, toolResults);
      if (bad.length) {
        try {
          const fixed = await withRateLimitRetry(() => base.invoke([
            ...messages,
            new AIMessage(text),
            new HumanMessage(`(system) These figures are not in any tool result: ${bad.join(', ')}. Rewrite your answer using only figures from the tool results (or none). Reply with the answer only.`),
          ], { signal }));
          const candidate = cleanReply(fixed.content);
          if (candidate) {
            text = candidate;
            bad = unsupportedFigures(text, toolResults);
          }
        } catch (error) {
          logger.warn('Admin assistant: repair turn failed', { error: error.message });
        }
        if (bad.length) {
          flags.unverifiedNumbers = true;
          text += `\n\n_Some figures (${bad.join(', ')}) could not be verified against live data._`;
        }
      }
    }
    if (!text) text = actions.length ? 'I have prepared that for you: confirm the card below to go ahead.' : 'I could not find an answer to that. Try asking about risk, reports, costs, gateways or users.';

    emit('token', { text });
    const usd = await spentSince(conversationId, started);
    return save(text, {
      ...(actions.length ? { actions } : {}),
      ...(traces.length ? { tools: traces } : {}),
      ...(Object.keys(flags).length ? { flags } : {}),
      usd,
    });
  });
}

module.exports = { runTurn, messageForModel, systemPrompt, spentSince, cleanReply };
