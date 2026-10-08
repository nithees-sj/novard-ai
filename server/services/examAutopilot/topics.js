/**
 * Syllabus topics as the student confirms them: a name, a one-line summary,
 * an importance that becomes the topic's share of the exam, a difficulty and
 * the topics it builds on. Used for the model's draft and the student's edits.
 */

const MIN_TOPICS = 2;
const MAX_TOPICS = 15;
const flat = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Remove prerequisite links that would make a loop (A needs B needs A),
 * keeping the earlier topic as the foundation. `prereqs[i]` lists indexes.
 */
function removeCycles(prereqs) {
  const out = prereqs.map(() => []);
  const reaches = (from, to, seen = new Set()) => {
    if (from === to) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    return out[from].some((next) => reaches(next, to, seen));
  };
  const add = (i, p) => {
    if (p !== i && !out[i].includes(p) && !reaches(p, i)) out[i].push(p);
  };
  // Links that follow the syllabus order (building on an earlier topic) win;
  // a backward link is kept only when it makes no loop.
  prereqs.forEach((list, i) => [...list].sort((a, b) => a - b).filter((p) => p < i).forEach((p) => add(i, p)));
  prereqs.forEach((list, i) => [...list].sort((a, b) => a - b).filter((p) => p > i).forEach((p) => add(i, p)));
  return out.map((list) => list.sort((a, b) => a - b));
}

/**
 * Clean a list of topics. `ref(p)` turns one prerequisite reference into an
 * index into the list (the model gives indexes, the client gives keys).
 * Returns [{ name, summary, importance, weight, difficulty, prereqIdx, confidence }].
 */
function normaliseTopics(raw, { ref = (p) => Number(p), keepConfidence = false } = {}) {
  const seen = new Set();
  const list = (Array.isArray(raw) ? raw : []).map((t, i) => ({ t, i })).filter(({ t }) => {
    const name = flat(t?.name, 80);
    if (!name || seen.has(name.toLowerCase())) return false;
    seen.add(name.toLowerCase());
    return true;
  }).slice(0, MAX_TOPICS);
  if (list.length < MIN_TOPICS) return null;

  const position = new Map(list.map(({ i }, at) => [i, at]));
  const prereqs = removeCycles(list.map(({ t }) => (Array.isArray(t.prerequisites) ? t.prerequisites : [])
    .map((p) => position.get(ref(p)))
    .filter((p) => Number.isInteger(p))));

  const importance = list.map(({ t }) => {
    const n = Number(t.importance ?? t.weight);
    return Number.isFinite(n) && n > 0 ? Math.min(10, n) : 5;
  });
  const total = importance.reduce((s, n) => s + n, 0);

  return list.map(({ t }, at) => {
    const difficulty = Number(t.difficulty);
    const confidence = Number(t.confidence);
    return {
      name: flat(t.name, 80),
      summary: flat(t.summary, 300),
      importance: Math.round(importance[at] * 10) / 10,
      weight: importance[at] / total,
      difficulty: [1, 2, 3].includes(difficulty) ? difficulty : 2,
      prereqIdx: prereqs[at],
      confidence: keepConfidence && [1, 2, 3, 4, 5].includes(confidence) ? confidence : null,
    };
  });
}

module.exports = { MIN_TOPICS, MAX_TOPICS, normaliseTopics, removeCycles };
