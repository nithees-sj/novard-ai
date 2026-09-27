import normalizeModelMarkdown from '../normalizeModelMarkdown';

describe('normalizeModelMarkdown', () => {
  it('turns stray <br> tags into Markdown line breaks', () => {
    expect(normalizeModelMarkdown('one<br>two<br/>three<BR />four')).toBe('one  \ntwo  \nthree  \nfour');
  });

  it('leaves code untouched', () => {
    const input = 'Use <br> here\n```html\n<p>a<br>b</p>\n```\nand `<br>` inline';
    expect(normalizeModelMarkdown(input)).toBe('Use   \n here\n```html\n<p>a<br>b</p>\n```\nand `<br>` inline');
  });

  it('passes through text without tags and non-strings', () => {
    expect(normalizeModelMarkdown('plain')).toBe('plain');
    expect(normalizeModelMarkdown(undefined)).toBeUndefined();
  });
});
