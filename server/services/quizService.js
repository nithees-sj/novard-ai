const Groq = require('groq-sdk');
const { MODELS, GROQ_DEFAULTS } = require('../config/ai');
const { parseModelJson } = require('../utils/parseModelJson');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * One quiz generator for every section (notes, videos, doubts, learning plans),
 * driven by the options the student picks before starting:
 *   difficulty     beginner | intermediate | advanced
 *   questionCount  5-20
 *   style          conceptual | practical | mixed
 *   focus          optional free text: a sub-topic to concentrate on
 *
 * Before this each section had its own prompt with a hard-coded question count
 * ("5-7", "at least 8"), its own answer format (Notes used letters, the rest
 * indexes), and two of them silently served placeholder questions when parsing
 * failed. Every quiz now comes back in one validated shape:
 *   { question, options: [4 strings], correctAnswer: 0-3, explanation }
 */

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
const STYLES = ['conceptual', 'practical', 'mixed'];
const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 20;
const DEFAULT_OPTIONS = { difficulty: 'intermediate', questionCount: 10, style: 'mixed', focus: '' };

const DIFFICULTY_GUIDE = {
  beginner:
    'BEGINNER - test recall and basic understanding: definitions, terminology, identifying the correct statement. ' +
    'Wrong options should be clearly wrong to someone who has read the material.',
  intermediate:
    'INTERMEDIATE - test application and comparison: "how would you use X", "what is the difference between A and B", ' +
    'choosing the right approach for a situation. Wrong options should be plausible misconceptions.',
  advanced:
    'ADVANCED - test reasoning: multi-step scenarios, trade-offs, predicting outcomes, diagnosing what went wrong. ' +
    'Every option should look reasonable; only careful understanding separates the right one.',
};

const STYLE_GUIDE = {
  conceptual: 'Ask about ideas, definitions, reasons and relationships between concepts.',
  practical: 'Ask scenario-based questions: given a situation, code snippet, command or problem, what happens or what should be done.',
  mixed: 'Mix conceptual questions with practical, scenario-based ones - roughly half and half.',
};

/** Read and clamp the student's choices from a request body. */
function readQuizOptions(body = {}) {
  const count = parseInt(body.questionCount, 10);
  return {
    difficulty: DIFFICULTIES.includes(body.difficulty) ? body.difficulty : DEFAULT_OPTIONS.difficulty,
    questionCount: Number.isFinite(count) ? Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, count)) : DEFAULT_OPTIONS.questionCount,
    style: STYLES.includes(body.style) ? body.style : DEFAULT_OPTIONS.style,
    focus: typeof body.focus === 'string' ? body.focus.replace(/\s+/g, ' ').trim().slice(0, 200) : '',
  };
}

/** Turn whatever the model gave as the answer into an option index, or -1. */
function toAnswerIndex(answer, options) {
  if (typeof answer === 'number' && Number.isInteger(answer)) return answer;
  const raw = String(answer ?? '').trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  // Exact option text first, so an answer like "Docker manages storage" is not read as the letter D.
  const byText = options.findIndex((o) => o.trim().toLowerCase() === raw.toLowerCase());
  if (byText !== -1) return byText;
  // A bare letter, "C.", "C)", "(C)", or "C) option text".
  const letter = /^\(?([A-Da-d])(?:\)|\.|:)?(?:\s|$)/.exec(raw);
  if (letter) return letter[1].toUpperCase().charCodeAt(0) - 65;
  return -1;
}

/** Strip "A. ", "B) " style prefixes so options can be shuffled and lettered by the UI. */
const stripOptionPrefix = (s) => String(s ?? '').replace(/^\s*\(?[A-Da-d][).:]\s+/, '').trim();

function normaliseQuestion(q) {
  if (!q || typeof q !== 'object') return null;
  const question = String(q.question ?? '').trim();
  const options = (Array.isArray(q.options) ? q.options : []).map(stripOptionPrefix).filter(Boolean);
  if (!question || options.length !== 4) return null;
  if (new Set(options.map((o) => o.toLowerCase())).size !== 4) return null; // duplicate options
  const correctAnswer = toAnswerIndex(q.correctAnswer ?? q.answer, options);
  if (!(correctAnswer >= 0 && correctAnswer <= 3)) return null;
  return {
    question,
    options,
    correctAnswer,
    explanation: String(q.explanation ?? '').trim() || 'This is the option supported by the material.',
  };
}

/**
 * Models put the right answer in the first two slots far more often than
 * chance (a 12-question test came back with it never in the 4th), which a
 * student can game. Shuffle each question's options and move the answer with them.
 */
