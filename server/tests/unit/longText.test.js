const { CHAT_SOURCE_CHARS, splitEvenly, relevantText, sampleContent } = require('../../utils/longText');
const { videoTutorPrompt } = require('../../ai/prompts');

const longTranscript = Array.from({ length: 300 }, (_, i) => `minute ${i} ${'talking about databases '.repeat(8)}`).join(' ')
  + ' finally the speaker explains kubernetes autoscaling in depth';

describe('long text helpers', () => {
  it('splits text into even parts without losing or breaking words', () => {
    const text = Array.from({ length: 500 }, (_, i) => `word${i}`).join(' ');
    const parts = splitEvenly(text, 4);
    expect(parts).toHaveLength(4);
    expect(parts.join(' ')).toBe(text);
  });

  it('finds the passage a question is about, wherever it is in the text', () => {
    const picked = relevantText(longTranscript, 'how does kubernetes autoscaling work');
    expect(picked.length).toBeLessThanOrEqual(CHAT_SOURCE_CHARS);
    expect(picked).toContain('kubernetes autoscaling');
  });

  it('samples from start to end rather than cutting', () => {
    const sampled = sampleContent(longTranscript, 3000);
    expect(sampled).toContain('minute 0 ');
    expect(sampled).toContain('kubernetes autoscaling');
  });
});

describe('video chat prompt', () => {
  it('gives the model the end of a long transcript when the question is about it', () => {
    const prompt = videoTutorPrompt({ title: 'Cloud course', transcript: longTranscript, summary: '### Overview' }, { question: 'explain the kubernetes autoscaling part' });
    expect(prompt).toContain('kubernetes autoscaling');
    expect(prompt).toContain('### Overview');
  });
});
