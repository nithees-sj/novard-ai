const { scopeRules, videoTutorPrompt } = require('../../ai/prompts');
const { _internal: { systemPrompt } } = require('../../agent/novardAgent');

describe('student chatbots stay educational', () => {
  it('declines out-of-scope questions kindly and steers back to what the chat is for', () => {
    const rules = scopeRules('this doubt');
    expect(rules).toMatch(/who is the CM/);
    expect(rules).toMatch(/only help with educational topics, then offer to help with this doubt/);
    expect(rules).toMatch(/How is a Chief Minister chosen\?.*are learning/); // explaining a subject is still in scope
  });

  it('is part of the Novard Agent and video tutor prompts', () => {
    expect(systemPrompt({ userName: 'Alice', profileText: '(none)' })).toContain('Stay educational:');
    expect(systemPrompt({ userName: 'Alice', profileText: '(none)' })).toMatch(/0\) OUT OF SCOPE/);
    expect(videoTutorPrompt({ title: 'Git basics' })).toContain('Stay educational:');
  });
});
