const crypto = require('crypto');
const { SystemMessage, HumanMessage, AIMessage, ToolMessage } = require('@langchain/core/messages');
const ChatbotConversation = require('../models/chatbotConversation');
const DoubtClearance = require('../models/doubtClearance');
const YouTubeVideo = require('../models/youtubeVideo');
const Roadmap = require('../models/roadmap');
const SkillPlan = require('../models/skillPlan');
const SkillGapSession = require('../models/skillGapSession');
const { chatModel, MongoChatHistory, withRateLimitRetry } = require('../ai/conversation');
const { FORMAT_RULES } = require('../ai/prompts');
const { searchVideos } = require('../controllers/youtubeVideoController');
const { loadActivity } = require('../controllers/analyticsController');
const { ACTIONS, TOOL_TO_ACTION } = require('./actions');

/**
 * The Novard Agent: a tool-using assistant on LangChain.
 *
 * Each turn is a small agent loop. The model answers, and may call:
 *   - read tools, run straight away: get_my_workspace, search_youtube_videos
 *   - propose_* tools (agent/actions.js): these become confirmation cards
 *     that the student accepts or declines; nothing is created without a "Yes".
 * Tool results go back to the model, which then writes (or finishes) its
 * reply. Text is streamed to the client as it is generated.
 *
 * Memory is the same summary-buffer history as every other chat in the app,
 * with each message's action cards and their status included, so the agent
 * knows what it offered and what the student accepted.
 */

const MAX_STEPS = 5;               // model calls per turn
const MAX_PROPOSALS_PER_TURN = 2;
// A reply that tells the student to use a card ("just confirm below").
const CARD_MENTION = /\b(confirm(ing)? (it )?below|card below|(click|press|tap) (yes|confirm)|just confirm)\b/i;
const CARD_SENTENCE = /[^.!?\n]*\b(confirm(ing)? (it )?below|card below|(click|press|tap) (yes|confirm)|just confirm)\b[^.!?\n]*[.!?]?/gi;

const READ_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_my_workspace',
      description: 'See what the student already has in Novard-AI: their doubts, videos, roadmaps, learning plans with progress, skill-gap analyses and recent quiz scores. Use it to personalise advice, refer to their progress, and avoid proposing something they already have.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_youtube_videos',
      description: 'Search YouTube for tutorial videos. Returns up to 5 results with videoId, title, channel and duration. Required before propose_add_video.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Specific search, e.g. "React useEffect hook explained"' } },
        required: ['query'],
      },
    },
  },
];

const TOOLS = [...READ_TOOLS, ...Object.values(ACTIONS).map((a) => a.tool)];

