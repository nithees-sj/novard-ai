jest.mock('../../ai/groqClient', () => ({ complete: jest.fn() }));

const { complete } = require('../../ai/groqClient');
const { readQuizOptions, generateQuiz, sampleContent, summariseAttempts, _internal } = require('../../services/quizService');
const { parseModelJson } = require('../../utils/parseModelJson');
const { quizJson } = require('../helpers/fixtures');

const { normaliseQuestion, toAnswerIndex, shuffleOptions } = _internal;

describe('readQuizOptions', () => {
  it('clamps and defaults the student’s choices', () => {
    expect(readQuizOptions({})).toEqual({ difficulty: 'intermediate', questionCount: 10, style: 'mixed', focus: '' });
    expect(readQuizOptions({ questionCount: '50', difficulty: 'expert', style: 'practical', focus: '  hooks \n and state ' }))
      .toEqual({ difficulty: 'intermediate', questionCount: 20, style: 'practical', focus: 'hooks and state' });
    expect(readQuizOptions({ questionCount: 1 }).questionCount).toBe(5);
  });
});

describe('toAnswerIndex', () => {
  const options = ['Docker manages storage', 'B', 'C', 'D'];
  it.each([
    [2, 2], ['3', 3], ['C', 2], ['(d)', 3], ['B) text', 1], ['Docker manages storage', 0], ['nonsense', -1],
  ])('%p -> %p', (answer, expected) => expect(toAnswerIndex(answer, options)).toBe(expected));
});

describe('normaliseQuestion', () => {
  it('strips option prefixes and keeps a valid question', () => {
    expect(normaliseQuestion({ question: ' Q? ', options: ['A. one', 'B) two', 'three', 'four'], answer: 'B' }))
      .toEqual({ question: 'Q?', options: ['one', 'two', 'three', 'four'], correctAnswer: 1, explanation: expect.any(String) });
  });

  it.each([
    ['three options', { question: 'Q', options: ['a', 'b', 'c'], correctAnswer: 0 }],
    ['duplicate options', { question: 'Q', options: ['a', 'A', 'b', 'c'], correctAnswer: 0 }],
    ['no question', { options: ['a', 'b', 'c', 'd'], correctAnswer: 0 }],
    ['answer out of range', { question: 'Q', options: ['a', 'b', 'c', 'd'], correctAnswer: 7 }],
  ])('drops a question with %s', (_, q) => expect(normaliseQuestion(q)).toBeNull());
});

describe('shuffleOptions', () => {
  it('moves the answer with its option', () => {
    for (let i = 0; i < 20; i += 1) {
      const q = shuffleOptions({ question: 'Q', options: ['right', 'w1', 'w2', 'w3'], correctAnswer: 0 });
      expect(q.options[q.correctAnswer]).toBe('right');
    }
  });
});

describe('generateQuiz', () => {
  afterEach(() => complete.mockReset());
  const options = { difficulty: 'beginner', questionCount: 5, style: 'mixed', focus: '' };

  it('returns exactly the requested number of validated questions', async () => {
    complete.mockResolvedValueOnce(`Here you go:\n\`\`\`json\n${quizJson(7)}\n\`\`\``);
    const questions = await generateQuiz({ subject: 'S', content: 'C', options });
    expect(questions).toHaveLength(5);
    questions.forEach((q) => expect(q.options[q.correctAnswer]).toMatch(/^Right/));
  });

  it('tops up a short quiz with one more request', async () => {
    complete.mockResolvedValueOnce(quizJson(3)).mockResolvedValueOnce(JSON.stringify([
      { question: 'Extra 1?', options: ['a', 'b', 'c', 'd'], correctAnswer: 1 },
      { question: 'Extra 2?', options: ['e', 'f', 'g', 'h'], correctAnswer: 2 },
    ]));
    const questions = await generateQuiz({ subject: 'S', content: 'C', options });
    expect(questions).toHaveLength(5);
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it('fails with a 502 instead of serving placeholder questions', async () => {
    complete.mockResolvedValue('[]');
    await expect(generateQuiz({ subject: 'S', content: 'C', options })).rejects.toMatchObject({ status: 502 });
  });
});

describe('sampleContent', () => {
  it('keeps short text whole and samples long text from start to end', () => {
    expect(sampleContent('short')).toBe('short');
    const long = `START ${'x'.repeat(100000)} END`;
    const sampled = sampleContent(long, 6000);
    expect(sampled.length).toBeLessThan(6100);
    expect(sampled.startsWith('START')).toBe(true);
    expect(sampled.endsWith('END')).toBe(true);
  });
});

describe('summariseAttempts', () => {
  it('orders newest first and summarises', () => {
    const result = summariseAttempts([
      { attemptedAt: '2026-01-01', percentage: 40 },
      { attemptedAt: '2026-01-03', percentage: 80 },
      { attemptedAt: '2026-01-02', percentage: 60 },
    ]);
    expect(result.attempts.map((a) => a.percentage)).toEqual([80, 60, 40]);
    expect(result.stats).toEqual({ count: 3, best: 80, average: 60, latest: 80, change: 20 });
    expect(summariseAttempts([]).stats).toBeNull();
  });
});

describe('parseModelJson', () => {
  it.each([
    ['fenced', '```json\n[1,2]\n```', [1, 2]],
    ['with prose', 'Sure! [1, 2] Hope that helps', [1, 2]],
    ['trailing comma', '{"a": [1, 2,],}', { a: [1, 2] }],
    ['smart quotes', '{“a”: 1}', { a: 1 }],
    ['comments', '{"a": 1 // one\n}', { a: 1 }],
    ['braces in strings', 'x {"a": "}{"} y', { a: '}{' }],
  ])('recovers JSON %s', (_, raw, expected) => expect(parseModelJson(raw)).toEqual(expected));

  it('explains an empty or truncated reply', () => {
    expect(() => parseModelJson('')).toThrow(/Empty/);
    expect(() => parseModelJson('[{"a": 1}, {"b":', { context: 'quiz' })).toThrow(/Could not parse quiz/);
  });
});
