const crypto = require('crypto');
const { SystemMessage, HumanMessage, AIMessage, ToolMessage } = require('@langchain/core/messages');
const ChatbotConversation = require('../models/chatbotConversation');
const DoubtClearance = require('../models/doubtClearance');
const YouTubeVideo = require('../models/youtubeVideo');
const Roadmap = require('../models/roadmap');
const SkillPlan = require('../models/skillPlan');
const SkillGapSession = require('../models/skillGapSession');
const { chatModel, MongoChatHistory, withRateLimitRetry, friendlyAIError } = require('../ai/conversation');
const { FORMAT_RULES } = require('../ai/prompts');
const { searchVideos } = require('../controllers/youtubeVideoController');
const { loadActivity } = require('../controllers/analyticsController');
const { ACTIONS, TOOL_TO_ACTION } = require('./actions');

/**
 * The Novard Agent: a tool-using assistant on LangChain.
 *
 * Each turn is a small agent loop. The model answers, and may call:
 *   - read tools, run straight away: get_my_workspace, search_youtube_videos
 *   - propose_* tools (agent/actions.js): suggestions after answering a
 *     question; they become cards the student accepts or declines
 *   - do tools (create_doubt, add_video, ...): the student asked for it, so it
 *     is created straight away and the card shows the result. The server only
 *     allows these when the student's message is actually a request.
 * Tool results go back to the model, which then writes (or finishes) its
 * reply. Text is streamed to the client as it is generated.
 *
 * Memory is the same summary-buffer history as every other chat in the app,
 * with each message's action cards and their status included, so the agent
 * knows what it offered and what the student accepted.
 */

const MAX_STEPS = 5;               // model calls per turn
const MAX_ACTIONS_PER_TURN = 2;
// A message that asks the agent to do something ("create…", "add…", "fetch me…", "yes").
// Do tools are refused unless this or the previous student message is such a request,
// so a plain question can never create something without a Yes.
const TASK_INTENT = /\b(create|add|make|generate|build|save|post|start|run|set ?up|fetch|find|get|give|show|recommend|put|assign|analy[sz]e|plan|schedule|yes|yeah|yep|ok|okay|sure|do it|go ahead|confirm)\b/i;
// A COMMAND to create something in the app ("create a doubt about…", "fetch me a video on…",
// "make a roadmap…"), or "yes" to a suggestion. Commands are done - or the one missing detail
// asked for - and never explained: the reply is a fixed confirmation (see DONE_LINES).
const COMMAND = /\b(create|make|add|generate|build|save|post|start|run|set ?up|fetch|find|get|give|put|assign|schedule)\b[\s\S]{0,80}?\b(doubts?|videos?|roadmaps?|plans?|schedule|analysis|skill ?gaps?|forum|discussion|post)\b/i;
const AFFIRM = /^\s*(yes|yeah|yep|ok|okay|sure|do it|go ahead|please do|create it|add it|make it)\b/i;
const COMMAND_NOTE = 'The next student message is a COMMAND to do something in the app. Call the matching do tool now - or, only if the essential detail is missing (the specific concept for a doubt, the role for a roadmap or skill gap, the skill for a plan), ask ONE short question. Do not explain or teach anything and do not suggest anything.';

// A learning question (as opposed to small talk), which should come with a suggestion.
const LEARNING_QUESTION = /(\?|\b(what|how|why|when|where|which|explain|difference|doubt|confus|understand|learn|teach|should i|help me|tell me)\b)/i;
const NO_SUGGESTION = {
  type: 'function',
  function: { name: 'no_suggestion', description: 'Nothing fits, or the student already declined it in this chat.', parameters: { type: 'object', properties: {} } },
};
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

const TOOLS = [...READ_TOOLS, ...Object.values(ACTIONS).flatMap((a) => [a.tool, a.doTool])];

function systemPrompt({ userName }) {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `You are Novard Agent, the AI learning and career assistant inside the Novard-AI platform. You can teach, and you can also do things in the app for the student.
Today is ${today}.${userName ? ` The student's name is ${userName}.` : ''}

WHAT YOU CAN DO IN THE APP
- Doubt Clearance: save a doubt (they keep chatting about it, get a summary, videos and a quiz).
- Video Summarizer: add a YouTube video to their library (search_youtube_videos first; never invent a video id).
- Smart Roadmap: generate a personalised career roadmap towards a role.
- Skill Unlocker: build a day-by-day learning plan for one skill.
- Skill Gap Analysis: compare their skills with a target role.
- AI Forum: start a discussion when other students' experience would help.
Each has two tools: propose_* (a suggestion card they confirm with Yes / No) and a do tool (create_doubt, add_video, generate_roadmap, create_skill_plan, run_skill_gap_analysis, post_to_forum) that does it immediately.
You can also look at their workspace (get_my_workspace) and search YouTube (search_youtube_videos).

FIRST DECIDE WHAT THE MESSAGE IS

A) A QUESTION or learning request - "what is Docker?", "I have a doubt in React hooks", "how do I become a DevOps engineer?", "explain volumes".
   1. Every real learning question gets ONE suggestion - it is expected, not optional. Call the matching propose_* tool FIRST (only a tool call creates the card; words alone do not):
      concept doubt -> propose_create_doubt · career direction -> propose_generate_roadmap · wants to learn a skill over time -> propose_create_skill_plan · readiness for a role -> propose_skill_gap_analysis · a video would help -> search_youtube_videos then propose_add_video · wants others' experience -> propose_forum_post.
   2. Then answer fully - a suggestion never makes the answer shorter. For a concept: a clear explanation, a small code or real-world example, common mistakes.
   3. End with one short sentence pointing to the card, e.g. "Want to keep going on this? I can save it as a doubt - just confirm below." If you did not call a propose_* tool, do not mention a card.
   Do not suggest anything for small talk, and do not suggest again something they declined in this chat.

