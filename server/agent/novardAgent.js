const crypto = require('crypto');
const { SystemMessage, HumanMessage, AIMessage, ToolMessage } = require('@langchain/core/messages');
const ChatbotConversation = require('../models/chatbotConversation');
const DoubtClearance = require('../models/doubtClearance');
const YouTubeVideo = require('../models/youtubeVideo');
const Roadmap = require('../models/roadmap');
const SkillPlan = require('../models/skillPlan');
const SkillGapSession = require('../models/skillGapSession');
const { chatModel, MongoChatHistory } = require('../ai/conversation');
const { withRateLimitRetry } = require('../ai/errors');
const { FORMAT_RULES } = require('../ai/prompts');
const { searchVideos } = require('../services/youtubeService');
const { loadActivity } = require('../services/analyticsService');
const { getProfile, profileForPrompt } = require('../services/learnerProfileService');
const logger = require('../utils/logger');
const { runWithAi } = require('../ai/aiContext');
const { ACTIONS, PROFILE_UPDATE, SUGGEST_TOOL, KIND_TO_TYPE, PREPARE_TO_TYPE, defFor, summarize, withMeta, prepareArgs, draftLine } = require('./actions');

/**
 * The Novard Agent: a tool-using assistant on LangChain.
 *
 * Each turn is a small agent loop. The model answers, and may call:
 *   - read tools, run straight away: get_my_workspace, search_youtube_videos
 *   - suggest_next_step (agent/actions.js): a small offer card after answering
 *     a question; "Yes" continues in the chat
 *   - prepare_*: when the student wants something created. The server checks
 *     what the item needs against the conversation and the learner profile,
 *     and either reports what is missing or shows an editable DRAFT card
 *   - ask_student: the missing details as questions with tap-to-answer
 *     options; the turn ends there
 *   - remember_about_student: a "Remember this?" card for the learner profile
 * Nothing is created during a turn: the student presses Create on a draft
 * (agent/conversations.js). Text is streamed to the client as it is generated.
 *
 * Memory is the same summary-buffer history as every other chat in the app,
 * with each message's cards, drafts and questions included, so the agent
 * knows where each request stands.
 */

const MAX_STEPS = 5;               // model calls per turn
const MAX_ACTIONS_PER_TURN = 2;

// A learning question (as opposed to small talk), which should come with a suggestion.
const LEARNING_QUESTION = /(\?|\b(what|how|why|when|where|which|explain|difference|doubt|confus|understand|learn|teach|should i|help me|tell me)\b)/i;
const NO_SUGGESTION = {
  type: 'function',
  function: { name: 'no_suggestion', description: 'Nothing fits, or the student already declined it in this chat.', parameters: { type: 'object', properties: {} } },
};
// A reply that tells the student to use a card ("just confirm below").
const CARD_MENTION = /\b(confirm(ing)? (it )?below|card below|(click|press|tap) (yes|confirm)|just confirm)\b/i;
const CARD_SENTENCE = /[^.!?\n]*\b(confirm(ing)? (it )?below|card below|(click|press|tap) (yes|confirm)|just confirm)\b[^.!?\n]*[.!?]?/gi;

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

const READ_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_my_workspace',
      description: 'See what the student already has in Novard-AI: their doubts, videos, roadmaps, learning plans with progress, skill-gap analyses and recent quiz scores. Use it to personalise advice, refer to their progress, and suggest what to do next.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_youtube_videos',
      description: 'Search YouTube for tutorial videos. Returns up to 5 results with videoId, title, channel and duration.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Specific search, e.g. "React useEffect hook explained"' } },
        required: ['query'],
      },
    },
  },
];

const ASK_TOOL = {
  type: 'function',
  function: {
    name: 'ask_student',
    description: 'Ask the student for the details you need, shown as questions with tap-to-answer options (they can also type their own answer). Put everything a prepare_* result reports as missing into ONE call. Your reply ends after this.',
    parameters: {
      type: 'object',
      properties: {
        intro: { type: ['string', 'null'], description: 'Optional one short, friendly sentence shown above the questions' },
        questions: {
          type: 'array',
          maxItems: 4,
          items: {
            type: 'object',
            properties: {
              key: { type: ['string', 'null'], description: 'The field it fills, e.g. "level"' },
              question: { type: 'string', description: 'Short and clear, e.g. "Where are you starting from?"' },
              options: { type: 'array', items: { type: 'string' }, description: '3-5 short answers tailored to this student, most likely first' },
              multiSelect: { type: ['boolean', 'null'], description: 'true when several options can apply (e.g. skills they know)' },
            },
            required: ['question', 'options'],
          },
        },
      },
      required: ['questions'],
    },
  },
};

