import { visibleMarkdown } from '../useTypewriter';

describe('visibleMarkdown (a reply cut mid-way while it is typed)', () => {
  it('holds back markers that have not been closed yet', () => {
    expect(visibleMarkdown('Use **')).toBe('Use ');
    expect(visibleMarkdown('A list:\n\n* ')).toBe('A list:\n\n* ');
  });

  it('closes an open bold run or code span so no raw markers show', () => {
    expect(visibleMarkdown('This is **very imp')).toBe('This is **very imp**');
    expect(visibleMarkdown('Call `useEff')).toBe('Call `useEff`');
    expect(visibleMarkdown('Done **here**. Next **pa')).toBe('Done **here**. Next **pa**');
  });

  it('only looks at the paragraph being written', () => {
    expect(visibleMarkdown('One **bold**\n\nTwo `x` and **mo')).toBe('One **bold**\n\nTwo `x` and **mo**');
  });

  it('leaves an open code block alone: it already renders as code', () => {
    const text = 'Example:\n\n```js\nconst a = **b';
    expect(visibleMarkdown(text)).toBe(text);
  });

  it('keeps an unfinished diagram out until it is complete', () => {
    expect(visibleMarkdown('Here is the flow:\n\n```mermaid\ngraph TD\nA-->')).toBe('Here is the flow:');
    const whole = 'Flow:\n\n```mermaid\ngraph TD\nA-->B\n```\n\nNext';
    expect(visibleMarkdown(whole)).toBe(whole);
  });
});
