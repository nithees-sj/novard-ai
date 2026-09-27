import { isCorrectAnswer, countCorrect, difficultyLabel } from '../quiz';

describe('isCorrectAnswer', () => {
  const q = (correctAnswer) => ({ correctAnswer, options: ['alpha', 'beta', 'gamma', 'delta'] });

  it.each([
    [q(2), 2, true],
    [q(2), 1, false],
    [q('2'), 2, true], // numeric string read back from the database
    [q('C'), 2, true], // older Notes quizzes stored a letter
    [q('(b)'), 1, true],
    [q('gamma'), 2, true], // the option text itself
    [q(0), undefined, false],
  ])('%j with choice %p -> %p', (question, choice, expected) => {
    expect(isCorrectAnswer(question, choice)).toBe(expected);
  });

  it('counts correct answers', () => {
    expect(countCorrect([q(0), q('B'), q(3)], { 0: 0, 1: 1, 2: 0 })).toBe(2);
    expect(countCorrect(undefined, {})).toBe(0);
  });

  it('labels difficulties', () => {
    expect(difficultyLabel('advanced')).toBe('Advanced');
    expect(difficultyLabel('nope')).toBeNull();
  });
});
