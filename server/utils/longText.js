const { SOURCE_CHARS } = require('../config/ai');

/**
 * Helpers for source text that may be longer than one model request can carry
 * (config/ai.js REQUEST_TOKEN_LIMIT). None of them call a model; for reading a
 * whole long text through the model, see ai/condense.js.
 */

/** Source text a chat turn can carry beside its instructions and conversation memory. */
const CHAT_SOURCE_CHARS = Math.round(SOURCE_CHARS * 0.45);

/** Split text into chunks of roughly `maxTokens` tokens (1 token ≈ 0.75 words). */
function chunkText(input, maxTokens = 2000) {
  const words = input.split(' ');
  const chunks = [];
  let currentChunk = '';

  for (const word of words) {
    const testChunk = currentChunk + (currentChunk ? ' ' : '') + word;
    if ((testChunk.split(' ').length * 0.75) > maxTokens && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = word;
    } else {
      currentChunk = testChunk;
    }
  }

  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks;
}

/** Split text into `count` roughly equal parts, cutting at whitespace. */
function splitEvenly(input, count) {
  const parts = [];
  let start = 0;
  for (let i = 1; i < count; i += 1) {
    const target = Math.max(start, Math.round((input.length * i) / count));
    const next = input.slice(target).search(/\s/);
    const end = next === -1 ? input.length : target + next;
    parts.push(input.slice(start, end));
    start = end;
  }
  parts.push(input.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * All of the text if it fits `budget` characters, otherwise the chunks that
 * best match `query`, in document order - so a question about any part of a
 * long document or transcript finds that part.
 */
function relevantText(fullText, query, budget = CHAT_SOURCE_CHARS) {
  const all = String(fullText || '');
  if (all.length <= budget) return all;
  const chunks = chunkText(all, Math.max(150, Math.round(budget / 32))); // about four chunks per budget
  const words = String(query).toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const scored = chunks.map((chunk, index) => {
    const lower = chunk.toLowerCase();
    return { index, chunk, score: words.reduce((n, w) => n + (lower.includes(w) ? 1 : 0), 0) };
  });
  const picked = [];
  let used = 0;
  for (const c of [...scored].sort((a, b) => b.score - a.score || a.index - b.index)) {
    if (used + c.chunk.length > budget) continue;
    picked.push(c);
    used += c.chunk.length;
  }
  // A chunk can be longer than a small budget: then read the best one in part rather than nothing.
  if (!picked.length) return sampleContent(scored.sort((a, b) => b.score - a.score || a.index - b.index)[0].chunk, budget);
  return picked.sort((a, b) => a.index - b.index).map((c) => c.chunk).join('\n...\n');
}

/**
 * Keep material within one request while covering the whole source: long
 * text is sampled evenly from start to end rather than truncated.
 */
function sampleContent(text, maxChars = SOURCE_CHARS) {
  const clean = String(text || '').replace(/\s+\n/g, '\n').trim();
  if (clean.length <= maxChars) return clean;
  const parts = 6;
  const slice = Math.floor(maxChars / parts);
  const step = Math.floor((clean.length - slice) / (parts - 1));
  // The last window is anchored to the end so rounding never drops the final lines.
  return Array.from({ length: parts }, (_, i) =>
    i === parts - 1 ? clean.slice(clean.length - slice) : clean.slice(i * step, i * step + slice)
  ).join('\n...\n');
}

module.exports = { CHAT_SOURCE_CHARS, chunkText, splitEvenly, relevantText, sampleContent };
