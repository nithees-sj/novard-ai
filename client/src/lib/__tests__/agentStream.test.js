import { ReadableStream } from 'stream/web';
import { streamAgentReply } from '../agentStream';

/** A fetch Response whose body streams the given chunks. */
const streamingResponse = (chunks) => ({
  ok: true,
  status: 200,
  body: new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(new TextEncoder().encode(c)));
      controller.close();
    },
  }),
});

describe('streamAgentReply', () => {
  it('parses server-sent events, even when split across network chunks', async () => {
    global.fetch = jest.fn(async () => streamingResponse([
      'event: meta\ndata: {"conversationId":"c1","isNew":true}\n\nevent: tok',
      'en\ndata: {"text":"Hel"}\n\nevent: token\ndata: {"text":"lo"}\n\n',
      'event: done\ndata: {"message":{"role":"assistant","content":"Hello"}}\n\n',
    ]));
    const handlers = { onMeta: jest.fn(), onToken: jest.fn(), onDone: jest.fn() };

    await streamAgentReply({ message: 'Hi' }, handlers);

    expect(handlers.onMeta).toHaveBeenCalledWith({ conversationId: 'c1', isNew: true });
    expect(handlers.onToken.mock.calls.map(([t]) => t.text).join('')).toBe('Hello');
    expect(handlers.onDone).toHaveBeenCalledWith({ message: { role: 'assistant', content: 'Hello' } });
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ message: 'Hi' });
  });

  it('throws the API error when the request is refused', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 400, body: null, json: async () => ({ error: 'Please type a message.' }) }));
    await expect(streamAgentReply({ message: '' })).rejects.toThrow('Please type a message.');
  });
});