const TOOLS = [...READ_TOOLS, ASK_TOOL, SUGGEST_TOOL, PROFILE_UPDATE.tool, ...Object.values(ACTIONS).map((a) => a.prepareTool)];

// Groq refuses a tool call whose arguments do not match its schema; the step is retried once.
const TOOL_CALL_REJECTED = /tool call validation failed|tool_use_failed|failed to call a function/i;

function systemPrompt({ userName, profileText }) {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `You are Novard Agent, the AI learning and career assistant inside the Novard-AI platform. You teach, and you create things in the app for the student - accurately, built around what they actually need.
Today is ${today}.${userName ? ` The student's name is ${userName}.` : ''}

WHAT YOU KNOW ABOUT THE STUDENT (their learner profile)
${profileText}
Use it to personalise answers and drafts. Values marked "not confirmed" are only hints.

WHAT YOU CAN CREATE IN THE APP
- Doubt Clearance: a doubt they keep chatting about, with a summary, videos and a quiz.
- Video Summarizer: a YouTube video in their library (chat, summary, quiz).
- Smart Roadmap: a personalised, staged career roadmap towards a role.
- Skill Unlocker: a day-by-day learning plan for one skill (10-60 days).
- Skill Gap Analysis: their skills compared with a target role.
- AI Forum: a public discussion when other students' experience would help.
You never create anything yourself. prepare_* shows the student a DRAFT with every detail filled in, which they check and create. suggest_next_step offers one of these as a small card after an answer.
You can also look at their workspace (get_my_workspace), search YouTube (search_youtube_videos), ask questions with tap-to-answer options (ask_student) and offer to remember facts about them (remember_about_student).

FIRST DECIDE WHAT THE MESSAGE IS

B) A REQUEST TO CREATE - checked first. They ask you to create, make, build, generate, find, fetch, add, save, post or set up one of the things above ("make me a roadmap", "find me a short video on git branching", "create a doubt about Docker", "a 7-day plan for React"), or say yes to your offer, or send details for something they asked for earlier.
   Then do NOT write the item in the chat (no roadmap, plan or explanation in your reply) - prepare it:
   1. Your FIRST step is always the matching prepare_* call - before asking anything, even if a value looks wrong or details are missing; the server checks everything at once and tells you exactly what to ask. Pass what you know from the conversation, listing in \`stated\` only the fields the student actually told you. Leave out what you do not know - never guess to fill the form.
   2. The result says what to do next:
      - needs_info: call ask_student ONCE with ALL the missing questions (up to 4), each with 3-5 short options tailored to what you know (for a broad doubt topic like "Docker", offer its 4 most likely sub-concepts; when an item has a hint, make that value the first option). Options are plain answers - never "Hint:" or instructions. One short, friendly sentence before it, nothing else.
      - invalid: in the same ask_student call, explain the limit (e.g. plans run 10-60 days) and offer valid values, together with any missing questions.
      - exists: say they already have it, with its progress and where, and ask (ask_student) whether to continue it or make a new one. For a new one, call prepare_* again with allowDuplicate true.
      - drafted: reply in one or two short sentences: what you prepared, that they can change any field and press Create, and any assumption worth checking.
      - error: fix what it says (for example write the title yourself - never ask the student for a title, category or tags).
   3. When they answer, call prepare_* again with ALL the details so far, the new ones included in \`stated\`.
   4. To change a draft ("make it 20 days", "add Kubernetes"), call prepare_* again with the change; the new draft replaces the old one.
   Ask only what the result reports as missing. Never ask about what you already know.

A) A QUESTION or learning request - "what is Docker?", "I have a doubt in React hooks", "how do I become a DevOps engineer?", "explain volumes".
   1. Answer fully: a clear explanation, a small code or real-world example, common mistakes.
   2. Every real learning question also gets ONE offer - call suggest_next_step (only a tool call creates the card; words alone do not): doubt for a concept · roadmap for career direction · skill_plan to learn a skill over time · skill_gap_analysis for readiness for a role · video when a video would help · forum_post for other students' experience.
   3. End with one short sentence pointing to the card, e.g. "Want to keep going on this? I can save it as a doubt - just confirm below." If you did not call suggest_next_step, do not mention a card.
   No offers for small talk, and never offer again something they declined in this chat.

ALWAYS
- Never say something was created unless the conversation shows its card with status "done". A draft is not created yet.
- If they mention a lasting fact about themselves (level, experience, skills, weekly time, goal, preferred language or style) outside a draft, you may offer remember_about_student - once per fact.
- Use get_my_workspace when their existing work matters (progress, scores, what to do next).
- Be warm, specific and concise. Use their name occasionally.

${FORMAT_RULES}`;
}