function systemPrompt({ userName }) {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `You are Novard Agent, the AI learning and career assistant inside the Novard-AI platform. You can teach, and you can also do things in the app for the student.
Today is ${today}.${userName ? ` The student's name is ${userName}.` : ''}

WHAT YOU CAN DO IN THE APP (always as a proposal the student confirms with Yes / No):
- propose_create_doubt: save a question as a doubt in Doubt Clearance (they can keep chatting about it, get a summary, videos and a quiz).
- propose_add_video: add a YouTube video to their Video Summarizer library (search_youtube_videos first; never invent a video id).
- propose_generate_roadmap: generate a personalised career roadmap towards a role in Smart Roadmap.
- propose_create_skill_plan: build a day-by-day learning plan for one skill in Skill Unlocker.
- propose_skill_gap_analysis: compare their skills with a target role in Skill Gap Analysis.
- propose_forum_post: start an AI Forum discussion when other students' experience would help.
You can also look at their workspace (get_my_workspace) and search YouTube (search_youtube_videos).

HOW TO WORK
1. Decide whether ONE action from the list below would genuinely help. If it would, CALL its propose_* tool FIRST, before writing anything (after search_youtube_videos / get_my_workspace if you need them). Only a tool call creates the card - words alone do not.
2. Then write your full answer - proposing a card never makes the answer shorter. For a concept doubt, actually teach it: a clear explanation, a small code or real-world example, common mistakes and how to fix them. Greet them naturally if they greet you.
Which action fits (fill it in from what they told you):
   - a doubt about a concept -> propose_create_doubt
   - they want a video / to learn by watching -> search_youtube_videos, pick the single best result, propose_add_video
   - "what should I do to become X", career direction -> propose_generate_roadmap (use the skills and level they mentioned as knownSkills / level)
   - "teach me X in N days", wants a structured schedule -> propose_create_skill_plan
   - "what am I missing for role X", readiness -> propose_skill_gap_analysis
   - wants opinions or experiences from others -> propose_forum_post
   If they ask you directly to create something, propose it straight away.
3. If you proposed an action, end your reply with one short sentence pointing to the card, e.g. "I can save this as a doubt so you can quiz yourself on it - just confirm below." The card shows the details, so do not repeat them. If you did not call a propose_* tool, do not mention a card or confirming.
4. The proposal is NOT done until the student confirms. Never say you created, added or generated something unless the conversation shows that action with status "done".
5. Only ask a question when the ESSENTIAL detail is missing: the target role (roadmap, skill gap) or the skill (learning plan). Everything else - level, hours per week, timeline, experience - you infer from what they said (e.g. "I know Linux, Git and Docker basics" -> intermediate for DevOps) or fill with sensible defaults. Never ask about those; the card shows them and the student can tell you to change them.
   For a career question, also give real advice in your answer (the main stages, what to focus on first given what they know), not just the card.
6. Use get_my_workspace when their existing work matters (their progress, scores, or to avoid a duplicate). If they already have a matching item, point them to it instead of proposing a new one.
7. Do not offer an action for small talk, and do not offer again something they declined in this chat.
8. Be warm, specific and concise. Use their name occasionally.

${FORMAT_RULES}`;
}

/** What the model remembers of a stored message: its text plus the status of its action cards. */
function messageForModel(m) {
  const cards = (m.actions || []).map((a) => {
    const def = ACTIONS[a.type];
    const what = def ? `${def.label}: ${def.summary(a.args || {})}` : a.type;
    const status = { proposed: 'waiting for the student to confirm', running: 'being created', done: `done${a.result?.note ? ` (${a.result.note})` : ''}`, dismissed: 'declined by the student', failed: `failed: ${a.error || 'unknown error'}` }[a.status] || a.status;
    return `[Action card - ${what} - status: ${status}]`;
  });
  return [m.content, ...cards].filter(Boolean).join('\n\n');
}

// ── read tools ─────────────────────────────────────────────────────────────

async function workspace(userId) {
  const [doubts, videos, roadmaps, plans, gaps, activity] = await Promise.all([
    DoubtClearance.find({ userId }).sort({ createdAt: -1 }).limit(10).select('title createdAt').lean(),
    YouTubeVideo.find({ userId }).sort({ createdAt: -1 }).limit(10).select('title createdAt').lean(),
    Roadmap.find({ userId }).sort({ createdAt: -1 }).limit(5).select('role inputs.level totalWeeks createdAt').lean(),
    SkillPlan.find({ userId }).sort({ createdAt: -1 }).limit(8).select('skillName duration dailyPlan.completed createdAt').lean(),
    SkillGapSession.find({ userId }).sort({ updatedAt: -1 }).limit(5).select('profile.targetRole analysis.readiness analysis.gaps.skill updatedAt').lean(),
    loadActivity(userId).then((r) => r.data).catch(() => null),
  ]);
  const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
  return {
    doubts: doubts.map((d) => ({ title: d.title, created: day(d.createdAt) })),
    videos: videos.map((v) => ({ title: v.title, added: day(v.createdAt) })),
    roadmaps: roadmaps.map((r) => ({ role: r.role, level: r.inputs?.level, weeks: r.totalWeeks, created: day(r.createdAt) })),
    learningPlans: plans.map((p) => ({
      skill: p.skillName,
      daysCompleted: (p.dailyPlan || []).filter((d) => d.completed).length,
      totalDays: (p.dailyPlan || []).length,
    })),
    skillGapAnalyses: gaps.map((g) => ({
      targetRole: g.profile?.targetRole,
      readiness: g.analysis?.readiness,
      topGaps: (g.analysis?.gaps || []).slice(0, 4).map((x) => x.skill),
    })),
    recentQuizzes: (activity?.attempts || [])
      .sort((a, b) => b.at - a.at)
      .slice(0, 6)
      .map((a) => ({ topic: a.topic, score: `${Math.round(a.percentage)}%`, questions: a.questions, date: day(a.at) })),
  };
}

// ── the turn ───────────────────────────────────────────────────────────────

const newActionId = () => crypto.randomBytes(6).toString('hex');

/**
 * Run one turn. `emit(event, data)` streams to the client:
 *   token {text} · status {text} · action {action} · done {message}
 */
async function runTurn({ conversationId, userId, userName, input, emit, signal }) {
  const filter = { _id: conversationId, userId };
  const history = new MongoChatHistory({ Model: ChatbotConversation, filter, field: 'messages', timeKey: 'createdAt', toText: messageForModel });
  const past = await history.getMessages();

  const userMessage = { role: 'user', content: input, createdAt: new Date() };
  await ChatbotConversation.updateOne(filter, { $push: { messages: userMessage } });

  const messages = [new SystemMessage(systemPrompt({ userName })), ...past, new HumanMessage(input)];
  const base = chatModel({ tier: 'REASONING', maxTokens: 3000, temperature: 0.5 });
  const withTools = base.bindTools(TOOLS);

  const ctx = { userId, searchResults: new Map() };
  const actions = [];
  let text = '';
  let stopped = false;

  const runTool = async (call) => {
    const name = call.name;
    const args = call.args || {};
    if (name === 'get_my_workspace') {
      emit('status', { text: 'Looking at your workspace…' });
      return workspace(userId);
    }
    if (name === 'search_youtube_videos') {
      const query = String(args.query || '').slice(0, 120);
      emit('status', { text: `Searching YouTube for “${query}”…` });
      const videos = await searchVideos(query, 5).catch(() => []);
      videos.forEach((v) => ctx.searchResults.set(v.videoId, v));
      return videos.length
        ? videos.map(({ videoId, title, channelName, duration }) => ({ videoId, title, channelName, duration }))
        : { error: 'No results. Try a different query.' };
    }
    const type = TOOL_TO_ACTION[name];
    if (!type) return { error: `Unknown tool ${name}` };
    if (actions.length >= MAX_PROPOSALS_PER_TURN) {
      return { error: 'You have already made enough proposals this turn. Finish your reply.' };
    }
    try {
      const clean = ACTIONS[type].normalize(args, ctx);
      const action = { id: newActionId(), type, status: 'proposed', args: clean, updatedAt: new Date() };
      actions.push(action);
      emit('action', { action });
      return {
        ok: true,
        note: 'The card is shown to the student; it is NOT created until they press Yes. Now write your COMPLETE answer to their message - teach it as thoroughly as you would without the card (explanation, example, common mistakes). End with one short sentence pointing to the card.',
      };
    } catch (error) {
      return { error: error.message };
    }
  };

  try {
    for (let step = 0; step < MAX_STEPS; step += 1) {
      // The last step has no tools, so the turn always ends with words for the student.
      const llm = step === MAX_STEPS - 1 ? base : withTools;
      let aggregate = null;
      let stepText = '';
      // A rate limit is only retried before any text has been streamed for this step.
      // eslint-disable-next-line no-await-in-loop
      await withRateLimitRetry(async () => {
        aggregate = null;
        const stream = await llm.stream(messages, { signal });
        for await (const chunk of stream) {
          aggregate = aggregate ? aggregate.concat(chunk) : chunk;
          const delta = typeof chunk.content === 'string' ? chunk.content : '';
          if (delta) {
            if (!stepText && text) {
              text += '\n\n';
              emit('token', { text: '\n\n' });
            }
            stepText += delta;
            text += delta;
            emit('token', { text: delta });
          }
        }
      }, {
        retries: 3,
        onWait: (seconds) => {
          if (stepText) throw Object.assign(new Error('rate limited mid-reply'), { status: 429 });
          emit('status', { text: `The AI is busy - continuing in ${seconds}s…` });
        },
      });

      const calls = aggregate?.tool_calls || [];
      if (!calls.length) break;

      messages.push(new AIMessage({ content: stepText, tool_calls: calls }));
      for (const call of calls) {
        // eslint-disable-next-line no-await-in-loop
        const result = await runTool(call);
        messages.push(new ToolMessage({ content: JSON.stringify(result).slice(0, 6000), tool_call_id: call.id }));
      }
      emit('status', { text: '' });
    }
  } catch (error) {
    // Stopped by the student: keep what was written so far instead of losing the turn.
    if (!signal?.aborted) throw error;
    stopped = true;
  }

  // Safety net: the reply points to a card ("confirm below") but no tool was called.
  // Ask once more with a tool call required, so the words and the cards agree.
  if (!stopped && !actions.length && CARD_MENTION.test(text)) {
    try {
      const forced = await base.bindTools(Object.values(ACTIONS).map((a) => a.tool), { tool_choice: 'required' })
        .invoke([...messages, new AIMessage(text), new HumanMessage('(system) Your reply refers to a confirmation card, but you did not call a propose_* tool. Call the one tool that matches what you offered now. Do not write text.')], { signal });
      for (const call of (forced.tool_calls || []).slice(0, 1)) await runTool(call); // eslint-disable-line no-await-in-loop
    } catch (error) {
      console.warn('Agent: could not recover the missing action card:', error.message);
    }
    if (!actions.length) text = text.replace(CARD_SENTENCE, '').trim();
  }

  text = text.trim();
  if (stopped) {
    const partial = { role: 'assistant', content: text ? `${text}\n\n*(stopped)*` : '*(stopped)*', createdAt: new Date() };
    if (actions.length) partial.actions = actions;
    await ChatbotConversation.updateOne(filter, { $push: { messages: partial } });
    return partial;
  }
  if (!text && !actions.length) {
    throw Object.assign(new Error('The agent did not reply. Please try again.'), { status: 502 });
  }
  if (!text) text = 'Here is what I can set up for you:';

  const reply = { role: 'assistant', content: text, createdAt: new Date() };
  if (actions.length) reply.actions = actions;
  await ChatbotConversation.updateOne(filter, { $push: { messages: reply } });
  return reply;
}

/** A short title for a new chat, from its first message. */
async function titleFor(input) {
  try {
    const res = await chatModel({ tier: 'FAST', maxTokens: 400, temperature: 0.3 }).invoke([
      new SystemMessage('Write a 2-6 word title for a chat that starts with the message below. Title case, no quotes, no trailing punctuation. Return only the title.'),
      new HumanMessage(String(input).slice(0, 1000)),
    ]);
    const title = String(res.content || '').replace(/["'`*#]/g, '').replace(/\s+/g, ' ').trim();
    return title && title.length <= 80 ? title : null;
  } catch {
    return null;
  }
}

module.exports = { runTurn, titleFor, messageForModel, _internal: { systemPrompt, workspace } };
