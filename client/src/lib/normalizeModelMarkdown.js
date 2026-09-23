/**
 * Models occasionally emit a raw <br> instead of a real Markdown line break.
 *
 * react-markdown is deliberately configured without `rehype-raw`, so raw HTML
 * is inert text - which is what keeps model output from being an injection
 * surface, but also means a stray <br> is displayed literally to the user.
 *
 * Rather than re-enabling raw HTML for the sake of one tag, the break tags are
 * converted to a Markdown hard break before parsing. A hard break ("  \n")
 * is used instead of a bare newline so it works both in running prose and
 * ahead of a list marker or heading, which is where models put it most often.
 *
 * Content inside fenced blocks and inline code spans is left untouched: a note
 * about HTML should still show <br> verbatim in its examples.
 */

const BR_TAG = /<\s*br\s*\/?\s*>/gi;

/** Split on fenced code blocks and inline code, keeping the delimiters. */
const CODE_SEGMENT = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;

export function normalizeModelMarkdown(input) {
  if (typeof input !== 'string' || input === '') return input;
  if (!BR_TAG.test(input)) {
    BR_TAG.lastIndex = 0;
    return input;
  }
  BR_TAG.lastIndex = 0;

  return input
    .split(CODE_SEGMENT)
    .map((segment, index) =>
      // Odd indices are the captured code segments - leave them verbatim.
      index % 2 === 1 ? segment : segment.replace(BR_TAG, '  \n')
    )
    .join('');
}

export default normalizeModelMarkdown;
