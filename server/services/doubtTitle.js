const { makeTitle, fallbackTitle: tidyTitle, clean } = require('../ai/titles');

/**
 * A short, specific title for a doubt, written from what the student asked.
 * Students often type a one-word title ("react") and then the real question
 * in the description, so the list and the heading showed the same thing twice
 * or nothing useful. The title names the exact concept instead (shared rules
 * in ai/titles.js).
 */

const MAX_TITLE = 60;

/** Without the model: the student's own title when it says enough, else a tidy start of the question. */
function fallbackTitle({ title, description }) {
  const own = clean(title);
  if (own.length >= 12 && own.length <= MAX_TITLE) return tidyTitle(own, { kind: 'doubt' });
  return tidyTitle(description || own, { kind: 'doubt' });
}

async function contextualTitle({ title, description }) {
  const own = clean(title);
  const generated = await makeTitle('doubt', description || own, { context: own ? `Title the student typed: ${own}` : undefined });
  // makeTitle falls back to the description; prefer the student's own wording when it is usable.
  return generated || fallbackTitle({ title, description });
}

module.exports = { contextualTitle, fallbackTitle };
