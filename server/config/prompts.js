/**
 * Shared prompt fragments.
 *
 * Summaries are rendered client-side by MarkdownView (react-markdown +
 * remark-gfm), which renders GitHub-flavoured Markdown and turns ```mermaid
 * fences into real diagrams. These instructions exist so the models produce
 * exactly that.
 */

/**
 * Mermaid rules are spelled out because models reliably break the parser in
 * the same few ways: unquoted labels containing spaces or punctuation, the
 * reserved word `end` used as a node id, and markdown/parentheses inside a
 * label. An invalid diagram falls back to a plain code block client-side, so
 * a mistake degrades rather than breaks - but these rules keep it rare.
 */
const MARKDOWN_WITH_FLOWCHART = `
FORMAT — return GitHub-flavoured Markdown only. No preamble, no closing remark.

Depth — be thorough, not terse. Cover every distinct topic present in the
source, each under its own ### heading. For each topic explain what it is, why
it matters, and how it works or is used, and give a concrete example where one
applies. Define any term of art the first time it appears. Do not stop at a
list of labels; a reader who has not seen the source should be able to learn
the material from the summary alone. Aim for at least 500 words, more when the
source is dense.

Structure:
- Use ### for section headings, one per topic.
- Use bullet or numbered lists for points; a list item may run to several
  sentences where the idea needs it. Prefer explaining fully over trimming.
- Use a Markdown table when comparing three or more things across attributes.
- Use fenced code blocks with a language tag for any code.
- Close with a ### Key takeaways section.
- Use **bold** for key terms. Do not wrap the whole answer in a code block.
- Never emit raw HTML. In particular do not use <br> for a line break - start a
  new line or a new list item instead. HTML tags are shown to the user as
  literal text, not rendered.

REQUIRED — include exactly one Mermaid flowchart that shows how the main ideas
connect (a process, a hierarchy, or a decision path). Place it under its own
### heading near the top, right after the opening overview.

Mermaid rules — follow these exactly or the diagram will not render:
- Open the fence with \`\`\`mermaid and close it with \`\`\`.
- First line inside the fence must be: flowchart TD
- Node ids are short and alphanumeric only: A, B, C1, D2. Never use "end" as an id.
- Every label is wrapped in double quotes inside the shape:  A["Label text"]
- Labels contain plain text only — no parentheses, brackets, quotes, colons,
  semicolons, backticks, pipes, or Markdown markup inside a label.
- Connect nodes with -->  and label an edge as  A -->|"yes"| B
- Use between 4 and 10 nodes. Prefer one clear path over an exhaustive map.

Correct example:

\`\`\`mermaid
flowchart TD
    A["User request arrives"] --> B["Validate input"]
    B -->|"valid"| C["Process the job"]
    B -->|"invalid"| D["Return an error"]
    C --> E["Store the result"]
\`\`\`
`.trim();

module.exports = { MARKDOWN_WITH_FLOWCHART };
