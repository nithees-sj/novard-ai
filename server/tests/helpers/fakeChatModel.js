/**
 * A scripted stand-in for the LangChain chat model the Novard Agent uses.
 *
 * Each call to stream()/invoke() consumes the next step of the script:
 *   { text: 'Hello', chunks?: 3 }                   streamed text, split into chunks
 *   { tools: [{ name, args }] }                     tool calls (no text)
 *   { error: Error }                                 the call fails
 *   { waitForAbort: true, text }                     streams text, then waits until aborted
 * Calls made after the script ends reply with "(done)".
 */

class FakeChunk {
  constructor(content = '', toolCalls = []) {
    this.content = content;
    this.tool_calls = toolCalls;
  }

  concat(other) {
    return new FakeChunk(this.content + other.content, [...this.tool_calls, ...other.tool_calls]);
  }
}

function createFakeChatModel(script = []) {
  const calls = [];
  let step = 0;
  const next = () => {
    step += 1;
    return script[step - 1] || { text: '(done)' };
  };

  const toolCalls = (s) => (s.tools || []).map((t, i) => ({ id: `call_${step}_${i}`, name: t.name, args: t.args || {} }));

  const model = {
    calls,
    bindTools(tools, options) {
      return { ...model, boundTools: tools, bindOptions: options };
    },
    async stream(messages, { signal } = {}) {
      calls.push({ kind: 'stream', messages });
      const s = next();
      if (s.error) throw s.error;
      const pieces = [];
      if (s.text) {
        const n = s.chunks || 1;
        const size = Math.ceil(s.text.length / n);
        for (let i = 0; i < s.text.length; i += size) pieces.push(new FakeChunk(s.text.slice(i, i + size)));
      }
      if (s.tools) pieces.push(new FakeChunk('', toolCalls(s)));
      return (async function* generate() {
        for (const piece of pieces) yield piece;
        if (s.waitForAbort) {
          await new Promise((resolve, reject) => {
            if (signal?.aborted) reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
            signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
          });
        }
      }());
    },
    async invoke(messages) {
      calls.push({ kind: 'invoke', messages });
      const s = next();
      if (s.error) throw s.error;
      return new FakeChunk(s.text || '', toolCalls(s));
    },
  };
  return model;
}

module.exports = { createFakeChatModel, FakeChunk };
