jest.mock('../../ai/conversation', () => ({ chatModel: jest.fn() }));

const { chatModel } = require('../../ai/conversation');
const { makeTitle, fallbackTitle, titleCase, isGood, clean } = require('../../ai/titles');

const modelSays = (content) => chatModel.mockReturnValue({ invoke: jest.fn(async () => ({ content })) });

describe('titles', () => {
  it('cleans model output: prefix, quotes, emoji and trailing punctuation', () => {
    expect(clean('Title: "React useEffect Dependencies." 🚀')).toBe('React useEffect Dependencies');
  });

  it('title-cases words but keeps acronyms and code names as written', () => {
    expect(titleCase('how sql joins work in node.js with useEffect')).toBe('How SQL Joins Work in Node.js with useEffect');
    expect(titleCase('docker volumes vs bind mounts')).toBe('Docker Volumes vs Bind Mounts');
  });

  it('rejects generic, one-word and over-long titles', () => {
    expect(isGood('New Chat')).toBe(false);
    expect(isGood('React')).toBe(false);
    expect(isGood('A Very Long Title That Goes On and On Without Ever Stopping Anywhere')).toBe(false);
    expect(isGood('Docker Volumes vs Bind Mounts')).toBe(true);
  });

  it('falls back to a tidy title from the student’s words, without greetings', () => {
    expect(fallbackTitle('Hi, I have a doubt in React hooks - when does useEffect run?')).toBe('React Hooks - When Does useEffect Run');
    expect(fallbackTitle('', { kind: 'notes', fileName: 'os_unit-3_notes.pdf' })).toBe('OS Unit 3 Notes');
    expect(fallbackTitle('')).toBe('New Chat');
  });

  it('uses the model title when it is good', async () => {
    modelSays('Docker Volumes vs Bind Mounts');
    await expect(makeTitle('doubt', 'what is the difference between docker volumes and bind mounts')).resolves.toBe('Docker Volumes vs Bind Mounts');
  });

  it('falls back when the model returns something generic or fails', async () => {
    modelSays('New Chat');
    await expect(makeTitle('chat', 'Make me a study plan to learn SQL')).resolves.toBe('Make Me a Study Plan to Learn SQL');
    chatModel.mockReturnValue({ invoke: jest.fn(async () => { throw new Error('down'); }) });
    await expect(makeTitle('chat', 'hello')).resolves.toBe('New Chat');
  });
});
