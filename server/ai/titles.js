const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const { chatModel } = require('./conversation');
const { withRateLimitRetry } = require('./errors');
const logger = require('../utils/logger');

/**
 * Short, specific titles for what students make (agent chats, doubts, notes),
 * so every list and heading reads like a professional product: 3 to 7 words,
 * Title Case, the exact topic, never "New Chat" or the first sentence pasted
 * in. One set of rules for every kind; a careful fallback when the model is
 * unavailable.
 */

const MAX_LENGTH = 60;
const MIN_WORDS = 2;
const MAX_WORDS = 8;

const KINDS = {
  chat: {
    what: 'a conversation between a student and an AI study assistant',
    examples: '"React useEffect Dependencies", "DevOps Engineer Learning Path", "SQL Joins Explained"',
  },
  doubt: {
    what: "a student's doubt (a concept or problem they are stuck on)",
    examples: '"How useEffect Dependencies Trigger Re-renders", "Docker Volumes vs Bind Mounts", "Fixing CORS Errors in Express"',
  },
  notes: {
    what: "a student's uploaded study notes (a PDF)",
    examples: '"Operating Systems: Memory Management", "DBMS Normalisation", "Computer Networks Unit 3"',
  },
};

const GENERIC = /^(new chat|chat|conversation|question|doubt|help|notes?|untitled|hello|hi|greetings?|general( question)?|study notes|document|pdf)$/i;
// Common acronyms students type in lower case.
const ACRONYMS = new Set(['ai', 'ml', 'api', 'apis', 'sql', 'nosql', 'html', 'css', 'js', 'ts', 'ui', 'ux', 'os', 'dbms', 'rdbms', 'oop', 'http', 'https', 'rest', 'json', 'jwt', 'aws', 'gcp', 'cli', 'ci', 'cd', 'cpu', 'gpu', 'dsa', 'dns', 'tcp', 'ip', 'llm', 'llms', 'nlp', 'iot', 'seo', 'php', 'xml', 'yaml', 'npm', 'jvm', 'sdk', 'ide']);
const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'vs', 'via', 'with']);
// Leading chatter a fallback title should not start with.
const LEADING = /^(hi|hello|hey|dear|ok(ay)?|so|please|pls|can you|could you|would you|i want to|i would like to|i have a (doubt|question)( in| about| on)?|i need help( with)?|help me( with)?|tell me( about)?|explain( to me)?|what is|what are|how do i|how to)\b[\s,!.:-]*/i;

/** Strip quotes, markdown, a "Title:" prefix and trailing punctuation. */
const clean = (value) => String(value || '')
  .split('\n')[0]
  .replace(/^\s*(title|chat title|name)\s*[:-]\s*/i, '')
  .replace(/["'`*#_]|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
  .replace(/\s+/g, ' ')
  .replace(/[.!?;,:\s-]+$/, '')
  .trim();

/** Title Case that keeps acronyms and code-ish words (useEffect, SQL, C++) as written. */
function titleCase(value) {
  return value.split(' ').map((word, i) => {
    if (/[A-Z]/.test(word.slice(1)) || /\d|[+#/]/.test(word)) return word; // useEffect, SQL, C++, 3D
    const lower = word.toLowerCase();
    if (ACRONYMS.has(lower)) return lower.toUpperCase();
    if (lower.includes('.')) return lower.charAt(0).toUpperCase() + lower.slice(1); // node.js -> Node.js
    if (i > 0 && SMALL_WORDS.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(' ');
}

/** True when a title is specific and short enough to show. */
function isGood(title) {
  if (!title || title.length > MAX_LENGTH || GENERIC.test(title)) return false;
  const words = title.split(' ').length;
  return words >= MIN_WORDS && words <= MAX_WORDS;
}

/** Without the model: the student's own words, minus greetings, cut at a word boundary. */
function fallbackTitle(text, { kind = 'chat', fileName } = {}) {
  let base = clean(String(text || '').replace(LEADING, '').replace(LEADING, ''));
  if (!base && fileName) base = clean(String(fileName).replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[_-]+/g, ' '));
  if (!base) return kind === 'notes' ? 'Untitled Notes' : kind === 'doubt' ? 'New Doubt' : 'New Chat';
  const words = base.split(' ');
  let title = '';
  for (const w of words) {
    if (`${title} ${w}`.trim().length > 48 || (title && title.split(' ').length >= MAX_WORDS)) break;
    title = `${title} ${w}`.trim();
  }
  title = clean(title || base.slice(0, 48));
  return titleCase(title);
}

/**
 * A title for `kind` ('chat' | 'doubt' | 'notes') from `text` (the student's
 * words, or the start of their notes), with optional `context` (the
 * assistant's reply, the student's own title, the file name). With
 * `allowNone`, returns null when there is no topic yet (a chat that opened
 * with "hi"), so the caller can title it on a later turn.
 */
async function makeTitle(kind, text, { context, fileName, allowNone = false } = {}) {
  const k = KINDS[kind] || KINDS.chat;
  const system = [
    `You write the title of ${k.what} in a learning app, shown in lists and headings.`,
    `Write ONE title of 3 to 7 words that names the exact topic, e.g. ${k.examples}.`,
    'Rules: Title Case; specific, never generic ("React Question", "New Chat", "Study Notes" are bad);',
    'do not start with "Doubt", "Question", "Help", "Chat" or "Notes on"; no greeting, quotes, emoji or trailing punctuation.',
    'Keep technical names exactly as written (useEffect, SQL, Node.js). Reply with the title only.',
    ...(allowNone ? ['If there is no topic yet (only a greeting or small talk), reply with exactly: NONE'] : []),
  ].join('\n');
  const parts = [`${kind === 'notes' ? 'Start of the notes' : 'The student wrote'}: ${String(text || '').slice(0, 1500)}`];
  if (context) parts.push(`Context: ${String(context).slice(0, 800)}`);
  if (fileName) parts.push(`File name: ${String(fileName).slice(0, 120)}`);

  try {
    const res = await withRateLimitRetry(() => chatModel({ tier: 'FAST', temperature: 0.2 }).invoke([
      new SystemMessage(system),
      new HumanMessage(parts.join('\n\n')),
    ]), { retries: 1 });
    if (allowNone && /^none\b/i.test(clean(res.content))) return null;
    const title = titleCase(clean(res.content));
    if (isGood(title)) return title;
  } catch (error) {
    logger.warn('Title could not be generated', { kind, error: error.message });
  }
  return fallbackTitle(text, { kind, fileName });
}

/** True for the placeholder a chat keeps until it has a topic. */
const isPlaceholder = (title) => !title || /^new (chat|doubt)$/i.test(String(title).trim());

module.exports = { makeTitle, fallbackTitle, titleCase, isGood, clean, isPlaceholder };