B) A TASK - they tell you to do something in the app: "create a doubt about…", "add / fetch / find me a video on…", "make me a roadmap for…", "make a 14-day plan for…", "analyse my skills for…", "post this in the forum", or "yes" / "go ahead" to your suggestion.
   1. Check you have what the task needs:
      - doubt: a SPECIFIC concept or question. "Create a doubt about Docker" is too broad - ask which concept (offer 3-4 options such as images vs containers, volumes, networking, writing a Dockerfile) and wait for the answer. "Create a doubt about Docker volumes" is enough.
      - video: a topic. Call search_youtube_videos, pick the single best result.
      - roadmap or skill gap: the target role. Learning plan: the skill. Forum post: the actual question.
      Infer everything else (level, hours, timeline, known skills) from the conversation or use sensible defaults - never ask about those.
   2. When you have it, call the do tool straight away - no suggestion card, no Yes/No, no lecture.
   3. Then reply in one or two short sentences: what you created and where (the card below shows it with an Open button). Only explain the topic if they also asked a question.
   If they only answered your clarifying question (e.g. "volumes"), that completes the task - create it now.

ALWAYS
- Never say something was created unless a tool result says it was, or the conversation shows its card with status "done".
- If a task fails, say so briefly; the card has a Try again button.
- Use get_my_workspace when their existing work matters (progress, scores, or to avoid a duplicate); if they already have that exact item, point them to it.
- Be warm, specific and concise. Use their name occasionally.

