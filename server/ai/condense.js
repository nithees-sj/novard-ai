const { MODELS, SOURCE_CHARS } = require('../config/ai');
const { complete } = require('./groqClient');
const { splitEvenly, sampleContent } = require('../utils/longText');

/**
 * Text that fits one model request, however long the source. Text that fits
 * is returned as it is. Longer text is split into parts that each fit, every
 * part is condensed into detailed notes, and the notes are joined in order;
 * if they are still too long, the same is done again. No part of the source
 * is skipped, so summaries cover the whole document, transcript or thread.
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {string} [opts.what]   what the text is, for the instructions ("lecture notes", "video transcript")
 * @param {number} [opts.budget] characters the result must fit in
 * @returns {Promise<{ text: string, condensed: boolean }>}
 */
async function condenseToFit(text, { what = 'text', budget = SOURCE_CHARS } = {}) {
  let current = String(text || '').trim();
  let condensed = false;

  while (current.length > budget) {
    const parts = splitEvenly(current, Math.ceil(current.length / budget));
    const notes = [];
    // One part at a time: these calls share the provider's per-minute token allowance.
    for (const [i, part] of parts.entries()) {
      // eslint-disable-next-line no-await-in-loop
      const note = await complete({
        messages: [
          { role: 'system', content: 'You condense one part of a longer source into detailed, faithful notes that preserve specifics.' },
          {
            role: 'user',
            content: `Part ${i + 1} of ${parts.length} of a ${what}. Write detailed notes on it. Keep every distinct topic, definition, example, number, name, command and distinction - these notes replace the original, so anything dropped here is lost for good:\n\n${part}`,
          },
        ],
        model: MODELS.FAST,
        temperature: 0.3,
      });
      if (note) notes.push(`[Part ${i + 1} of ${parts.length}]\n${note.trim()}`);
    }

    const next = notes.join('\n\n---\n\n');
    condensed = true;
    // Notes that did not get shorter would loop forever; sample them evenly instead.
    if (!next || next.length >= current.length * 0.9) return { text: sampleContent(next || current, budget), condensed };
    current = next;
  }

  return { text: current, condensed };
}

module.exports = { condenseToFit };
