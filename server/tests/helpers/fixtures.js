/** Model output fixtures shared by the API tests. */

const quizJson = (count = 5) => JSON.stringify(Array.from({ length: count }, (_, i) => ({
  question: `Question ${i + 1}?`,
  options: [`Right ${i}`, `Wrong A ${i}`, `Wrong B ${i}`, `Wrong C ${i}`],
  correctAnswer: 0,
  explanation: `Because ${i}.`,
})));

module.exports = { quizJson };
