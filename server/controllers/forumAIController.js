const { ChatPromptTemplate, MessagesPlaceholder } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { HumanMessage, AIMessage } = require('@langchain/core/messages');
const ForumComment = require('../models/forumComment');
const { chatModel, _internal: { estimateTokens } } = require('../ai/conversation');
const { FORMAT_RULES } = require('../ai/prompts');

/**
 * The AI participant in forum threads, on LangChain.
 *
 * A thread is a conversation between several people and the assistant, so the
 * assistant now reads the whole thread (oldest first, each human message
 * labelled with its author) instead of only the one comment it is answering.
 * "As Bob said above..." or "the command you suggested earlier" now work.
 *
 * Failures throw instead of returning a canned "Thank you for sharing this
 * issue!" that used to be posted as if it were a real answer.
 */

const THREAD_TOKEN_BUDGET = 8000;

const prompt = ChatPromptTemplate.fromMessages([
  ['system', '{system}'],
  new MessagesPlaceholder('thread'),
  ['human', '{input}'],
]);

const chain = (maxTokens = 1800) =>
  prompt.pipe(chatModel({ tier: 'REASONING', maxTokens, temperature: 0.5 })).pipe(new StringOutputParser());

function systemFor(issue) {
  return `You are the AI assistant in a technical Q&A forum. You are one participant in a thread with several people.

THE DISCUSSION
Title: ${issue.title}
Opened by: ${issue.userName}
Status: ${issue.status || 'open'}${issue.tags?.length ? `\nTags: ${issue.tags.join(', ')}` : ''}
Original post:
${issue.description}

How to take part:
- Read the whole thread. Build on what has already been said; do not repeat earlier answers, and correct them politely if they are wrong.
- When you refer to someone, use their name.
- Be specific: real tools, flags, APIs, commands and code in fenced blocks.

${FORMAT_RULES}`;
}

/** Thread comments as LangChain messages, oldest first, trimmed to the newest that fit the budget. */
async function threadMessages(issueId, { before } = {}) {
  const query = { issueId };
  if (before) query.createdAt = { $lt: before };
  const comments = await ForumComment.find(query).sort({ createdAt: 1 }).select('content userName isAI').lean();

  const messages = comments.map((c) => (c.isAI
    ? new AIMessage(c.content)
    : new HumanMessage(`${c.userName} wrote:\n${c.content}`)));

  let used = 0;
  let start = messages.length;
  while (start > 0 && used + estimateTokens(messages[start - 1].content) <= THREAD_TOKEN_BUDGET) {
    used += estimateTokens(messages[start - 1].content);
    start -= 1;
  }
  const kept = messages.slice(start);
  // A model conversation should not open on an assistant turn; drop a leading AI message if trimming left one.
  while (kept.length && kept[0] instanceof AIMessage) kept.shift();
  return kept;
}

const ensureText = (text) => {
  const reply = String(text || '').trim();
  if (!reply) throw new Error('The assistant returned an empty reply');
  return reply;
};

/** First answer on a new discussion. */
const generateAICommentForIssue = async (issue) => {
  const reply = await chain().invoke({
    system: systemFor(issue),
    thread: [],
    input: `${issue.userName} has just opened this discussion (see the original post above). Give a genuinely useful first answer, not a holding reply:
- one line on what is most likely going on
- ### Why this happens
- ### How to fix it - numbered steps, with commands or code where they apply
- ### How to confirm it worked
- ### If that does not help - the next thing to check`,
  });
  return ensureText(reply);
};

/** Reply to one comment, with everything said before it in the thread as context. */
const generateAIResponseToComment = async (userComment, issue) => {
  const thread = await threadMessages(issue.issueId, { before: userComment.createdAt });
  const reply = await chain().invoke({
    system: systemFor(issue),
    thread,
    input: `${userComment.userName} wrote:\n${userComment.content}\n\nReply to ${userComment.userName}'s comment. Address their specific point, use the rest of the thread as context, and include a concrete example, command or code where it helps. Keep it proportionate: a short comment usually needs a short reply.`,
  });
  return ensureText(reply);
};

/** One-off answer to a raw prompt (the /api/forum/ai-response endpoint). */
const generateAIForumResponse = async (text) => {
  const reply = await chain(1800).invoke({
    system: `You are a helpful AI assistant in a technical forum. Give constructive, specific, actionable answers and explain the reasoning.\n\n${FORMAT_RULES}`,
    thread: [],
    input: String(text),
  });
  return ensureText(reply);
};

module.exports = {
  generateAICommentForIssue,
  generateAIResponseToComment,
  generateAIForumResponse,
};
