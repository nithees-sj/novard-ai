const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const { chatModel, withRateLimitRetry } = require('../ai/conversation');

/**
 * A short, specific title for a doubt, written from what the student asked.
 * Students often type a one-word title ("react") and then the real question
 * in the description, so the list and the heading showed the same thing twice
 * or nothing useful. The title now names the exact concept instead.
 */

const MAX_TITLE = 70;

const SYSTEM = [
  'You name a student\'s doubt in a learning app.',
  'Write ONE title of 3 to 8 words that names the exact concept or problem, e.g.',
  '"How useEffect Dependencies Trigger Re-renders", "Docker Volumes vs Bind Mounts", "Getting Started with React Hooks".',
  'Rules: Title Case; specific, not generic ("React Question" is bad); do not start with "Doubt", "Question" or "Help";',
  'no quotes, no emoji, no trailing punctuation. Reply with the title only.',
].join('\n');

const clean = (text) => String(text || '')
  .replace(/^title:\s*/i, '')
  .replace(/["'`*#_]/g, '')
  .replace(/\s+/g, ' ')
  .replace(/[.!?:;,\s]+$/, '')
  .trim();

/** Fallback when the model is unavailable: the student's own title, or the start of the question. */
function fallbackTitle({ title, description }) {
  const own = clean(title);
  if (own.length >= 12) return own.slice(0, MAX_TITLE);
  const text = clean(description);
  return text.length > MAX_TITLE ? `${text.slice(0, MAX_TITLE - 1).replace(/\s+\S*$/, '')}…` : text || own || 'New doubt';
}

async function contextualTitle({ title, description }) {
  try {
    const res = await withRateLimitRetry(() => chatModel({ tier: 'FAST', maxTokens: 300, temperature: 0.3 }).invoke([
      new SystemMessage(SYSTEM),
      new HumanMessage(`Title the student typed: ${String(title || '(none)').slice(0, 200)}\nTheir question: ${String(description || '').slice(0, 1500)}`),
    ]), { retries: 1 });
    const generated = clean(res.content);
    const words = generated.split(' ').length;
    if (generated && generated.length <= MAX_TITLE && words >= 2 && words <= 12) return generated;
  } catch (error) {
    console.warn('Doubt title could not be generated:', error.message);
  }
  return fallbackTitle({ title, description });
}

module.exports = { contextualTitle, fallbackTitle };