const CARD_STATUS = {
  proposed: (a) => (a.type === 'profile_update' ? 'waiting for the student to say Yes' : 'offered, waiting for Yes / No'),
  accepted: () => 'the student said Yes - call prepare_* for it now',
  draft: () => 'draft shown, NOT created yet - waiting for the student to press Create (for changes, call prepare_* again)',
  running: () => 'being created',
  done: (a) => `created${a.result?.note ? ` (${a.result.note})` : ''}`,
  dismissed: () => 'declined by the student',
  superseded: () => 'replaced by a newer draft',
  failed: (a) => `failed: ${a.error || 'unknown error'}`,
};

/** A draft's details, so the agent can revise it. */
const draftDetails = (args) => {
  const { candidates, ...rest } = args || {};
  const out = { ...rest, ...(candidates ? { videoChoices: candidates.map((c) => c.title) } : {}) };
  return JSON.stringify(out).slice(0, 900);
};

/** What the model remembers of a stored message: its text plus its cards and questions. */
function messageForModel(m) {
  const cards = (m.actions || []).map((a) => {
    const def = defFor(a.type);
    const kind = a.status === 'draft' || a.origin === 'requested' ? 'Draft' : 'Offer';
    const what = def ? `${def.label}: ${summarize(a.type, a.args || {})}` : a.type;
    const status = (CARD_STATUS[a.status] || (() => a.status))(a);
    return `[${kind} - ${what} - status: ${status}${a.status === 'draft' ? ` - details: ${draftDetails(a.args)}` : ''}]`;
  });
  const ask = m.ask?.questions?.length ? [`[You asked, with tap-to-answer options: ${m.ask.questions.map((q) => q.question).join(' | ')}]`] : [];
  return [m.content, ...cards, ...ask].filter(Boolean).join('\n\n');
}

