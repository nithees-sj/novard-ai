import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthContext';
import AgentSidebar from '../components/agent/AgentSidebar';
import AgentMessage from '../components/agent/AgentMessage';
import { BotMark } from '../components/ChatbotButton';
import { streamAgentReply, agentApi } from '../lib/agentStream';

const STARTERS = [
  { icon: '💡', title: 'Clear a doubt', text: 'Hi, I have a doubt in React hooks - when does useEffect run?' },
  { icon: '🗺️', title: 'Plan my career', text: 'What should I do to become a DevOps engineer? I already know Linux and Git.' },
  { icon: '🎬', title: 'Find a video', text: 'Find me a good video to learn Docker basics' },
  { icon: '🗓️', title: 'Build a study plan', text: 'Make me a 14-day plan to learn SQL from scratch' },
];

/**
 * The Novard Agent, laid out like ChatGPT / Claude: chat history on the left,
 * the conversation in the middle. Replies stream in; when the agent offers to
 * create something (a doubt, video, roadmap, plan…) it appears as a card the
 * student confirms or declines. The agent remembers the whole conversation.
 */
const Chatbot = () => {
  const { user } = useAuth();
  const userId = user?.email || localStorage.getItem('email') || 'anonymous';
  const userName = user?.name || user?.displayName || localStorage.getItem('name') || '';
  const firstName = userName.split(' ')[0];

  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [title, setTitle] = useState('');
  const [messages, setMessages] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [atBottom, setAtBottom] = useState(true);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const activeRef = useRef(null);
  activeRef.current = activeId;

  // ── history ────────────────────────────────────────────────
  const loadChats = useCallback(async () => {
    try {
      setChats(await agentApi.list(userId));
    } catch { /* keep the current list */ } finally {
      setChatsLoading(false);
    }
  }, [userId]);
  useEffect(() => { loadChats(); }, [loadChats]);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    setActiveId(null);
    setTitle('');
    setMessages([]);
    setError(null);
    setDraft('');
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const openChat = useCallback(async (id) => {
    if (id === activeRef.current) { setSidebarOpen(false); return; }
    abortRef.current?.abort();
    setActiveId(id);
    setSidebarOpen(false);
    setLoadingChat(true);
    setError(null);
    try {
      const doc = await agentApi.get(id, userId);
      if (activeRef.current !== id) return;
      setTitle(doc.title);
      setMessages(doc.messages || []);
      requestAnimationFrame(() => scrollToBottom('auto'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingChat(false);
    }
  }, [userId]);

  const renameChat = async (id, next) => {
    setChats((list) => list.map((c) => (c._id === id ? { ...c, title: next } : c)));
    if (id === activeId) setTitle(next);
    try { await agentApi.rename(id, userId, next); } catch { loadChats(); }
  };

  const deleteChat = async (id) => {
    setChats((list) => list.filter((c) => c._id !== id));
    if (id === activeId) newChat();
    try { await agentApi.remove(id, userId); } catch { loadChats(); }
  };

  // Ctrl/Cmd + Shift + O starts a new chat, as in ChatGPT.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') { e.preventDefault(); newChat(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [newChat]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // ── scrolling ──────────────────────────────────────────────
  const scrollToBottom = (behavior = 'smooth') => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  };
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };
  // Follow the reply as it streams, unless the student scrolled up to read.
  useEffect(() => { if (atBottom) scrollToBottom('auto'); }, [messages, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── sending ────────────────────────────────────────────────
  const updateLast = (fn) => setMessages((list) => {
    const copy = list.slice();
    copy[copy.length - 1] = fn(copy[copy.length - 1]);
    return copy;
  });

  const send = async (textArg) => {
    const text = (textArg ?? draft).trim();
    if (!text || streaming) return;
    setDraft('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setError(null);
    setStreaming(true);
    setStatus('');
    setAtBottom(true);
    setMessages((list) => [...list, { role: 'user', content: text, createdAt: new Date().toISOString() }, { role: 'assistant', content: '', actions: [], pending: true }]);
    requestAnimationFrame(() => scrollToBottom('smooth'));

    // Tokens arrive faster than React should re-render; flush them once per frame.
    let buffer = '';
    let frame = null;
    const flush = () => {
      frame = null;
      if (!buffer) return;
      const chunk = buffer;
      buffer = '';
      updateLast((m) => ({ ...m, content: m.content + chunk }));
    };

    const controller = new AbortController();
    abortRef.current = controller;
    let conversationId = activeId;
    try {
      await streamAgentReply({ userId, userName, conversationId, message: text, signal: controller.signal }, {
        onMeta: (m) => {
          conversationId = m.conversationId;
          if (!activeRef.current) {
            setActiveId(m.conversationId);
            activeRef.current = m.conversationId;
            setTitle(m.title);
          }
          if (m.isNew) setChats((list) => [{ _id: m.conversationId, title: m.title, updatedAt: new Date().toISOString() }, ...list.filter((c) => c._id !== m.conversationId)]);
        },
        onToken: ({ text: t }) => {
          buffer += t;
          if (!frame) frame = requestAnimationFrame(flush);
        },
        onStatus: ({ text: s }) => setStatus(s),
        onAction: ({ action }) => updateLast((m) => ({ ...m, actions: [...(m.actions || []), action] })),
        onTitle: ({ title: t }) => {
          setChats((list) => list.map((c) => (c._id === conversationId ? { ...c, title: t } : c)));
          if (activeRef.current === conversationId) setTitle(t);
        },
        onDone: ({ message }) => {
          if (frame) cancelAnimationFrame(frame);
          buffer = '';
          if (activeRef.current === conversationId) updateLast(() => message);
        },
        onError: ({ error: e }) => { throw new Error(e); },
      });
    } catch (err) {
      if (frame) cancelAnimationFrame(frame);
      flush();
      if (controller.signal.aborted) {
        updateLast((m) => ({ ...m, pending: false, content: m.content ? `${m.content}\n\n*(stopped)*` : '*(stopped)*' }));
      } else {
        // Remove the empty reply; keep the student's message and show why.
        setMessages((list) => (list[list.length - 1]?.content ? list : list.slice(0, -1)));
        setError(err.message || 'The agent could not reply. Please try again.');
      }
    } finally {
      setStreaming(false);
      setStatus('');
      abortRef.current = null;
      setChats((list) => {
        const hit = list.find((c) => c._id === conversationId);
        return hit ? [{ ...hit, updatedAt: new Date().toISOString() }, ...list.filter((c) => c._id !== conversationId)] : list;
      });
      inputRef.current?.focus();
    }
  };

  const stop = () => abortRef.current?.abort();

  // ── action cards ───────────────────────────────────────────
  const setAction = (actionId, patch) => setMessages((list) => list.map((m) => (!m.actions?.some((a) => a.id === actionId) ? m : {
    ...m,
    actions: m.actions.map((a) => (a.id === actionId ? { ...a, ...patch } : a)),
  })));

  const decide = async (action, decision) => {
    const convId = activeRef.current;
    if (!convId) return;
    const before = action.status;
    setAction(action.id, decision === 'confirm' ? { status: 'running', error: null } : { status: 'dismissed' });
    try {
      const { action: updated } = await agentApi.decide(convId, action.id, { userId, userName, decision });
      if (activeRef.current === convId) setAction(action.id, updated);
    } catch (err) {
      if (activeRef.current !== convId) return;
      if (err.data?.action) setAction(action.id, err.data.action);
      else setAction(action.id, decision === 'confirm' ? { status: 'failed', error: err.message } : { status: before });
    }
  };

  // ── render ─────────────────────────────────────────────────
  const empty = !activeId && messages.length === 0;

  const composer = (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4">
      {error && (
        <div role="alert" className="mb-2 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0 text-red-500 hover:text-red-700" aria-label="Dismiss">✕</button>
        </div>
      )}
      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="relative rounded-3xl border border-gray-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition focus-within:border-gray-300 focus-within:shadow-[0_4px_20px_rgba(37,99,235,0.10)]"
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          autoFocus
          onChange={(e) => {
            setDraft(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 220)}px`;
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
          placeholder={empty ? 'Ask anything, or tell me what you want to learn…' : 'Reply to Novard Agent…'}
          aria-label="Message Novard Agent"
          maxLength={6000}
          className="block max-h-56 w-full resize-none rounded-3xl bg-transparent px-5 pt-4 pb-14 text-[15px] leading-relaxed text-gray-900 placeholder-gray-400 outline-none"
        />
        <div className="absolute inset-x-3 bottom-2.5 flex items-center justify-between">
          <span className="hidden pl-2 text-[11px] text-gray-400 sm:inline">Enter to send · Shift + Enter for a new line</span>
          <span className="sm:hidden" />
          {streaming ? (
            <button type="button" onClick={stop} className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-white transition hover:bg-gray-700" aria-label="Stop generating" title="Stop">
              <span className="h-3 w-3 rounded-sm bg-white" />
            </button>
          ) : (
            <button type="submit" disabled={!draft.trim()} className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400" aria-label="Send message" title="Send">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 12h14M13 6l6 6-6 6" transform="rotate(-90 12 12)" /></svg>
            </button>
          )}
        </div>
      </form>
      <p className="mt-2 text-center text-[11px] text-gray-400">Novard Agent asks before creating anything, and can make mistakes - check important information.</p>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* chat history: fixed on desktop, a drawer on small screens */}
      <div className={`fixed inset-y-0 left-0 z-40 transition-transform duration-200 md:static md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <AgentSidebar
          chats={chats}
          loading={chatsLoading}
          activeId={activeId}
          onNew={newChat}
          onOpen={openChat}
          onRename={renameChat}
          onDelete={deleteChat}
          user={user}
          onClose={() => setSidebarOpen(false)}
        />
      </div>
      {sidebarOpen && <button type="button" className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close chat list" />}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-gray-100 px-4">
          <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 md:hidden" aria-label="Open chat list">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">{empty ? 'Novard Agent' : title || 'New chat'}</h1>
          {!empty && (
            <button type="button" onClick={newChat} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100" title="New chat (Ctrl+Shift+O)">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              <span className="hidden sm:inline">New chat</span>
            </button>
          )}
        </header>

        {empty ? (
          <div className="flex flex-1 flex-col overflow-y-auto px-4">
            {/* my-auto centres the welcome when it fits and lets it scroll from the top when it does not. */}
            <div className="my-auto flex w-full flex-col items-center py-8">
            <div className="h-20 w-20 shrink-0"><BotMark /></div>
            <h2 className="mt-5 text-center text-3xl font-semibold tracking-tight text-gray-900">
              {firstName ? `Hi ${firstName}, how can I help?` : 'How can I help you today?'}
            </h2>
            <p className="mt-2 max-w-lg text-center text-sm text-gray-500">
              Ask me anything about what you're learning. I can also save doubts, add videos, build roadmaps and study plans in the app for you - I'll always ask first.
            </p>
            <div className="mt-8 w-full">{composer}</div>
            <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-3 px-4 sm:grid-cols-2">
              {STARTERS.map((s) => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => send(s.text)}
                  className="group rounded-2xl border border-gray-200 bg-white p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-sm"
                >
                  <span className="text-lg" aria-hidden="true">{s.icon}</span>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{s.title}</p>
                  <p className="mt-0.5 text-sm text-gray-500 group-hover:text-gray-600">{s.text}</p>
                </button>
              ))}
            </div>
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} onScroll={onScroll} className="relative flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
                {loadingChat ? (
                  <div className="space-y-6" aria-label="Loading chat">
                    {[0, 1].map((i) => (
                      <div key={i} className="space-y-3">
                        <div className="ml-auto h-10 w-1/2 animate-pulse rounded-3xl bg-gray-100" />
                        <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
                        <div className="h-4 w-5/6 animate-pulse rounded bg-gray-100" />
                      </div>
                    ))}
                  </div>
                ) : messages.map((m, i) => (
                  <AgentMessage
                    key={`${m.createdAt || 'pending'}-${i}`}
                    message={m}
                    streaming={streaming && i === messages.length - 1 && m.role === 'assistant'}
                    status={status}
                    onDecide={decide}
                  />
                ))}
              </div>
            </div>
            {!atBottom && (
              <div className="pointer-events-none relative">
                <button type="button" onClick={() => scrollToBottom()} className="pointer-events-auto absolute -top-12 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-md hover:bg-gray-50" aria-label="Jump to latest">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                </button>
              </div>
            )}
            {composer}
          </>
        )}
      </main>
    </div>
  );
};

export default Chatbot;