${FORMAT_RULES}`;
}

/** What the model remembers of a stored message: its text plus the status of its action cards. */
function messageForModel(m) {
  const cards = (m.actions || []).map((a) => {
    const def = ACTIONS[a.type];
    const what = def ? `${def.label}: ${def.summary(a.args || {})}` : a.type;
    const status = { proposed: 'suggested, waiting for the student to confirm', running: 'being created', done: `done${a.result?.note ? ` (${a.result.note})` : ''}`, dismissed: 'declined by the student', superseded: 'replaced by a later request', failed: `failed: ${a.error || 'unknown error'}` }[a.status] || a.status;
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

  const lastOf = (type) => String([...past].reverse().find((m) => m._getType?.() === type)?.content || '');
  const lastStudentMessage = lastOf('human');
  const isTask = TASK_INTENT.test(input) || TASK_INTENT.test(lastStudentMessage);
  // A command, "yes" to a suggestion, or the answer to the question the agent asked about a command.
  const isCommand = COMMAND.test(input) || AFFIRM.test(input)
    || (COMMAND.test(lastStudentMessage) && /\?/.test(lastOf('ai')) && lastOf('ai').length < 800); // a short clarifying question, often followed by options

  const messages = [
    new SystemMessage(systemPrompt({ userName })),
    ...past,
    ...(isCommand ? [new SystemMessage(COMMAND_NOTE)] : []),
    new HumanMessage(input),
  ];
  const base = chatModel({ tier: 'REASONING', maxTokens: 3000, temperature: 0.5 });
  const withTools = base.bindTools(TOOLS);

  const ctx = { userId, searchResults: new Map() };

  // A task that has now been done makes any earlier, unanswered suggestion of the same kind moot.
  const supersede = async (type, exceptId) => {
    await ChatbotConversation.updateOne(filter, {
      $set: { 'messages.$[m].actions.$[a].status': 'superseded', 'messages.$[m].actions.$[a].updatedAt': new Date() },
    }, {
      arrayFilters: [{ 'm.actions': { $elemMatch: { type, status: 'proposed' } } }, { 'a.type': type, 'a.status': 'proposed' }],
    }).catch(() => {});
    actions.forEach((a) => { if (a.type === type && a.status === 'proposed' && a.id !== exceptId) a.status = 'superseded'; });
    emit('superseded', { type, except: exceptId });
  };
  const actions = [];
  let text = '';
  let stopped = false;
  let commandDone = false;

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
    const tool = TOOL_TO_ACTION[name];
    if (!tool) return { error: `Unknown tool ${name}` };
    const { type, mode } = tool;
    const def = ACTIONS[type];
    if (actions.length >= MAX_ACTIONS_PER_TURN) {
      return { error: 'You have already done enough this turn. Finish your reply.' };
    }
    if (mode === 'propose' && isCommand) {
      return { error: `The student told you to do this. Call ${def.doTool.function.name} now, or ask the one missing detail. Do not explain.` };
    }
    if (mode === 'do' && !isTask) {
      return { error: `The student asked a question, not for you to create anything. Use ${def.tool.function.name} to suggest it instead.` };
    }

    let clean;
    try {
      clean = def.normalize(args, ctx);
    } catch (error) {
      return { error: error.message };
    }

    if (mode === 'propose') {
      const action = { id: newActionId(), type, origin: 'suggested', status: 'proposed', args: clean, updatedAt: new Date() };
      actions.push(action);
      emit('action', { action });
      return {
        ok: true,
        note: 'The suggestion card is shown; it is NOT created until they press Yes. Now write your COMPLETE answer to their message - teach it as thoroughly as you would without the card. End with one short sentence pointing to the card.',
      };
    }

    // The student asked for it: do it now and show the result on the card.
    const action = { id: newActionId(), type, origin: 'requested', status: 'running', args: clean, updatedAt: new Date() };
    actions.push(action);
    emit('action', { action: { ...action } });
    try {
      const result = await def.run(clean, { userId, userName });
      Object.assign(action, { status: 'done', result, updatedAt: new Date() });
      emit('action', { action: { ...action } });
      await supersede(type, action.id);
      return {
        done: true,
        created: `${def.label}: ${def.summary(clean)}`,
        where: def.section,
        ...(result.note ? { details: result.note } : {}),
        note: 'It is created and shown on a card with an Open button. Confirm in one or two short sentences what you created and where. Do not explain the topic unless they also asked a question.',
      };
    } catch (error) {
      console.error(`Agent task ${type} failed:`, error.cause || error);
      const reason = friendlyAIError(error.cause || error, error.status === 502 && error.message ? error.message : 'Something went wrong while creating it.');
      Object.assign(action, { status: 'failed', error: reason, updatedAt: new Date() });
      emit('action', { action: { ...action } });
      return { error: `It could not be created: ${reason} Tell the student briefly; the card has a Try again button.` };
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
              if (!isCommand) emit('token', { text: '\n\n' });
            }
            stepText += delta;
            text += delta;
            // A command's reply is held back: it is either a fixed confirmation or one short
            // question, and a stray explanation must never flash on screen.
            if (!isCommand) emit('token', { text: delta });
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

      // A commanded task has run: the reply is its confirmation, with no further model call.
      const finished = actions.filter((a) => a.origin === 'requested' && (a.status === 'done' || a.status === 'failed'));
      if (isCommand && finished.length) {
        text = finished.map((a) => (a.status === 'done'
          ? ACTIONS[a.type].doneLine(a.args, a.result)
          : `I couldn't ${ACTIONS[a.type].label.toLowerCase()}: ${a.error} You can try again from the card.`)).join('\n\n');
        commandDone = true;
        break;
      }
    }
  } catch (error) {
    // Stopped by the student: keep what was written so far instead of losing the turn.
    if (!signal?.aborted) throw error;
    stopped = true;
  }

  if (isCommand && text && !stopped) emit('token', { text: commandDone ? text : text.trim() });

  // Safety nets, one extra (small) model call at most:
  //  - the reply points to a card ("confirm below") but no tool was called; or
  //  - a real learning question was answered without the suggestion it should come with.
  const mentionsCard = CARD_MENTION.test(text);
  const missingSuggestion = !isTask && text.length > 300 && LEARNING_QUESTION.test(input);
  if (!stopped && !isCommand && !actions.length && (mentionsCard || missingSuggestion)) {
    try {
      // propose_add_video is left out: it needs a search first.
      const tools = Object.entries(ACTIONS).filter(([type]) => type !== 'add_video').map(([, a]) => a.tool);
      const forced = await withRateLimitRetry(() => base.bindTools([...tools, NO_SUGGESTION], { tool_choice: 'required' }).invoke([
        ...messages,
        new AIMessage(text),
        new HumanMessage(mentionsCard
          ? '(system) Your reply refers to a confirmation card, but you did not call a propose_* tool. Call the one that matches what you offered. Do not write text.'
          : '(system) Pick the ONE suggestion that would help this student most next, by calling its propose_* tool. If nothing fits, or they declined it earlier in this chat, call no_suggestion. Do not write text.'),
      ], { signal }));
      for (const call of (forced.tool_calls || []).filter((c) => c.name !== NO_SUGGESTION.function.name).slice(0, 1)) await runTool(call); // eslint-disable-line no-await-in-loop
    } catch (error) {
      console.warn('Agent: could not add the suggestion card:', error.message);
    }
    if (!actions.length && mentionsCard) text = text.replace(CARD_SENTENCE, '').trim();
    if (actions.length && !mentionsCard) {
      const line = `\n\n${ACTIONS[actions[0].type].suggestLine}`;
      text += line;
      emit('token', { text: line });
    }
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