/** The agent's questions, cleaned; null when there are none. */
function readAsk(args) {
  const questions = (Array.isArray(args.questions) ? args.questions : []).slice(0, 4)
    .filter((q) => q && typeof q === 'object')
    .map((q) => ({
      key: clean(q.key, 40),
      question: clean(q.question, 300),
      options: (Array.isArray(q.options) ? q.options : []).map((o) => clean(o, 80)).filter(Boolean).slice(0, 6),
      multiSelect: q.multiSelect === true,
    }))
    .filter((q) => q.question);
  return questions.length ? { intro: clean(args.intro, 300), questions } : null;
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
 *   token {text} · status {text} · action {action} · ask {ask} · superseded {type, except} · done {message}
 */
async function runTurn({ conversationId, userId, userName, input, emit, signal }) {
  const filter = { _id: conversationId, userId };
  const history = new MongoChatHistory({ Model: ChatbotConversation, filter, field: 'messages', timeKey: 'createdAt', toText: messageForModel });
  const [past, learner] = await Promise.all([
    history.getMessages(),
    getProfile(userId).catch(() => ({ profile: {}, derivedKeys: [] })),
  ]);

  const userMessage = { role: 'user', content: input, createdAt: new Date() };
  await ChatbotConversation.updateOne(filter, { $push: { messages: userMessage } });

  const messages = [
    new SystemMessage(systemPrompt({ userName, profileText: profileForPrompt(learner) })),
    ...past,
    new HumanMessage(input),
  ];
  const base = chatModel({ tier: 'REASONING', maxTokens: 3000, temperature: 0.5 });
  const withTools = base.bindTools(TOOLS);

  const ctx = { userId, searchResults: new Map(), emit };
  const actions = [];
  const drafted = []; // drafts shown this turn, for the fixed confirmation
  const rechecked = new Set(); // action types whose missing details the model was asked to re-check
  let ask = null;
  let text = '';
  let stopped = false;

  // A new draft replaces any earlier, unanswered offer or draft of the same kind.
  const supersede = async (type, exceptId) => {
    const open = ['proposed', 'draft'];
    await ChatbotConversation.updateOne(filter, {
      $set: { 'messages.$[m].actions.$[a].status': 'superseded', 'messages.$[m].actions.$[a].updatedAt': new Date() },
    }, {
      arrayFilters: [{ 'm.actions': { $elemMatch: { type, status: { $in: open } } } }, { 'a.type': type, 'a.status': { $in: open } }],
    }).catch(() => {});
    actions.forEach((a) => { if (a.type === type && open.includes(a.status) && a.id !== exceptId) a.status = 'superseded'; });
    emit('superseded', { type, except: exceptId });
  };

  const addCard = (action) => {
    actions.push(action);
    emit('action', { action: withMeta(action) });
  };

  const runTool = async (call) => {
    const name = call.name;
    const args = call.args && typeof call.args === 'object' ? call.args : {};
    if (name === 'get_my_workspace') {
      emit('status', { text: 'Looking at your workspace…' });
      return workspace(userId);
    }
    if (name === 'search_youtube_videos') {
      const query = clean(args.query, 120);
      emit('status', { text: `Searching YouTube for “${query}”…` });
      const videos = await searchVideos(query, 5).catch(() => []);
      videos.forEach((v) => ctx.searchResults.set(v.videoId, v));
      return videos.length
        ? videos.map(({ videoId, title, channelName, duration }) => ({ videoId, title, channelName, duration }))
        : { error: 'No results. Try a different query.' };
    }
    if (name === ASK_TOOL.function.name) {
      if (ask) return { error: 'You already asked your questions this turn. Stop here.' };
      ask = readAsk(args);
      if (!ask) return { error: 'Pass at least one question.' };
      emit('ask', { ask });
      return { ok: true, note: 'The questions are shown with tap-to-answer options. Stop here; do not repeat them.' };
    }
    if (actions.length >= MAX_ACTIONS_PER_TURN) {
      return { error: 'You have already added enough cards this turn. Finish your reply.' };
    }
    if (name === PROFILE_UPDATE.tool.function.name) {
      let patch;
      try {
        patch = PROFILE_UPDATE.normalize(args);
      } catch (error) {
        return { error: error.message };
      }
      addCard({ id: newActionId(), type: 'profile_update', origin: 'suggested', status: 'proposed', args: patch, updatedAt: new Date() });
      return { ok: true, note: 'The "Remember this?" card is shown; it is saved only if they press Yes. Continue your reply.' };
    }

    if (name === SUGGEST_TOOL.function.name) {
      const type = KIND_TO_TYPE[args.kind];
      if (!type) return { error: `kind must be one of: ${Object.keys(KIND_TO_TYPE).join(', ')}.` };
      const topic = clean(args.topic, 160);
      if (topic.length < 2) return { error: 'Say what the suggestion is about (topic).' };
      addCard({ id: newActionId(), type, origin: 'suggested', status: 'proposed', args: { topic, ...(args.reason ? { reason: clean(args.reason, 240) } : {}) }, updatedAt: new Date() });
      return {
        ok: true,
        note: 'The offer card is shown; nothing happens unless they press Yes. Now write your COMPLETE answer to their message - teach it as thoroughly as you would without the card. End with one short sentence pointing to the card.',
      };
    }

    // prepare: check the requirements, then show a draft.
    const type = PREPARE_TO_TYPE[name];
    if (!type) return { error: `Unknown tool ${name}` };
    const def = ACTIONS[type];
    // An empty call means the model skipped reading the request: it is sent back once to fill it in.
    const given = (Array.isArray(args.stated) && args.stated.length)
      || def.fields.some((f) => ![undefined, null, ''].includes(args[f.key]) && !(Array.isArray(args[f.key]) && !args[f.key].length));
    if (!given && !rechecked.has(type)) {
      rechecked.add(type);
      return { error: `You passed no details. Fill in everything the student already said - their message: "${input.slice(0, 400)}" - list those fields in stated, and call ${name} again. It then tells you what is really missing.` };
    }
    const draft = prepareArgs(def, args, { stated: args.stated, profile: learner.profile, derivedKeys: learner.derivedKeys });
    // What only the student can answer comes first; what the agent writes itself (a title) after.
    if (draft.missing.length || draft.invalid.length) {
      // The first time, the model re-reads what the student said: often the detail is already there.
      const recheck = !rechecked.has(type);
      rechecked.add(type);
      return {
        status: draft.invalid.length ? 'invalid' : 'needs_info',
        ...(draft.invalid.length ? { invalid: draft.invalid } : {}),
        ...(draft.missing.length ? { missing: draft.missing } : {}),
        ...(recheck ? { studentSaid: input.slice(0, 400) } : {}),
        next: recheck
          ? `First check the conversation and studentSaid: if the student already gave any of these (e.g. the skill, a number of days), call ${name} again with ALL of them listed in stated. Otherwise call ask_student once with the questions (tailor the options), after one short sentence.`
          : 'Call ask_student once with these questions (tailor the options to this student), after one short sentence. Then stop.',
      };
    }
    if (draft.autoMissing.length) {
      return { error: `Write the ${draft.autoMissing.join(' and ')} yourself from what the student said (never ask them), then call ${name} again.` };
    }
    if (def.findExisting && args.allowDuplicate !== true) {
      const existing = await def.findExisting(draft.args, userId).catch(() => null);
      if (existing) {
        return {
          status: 'exists',
          existing: { what: existing.label, progress: existing.progress, where: def.section },
          next: 'Tell them, and ask (ask_student) whether to continue that one or create a new one.',
        };
      }
    }
    if (def.complete) {
      try {
        await def.complete(draft.args, args, ctx);
      } catch (error) {
        return { error: error.message };
      }
    }
    const action = { id: newActionId(), type, origin: 'requested', status: 'draft', args: draft.args, provenance: draft.provenance, updatedAt: new Date() };
    await supersede(type, action.id);
    addCard(action);
    drafted.push(action);
    const assumed = Object.keys(draft.provenance).filter((k) => draft.provenance[k] === 'assumed');
    return {
      status: 'drafted',
      draft: `${def.label}: ${summarize(type, draft.args)}`,
      ...(assumed.length ? { assumed } : {}),
      note: 'The draft card is shown; every field is editable and nothing is created until they press Create. Reply in one or two short sentences.',
    };
  };

  let toolRetried = false;
  let emptyRetried = false;
  try {
    for (let step = 0; step < MAX_STEPS; step += 1) {
      // The last step has no tools, so the turn always ends with words for the student.
      const llm = step === MAX_STEPS - 1 ? base : withTools;
      let aggregate = null;
      let stepText = '';
      // A rate limit is only retried before any text has been streamed for this step.
      // eslint-disable-next-line no-await-in-loop
      const ran = await withRateLimitRetry(async () => {
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
        return true;
      }, {
        retries: 3,
        onWait: (seconds) => {
          if (stepText) throw Object.assign(new Error('rate limited mid-reply'), { status: 429 });
          emit('status', { text: `The AI is busy - continuing in ${seconds}s…` });
        },
      }).catch((error) => {
        if (signal?.aborted || stepText || toolRetried || !TOOL_CALL_REJECTED.test(String(error?.message))) throw error;
        toolRetried = true;
        logger.warn('Agent: tool call rejected, retrying the step', { error: String(error.message).slice(0, 300) });
        messages.push(new HumanMessage('(system) Your last tool call was rejected because its arguments did not match the schema. Call it again, leaving out any field you do not know instead of sending an empty or invalid value.'));
        return false;
      });
      if (!ran) { step -= 1; continue; }

      const calls = aggregate?.tool_calls || [];
      // The reasoning model occasionally returns nothing at all (only its hidden reasoning): try once more.
      if (!calls.length && !stepText.trim() && !text.trim() && !emptyRetried && !actions.length && !ask) {
        emptyRetried = true;
        step -= 1;
        continue;
      }
      if (!calls.length) break;

      messages.push(new AIMessage({ content: stepText, tool_calls: calls }));
      for (const call of calls) {
        // eslint-disable-next-line no-await-in-loop
        const result = await runTool(call);
        messages.push(new ToolMessage({ content: JSON.stringify(result).slice(0, 6000), tool_call_id: call.id }));
      }
      emit('status', { text: '' });
      if (ask) break; // the reply ends with the questions
      // A draft is shown: confirm it with a fixed line rather than another model call.
      if (drafted.length && !stepText.trim()) {
        const line = drafted.filter((a) => a.status === 'draft').map((a) => draftLine(a.type, a.args, a.provenance)).join('\n\n');
        if (line) {
          text += `${text ? '\n\n' : ''}${line}`;
          emit('token', { text: text === line ? line : `\n\n${line}` });
        }
        break;
      }
    }
  } catch (error) {
    // Stopped by the student: keep what was written so far instead of losing the turn.
    if (!signal?.aborted) throw error;
    stopped = true;
  }

  if (ask && !text.trim()) {
    text = ask.intro || 'A few quick questions so I get this exactly right:';
    emit('token', { text });
  }

  // Safety nets, one extra (small) model call at most:
  //  - the reply points to a card ("confirm below") but no tool was called; or
  //  - a real learning question was answered without the offer it should come with.
  const mentionsCard = CARD_MENTION.test(text);
  const missingSuggestion = text.length > 300 && LEARNING_QUESTION.test(input);
  if (!stopped && !ask && !actions.length && (mentionsCard || missingSuggestion)) {
    try {
      const forced = await withRateLimitRetry(() => base.bindTools([SUGGEST_TOOL, NO_SUGGESTION], { tool_choice: 'required' }).invoke([
        ...messages,
        new AIMessage(text),
        new HumanMessage(mentionsCard
          ? '(system) Your reply refers to a confirmation card, but you did not call suggest_next_step. Call it for what you offered. Do not write text.'
          : '(system) Pick the ONE offer that would help this student most next and call suggest_next_step. If nothing fits, or they declined it earlier in this chat, call no_suggestion. Do not write text.'),
      ], { signal }));
      for (const call of (forced.tool_calls || []).filter((c) => c.name === SUGGEST_TOOL.function.name).slice(0, 1)) await runTool(call); // eslint-disable-line no-await-in-loop
    } catch (error) {
      logger.warn('Agent: could not add the suggestion card', { error: error.message });
    }
    if (!actions.length && mentionsCard) text = text.replace(CARD_SENTENCE, '').trim();
    if (actions.length && !mentionsCard) {
      const line = `\n\n${ACTIONS[actions[0].type].suggestLine}`;
      text += line;
      emit('token', { text: line });
    }
  }

  text = text.trim();
  const save = async (content) => {
    const stored = { role: 'assistant', content, createdAt: new Date() };
    if (actions.length) stored.actions = actions;
    if (ask) stored.ask = ask;
    await ChatbotConversation.updateOne(filter, { $push: { messages: stored } });
    return { ...stored, ...(actions.length ? { actions: actions.map(withMeta) } : {}) };
  };
  if (stopped) return save(text ? `${text}\n\n*(stopped)*` : '*(stopped)*');
  if (!text && !actions.length) {
    throw Object.assign(new Error('The agent did not reply. Please try again.'), { status: 502 });
  }
  return save(text || 'Here is what I prepared for you:');
}

/** A short title for a new chat, from its first message. */
async function titleFor(input) {
  try {
    const res = await runWithAi({ feature: 'agent.title' }, () => chatModel({ tier: 'FAST', maxTokens: 400, temperature: 0.3 }).invoke([
      new SystemMessage('Write a 2-6 word title for a chat that starts with the message below. Title case, no quotes, no trailing punctuation. Return only the title.'),
      new HumanMessage(String(input).slice(0, 1000)),
    ]));
    const title = String(res.content || '').replace(/["'`*#]/g, '').replace(/\s+/g, ' ').trim();
    return title && title.length <= 80 ? title : null;
  } catch {
    return null;
  }
}

module.exports = { runTurn, titleFor, messageForModel, _internal: { systemPrompt, workspace, readAsk } };
