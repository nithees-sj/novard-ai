/**
 * Tolerant JSON extraction for language-model output.
 *
 * Models are asked to "return ONLY a JSON array", and usually do - but not
 * always. Observed failure modes that a bare JSON.parse cannot survive:
 *   - wrapped in ```json ... ``` fences
 *   - preceded or followed by a sentence of prose
 *   - a trailing comma before the closing ] or }
 *   - smart quotes substituted for straight quotes
 *   - // or /* *\/ comments inside the structure
 *
 * These produced intermittent "Failed to parse ..." errors on quiz and plan
 * generation, which looked random because the same prompt usually succeeds.
 */

/** Pull out the first balanced [...] or {...}, ignoring braces inside strings. */
function extractBalanced(text) {
  const start = text.search(/[[{]/);
  if (start === -1) return null;

  const open = text[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];

    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  // Unterminated (usually a max_tokens truncation) - let the caller fail.
  return null;
}

function stripFences(text) {
  return text
    .replace(/^\s*```(?:json|javascript|js)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

function repair(text) {
  return text
    // comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:"'\\])\/\/[^\n\r]*/g, '$1')
    // smart quotes
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    // trailing commas before a closing bracket
    .replace(/,\s*([\]}])/g, '$1')
    .trim();
}

/**
 * @param {string} raw            model output
 * @param {object} [options]
 * @param {string} [options.context] label used in the thrown error
 * @returns {any} the parsed value
 * @throws {Error} when nothing parseable can be recovered
 */
function parseModelJson(raw, options = {}) {
  const { context = 'model response' } = options;

  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(
      `Empty ${context}. The model returned no content - this usually means the ` +
      `token budget was consumed before any answer was produced.`
    );
  }

  const candidates = [];
  const unfenced = stripFences(raw);

  candidates.push(unfenced);
  const balanced = extractBalanced(unfenced);
  if (balanced) candidates.push(balanced);
  candidates.push(repair(unfenced));
  if (balanced) candidates.push(repair(balanced));

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next strategy
    }
  }

  const preview = raw.length > 300 ? `${raw.slice(0, 300)}…` : raw;
  throw new Error(`Could not parse ${context} as JSON. Received: ${preview}`);
}

module.exports = { parseModelJson };