function shuffleOptions(q) {
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...q, options: order.map((i) => q.options[i]), correctAnswer: order.indexOf(q.correctAnswer) };
}

function buildPrompt({ subject, content, options, count, avoid }) {
  return [
    `Write exactly ${count} multiple-choice questions for a student, based on the material below.`,
    '',
    `Subject: ${subject}`,
    `Difficulty: ${DIFFICULTY_GUIDE[options.difficulty]}`,
    `Question style: ${STYLE_GUIDE[options.style]}`,
    options.focus
      ? `Focus: concentrate on "${options.focus}". If the material covers it only briefly, still stay as close to it as the material allows.`
      : 'Coverage: spread the questions across the whole material, not just the beginning.',
    avoid.length ? `Do not repeat or rephrase any of these existing questions:\n${avoid.map((q) => `- ${q}`).join('\n')}` : '',
    '',
    'Rules:',
    '- Base every question on the material. Do not invent facts that are not in it.',
    '- Exactly 4 options per question, all distinct, with no "A." / "B)" prefixes.',
    '- Exactly one correct option. Avoid "all of the above" / "none of the above".',
    '- Vary which position (0-3) holds the correct answer.',
    '- "explanation" says in one or two sentences why the answer is right.',
    '',
    'Return ONLY a JSON array, no other text:',
    '[{"question": "...", "options": ["...", "...", "...", "..."], "correctAnswer": 0, "explanation": "..."}]',
    '',
    'MATERIAL:',
    content,
  ].filter((line) => line !== '').join('\n');
}

async function requestQuestions({ subject, content, options, count, avoid, model }) {
  const completion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are an expert educator who writes accurate, well-calibrated quiz questions. You always return valid JSON.' },
      { role: 'user', content: buildPrompt({ subject, content, options, count, avoid }) },
    ],
    model,
    ...GROQ_DEFAULTS,
    temperature: 0.6,
    // ~350 tokens per question with its explanation, plus headroom.
    max_tokens: Math.min(8000, 800 + count * 350),
  });
  const text = completion.choices[0]?.message?.content || '';
  const parsed = parseModelJson(text, { context: 'quiz' });
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : [];
  return list.map(normaliseQuestion).filter(Boolean);
}

/**
 * Generate a validated quiz. If the model returns fewer usable questions than
 * asked for, one follow-up request fills the gap; extras are trimmed. Throws
 * rather than returning placeholder questions.
 */
async function generateQuiz({ subject, content, options, model = MODELS.REASONING }) {
  const want = options.questionCount;
  let questions = await requestQuestions({ subject, content, options, count: want, avoid: [], model });

  if (questions.length < want) {
    const missing = want - questions.length;
    try {
      const more = await requestQuestions({
        subject, content, options, count: missing, avoid: questions.map((q) => q.question), model,
      });
      const seen = new Set(questions.map((q) => q.question.toLowerCase()));
      more.forEach((q) => {
        if (!seen.has(q.question.toLowerCase())) {
          seen.add(q.question.toLowerCase());
          questions.push(q);
        }
      });
    } catch (error) {
      console.warn('Quiz top-up request failed:', error.message);
    }
  }

  questions = questions.slice(0, want).map(shuffleOptions);
  if (questions.length === 0) {
    const error = new Error('The quiz could not be generated. Please try again.');
    error.status = 502;
    throw error;
  }
  return questions;
}

/**
 * Keep quiz material within the prompt budget while covering the whole
 * source: long text is sampled evenly from start to end rather than truncated
 * (the old notes quiz only ever read the first chunk of a document).
 */
function sampleContent(text, maxChars = 24000) {
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

/**
 * Normalise stored attempts from any section into one list, newest first,
 * with summary figures - used for the "previous marks" panel.
 */
function summariseAttempts(attempts) {
  const sorted = [...attempts].sort((a, b) => new Date(b.attemptedAt) - new Date(a.attemptedAt));
  const percentages = sorted.map((a) => a.percentage);
  return {
    attempts: sorted,
    stats: sorted.length === 0 ? null : {
      count: sorted.length,
      best: Math.max(...percentages),
      average: Math.round(percentages.reduce((s, p) => s + p, 0) / percentages.length),
      latest: percentages[0],
      change: sorted.length > 1 ? percentages[0] - percentages[1] : null,
    },
  };
}

module.exports = {
  DIFFICULTIES,
  STYLES,
  MIN_QUESTIONS,
  MAX_QUESTIONS,
  DEFAULT_OPTIONS,
  readQuizOptions,
  generateQuiz,
  sampleContent,
  summariseAttempts,
  _internal: { normaliseQuestion, toAnswerIndex, buildPrompt, shuffleOptions },
};
