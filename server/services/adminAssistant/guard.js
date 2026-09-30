/**
 * The admin assistant's guards (EWDI app/agent/copilot.py, extended).
 *
 *   evidence guard  a question about live data answered without any tool call
 *                   is sent back once with "look it up first" (EWDI)
 *   numeric check   every figure in the reply must appear in a tool result
 *                   (new: EWDI only checked that a tool was called)
 *   refusals        API keys, admin grants and account changes are the
 *                   console's alone: refused with a pointer to the page
 */

// EWDI DATA_WORDS / META, in Novard's vocabulary.
const DATA_WORDS = /\b(token|tokens|cost|costs|spend|spent|usd|dollar|price|risk|risky|score|scores|report|reports|area|areas|alert|alerts|run|runs|investigation|investigations|student|students|user|users|urgent|sentiment|volume|count|how many|number of|quota|gateway|gateways|groq|gemini|youtube|error|errors|latency|backlog|inbox|open|resolved|today|this week|yesterday)\b/i;
const META = /(what can you|who are you|what are you|how do you work|how does .* work|explain|what does .* mean|what is a |how is .* calculated|help me understand|can you )/i;

/** Should an answer given without any tool call be sent back to look things up? */
const needsEvidence = (question) => DATA_WORDS.test(question) && !META.test(question);

const REFUSALS = [
  {
    pattern: /\b(show|reveal|give|tell|change|rotate|set|update|replace|what(?:'s| is))\b.{0,40}\b(api[- ]?keys?|secret|jwt|credentials?|password)\b/i,
    reply: 'I can\'t show or change API keys or secrets. They live in the server environment (server/.env, or Secret Manager on Cloud Run), never in the app. The **Gateways** page shows whether each key is set and its last four characters.',
    page: '/admin/gateways',
  },
  {
    pattern: /\b(grant|give|make|promote|demote|revoke|remove|add)\b.{0,50}\b(admin|superadmin|admin access|admin rights|role)\b/i,
    reply: 'I can\'t grant or revoke admin access. A superadmin does that on the **Users** page (open the account, then change its role); every change is recorded in the audit log.',
    page: '/admin/users',
  },
  {
    pattern: /\b(suspend|ban|block|reactivate|unban|unblock|delete)\b.{0,40}\b(user|student|account|admin)s?\b/i,
    reply: 'I can\'t suspend, reactivate or delete accounts. Do it on the **Users** page, where the action is confirmed and audited.',
    page: '/admin/users',
  },
];

/** A refusal for requests only the console may carry out, or null. */
function refusalFor(input) {
  return REFUSALS.find((r) => r.pattern.test(String(input || ''))) || null;
}

// ── numeric check ──────────────────────────────────────────────────────────

const NUMBER = /(?<![\w.])(\$)?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(%)?/g;

/** Figures in a reply worth checking: skip single digits, list numbers and bare years. */
function figuresIn(text) {
  const out = [];
  String(text || '').replace(NUMBER, (match, dollar, int, frac, percent, offset, whole) => {
    const value = Number(`${int.replace(/,/g, '')}${frac || ''}`);
    const isListMarker = /^\s*$/.test(whole.slice(Math.max(0, whole.lastIndexOf('\n', offset - 1) + 1), offset)) && whole[offset + match.length] === '.';
    const isYear = !frac && !percent && !dollar && value >= 2000 && value <= 2100;
    const trivial = !frac && !percent && !dollar && value < 10;
    if (!isListMarker && !isYear && !trivial) out.push({ text: match, value, decimals: frac ? frac.length - 1 : 0, percent: Boolean(percent) });
    return match;
  });
  return out;
}

/** Every number that appears anywhere in the tool results. */
function numbersIn(results) {
  const values = [];
  const walk = (v) => {
    if (typeof v === 'number') values.push(v);
    else if (typeof v === 'string') (v.match(/-?\d+(?:\.\d+)?/g) || []).forEach((n) => values.push(Number(n)));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(results);
  return values;
}

const roundTo = (x, d) => Number(x.toFixed(d));

/** Is a figure from the reply backed by some tool number (allowing for rounding and percentages)? */
function supported(fig, values) {
  return values.some((r) => {
    const candidates = fig.percent ? [r, r * 100] : [r, r * 100];
    return candidates.some((c) => roundTo(c, fig.decimals) === fig.value || (fig.decimals === 0 && Math.round(c) === fig.value));
  });
}

/** The figures in `reply` that no tool result supports. */
function unsupportedFigures(reply, results) {
  const values = numbersIn(results);
  return figuresIn(reply).filter((fig) => !supported(fig, values)).map((f) => f.text);
}

module.exports = { needsEvidence, refusalFor, unsupportedFigures, figuresIn, numbersIn, DATA_WORDS, META, REFUSALS };
