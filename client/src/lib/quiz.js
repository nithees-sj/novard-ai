/**
 * Whether the option the student picked (an index 0-3) is the right one.
 *
 * Every quiz generated now stores the answer as an index, but older Notes
 * quizzes stored a letter ("C"), and answers read back from the database can
 * arrive as numeric strings ("2"). Comparing with === alone made every Notes
 * quiz score 0%: the chosen index 2 never equals the letter "C".
 */
export function isCorrectAnswer(question, chosenIndex) {
  if (chosenIndex === undefined || chosenIndex === null) return false;
  const answer = question?.correctAnswer;
  if (typeof answer === 'number') return answer === chosenIndex;
  const raw = String(answer ?? '').trim();
  if (/^\d+$/.test(raw)) return Number(raw) === chosenIndex;
  const letter = /^\(?([A-Da-d])(?:\)|\.|:)?(?:\s|$)/.exec(raw);
  if (letter) return letter[1].toUpperCase().charCodeAt(0) - 65 === chosenIndex;
  const options = question?.options || [];
  return options[chosenIndex] !== undefined && String(options[chosenIndex]).trim().toLowerCase() === raw.toLowerCase();
}

export const countCorrect = (questions = [], answers = {}) =>
  questions.reduce((n, q, i) => n + (isCorrectAnswer(q, answers[i]) ? 1 : 0), 0);

export const QUIZ_DIFFICULTIES = [
  { value: 'beginner', label: 'Beginner', hint: 'Definitions and core ideas' },
  { value: 'intermediate', label: 'Intermediate', hint: 'Applying and comparing concepts' },
  { value: 'advanced', label: 'Advanced', hint: 'Scenarios, trade-offs and reasoning' },
];

export const QUIZ_STYLES = [
  { value: 'conceptual', label: 'Conceptual' },
  { value: 'practical', label: 'Practical' },
  { value: 'mixed', label: 'Mixed' },
];

export const QUIZ_COUNTS = [5, 10, 15, 20];
export const QUIZ_MIN = 5;
export const QUIZ_MAX = 20;
export const QUIZ_DEFAULTS = { difficulty: 'intermediate', questionCount: 10, style: 'mixed', focus: '' };

export const difficultyLabel = (value) =>
  QUIZ_DIFFICULTIES.find((d) => d.value === value)?.label || null;
