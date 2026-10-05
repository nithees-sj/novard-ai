import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import AgentSidebar from '../components/agent/AgentSidebar';
import AgentMessage from '../components/agent/AgentMessage';
import LearnerProfilePanel from '../components/agent/LearnerProfilePanel';
import { BotMark } from '../components/ChatbotButton';
import Icon from '../components/ui/Icon';
import AppShell from '../components/layout/AppShell';
import { streamAgentReply, agentApi } from '../lib/agentStream';
import { currentEmail, currentName } from '../lib/session';
import { useReportProblem } from '../context/ReportContext';

const STARTERS = [
  { icon: 'doubt', title: 'Clear a doubt', text: 'Hi, I have a doubt in React hooks - when does useEffect run?' },
  { icon: 'roadmap', title: 'Plan my career', text: 'What should I do to become a DevOps engineer? I already know Linux and Git.' },
  { icon: 'play', title: 'Find a video', text: 'Find me a good video to learn Docker basics' },
  { icon: 'plan', title: 'Build a study plan', text: 'Make me a study plan to learn SQL' },
];

/**
 * The Novard Agent, laid out like ChatGPT / Claude: chat history on the left,
 * the conversation in the middle. Replies stream in. To create something (a
 * doubt, video, roadmap, plan…) the agent asks what it needs - questions with
 * tap-to-answer options - then shows an editable draft; nothing is created
 * until the student presses Create. The agent remembers the whole
 * conversation, and a learner profile across chats.
 */
const Chatbot = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const userId = user?.email || currentEmail();
  const userName = user?.name || user?.displayName || currentName();
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
  const [profileOpen, setProfileOpen] = useState(false);
  const openReport = useReportProblem();

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
      await streamAgentReply({ conversationId, message: text, signal: controller.signal }, {
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
        onAsk: ({ ask }) => updateLast((m) => ({ ...m, ask })),
        // A card arrives when it is offered or drafted.
        onAction: ({ action }) => updateLast((m) => {
          const list = m.actions || [];
          return { ...m, actions: list.some((a) => a.id === action.id) ? list.map((a) => (a.id === action.id ? action : a)) : [...list, action] };
        }),
        // A new draft replaces earlier, unanswered offers and drafts of the same kind.
        onSuperseded: ({ type, except }) => {
          const moot = (a) => a.type === type && (a.status === 'proposed' || a.status === 'draft') && a.id !== except;
          setMessages((list) => list.map((m) => (!m.actions?.some(moot) ? m : { ...m, actions: m.actions.map((a) => (moot(a) ? { ...a, status: 'superseded' } : a)) })));
        },
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

  // Other pages can open the agent with a question ready to go, e.g. the
  // "Start Mock Interview" button: navigate('/chatbot', { state: { prompt } }).
  // Sent on the next tick: React's StrictMode mounts twice in development, and the
  // unmount in between would otherwise abort the reply it had just started.
  const startPrompt = useRef(location.state?.prompt || null);
  useEffect(() => {
    if (!startPrompt.current) return undefined;
    const timer = setTimeout(() => {
      const prompt = startPrompt.current;
      startPrompt.current = null;
      navigate(location.pathname, { replace: true, state: null }); // a refresh must not send it again
      send(prompt);
    }, 0);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── action cards ───────────────────────────────────────────
  const setAction = (actionId, patch) => setMessages((list) => list.map((m) => (!m.actions?.some((a) => a.id === actionId) ? m : {
    ...m,
    actions: m.actions.map((a) => (a.id === actionId ? { ...a, ...patch } : a)),
  })));

  /**
   * create (a draft, with the student's edits) · accept (an offer: the chat
   * continues and the agent gathers the details) · confirm ("remember this?") · dismiss
   */
  const decide = async (action, decision, { args, remember } = {}) => {
    const convId = activeRef.current;
    if (!convId || (decision === 'accept' && streaming)) return;
    const before = { status: action.status, error: action.error };
    const optimistic = { create: 'running', confirm: 'running', accept: 'accepted', dismiss: 'dismissed' }[decision];
    setAction(action.id, { status: optimistic, error: null, ...(args ? { args: { ...action.args, ...args } } : {}) });
    try {
      const { action: updated } = await agentApi.decide(convId, action.id, { decision, ...(args ? { args } : {}), ...(remember ? { remember: true } : {}) });
      if (activeRef.current !== convId) return;
      setAction(action.id, updated);
      if (decision === 'accept') send(updated.meta?.followUp || 'Yes, please set it up.');
    } catch (err) {
      if (activeRef.current !== convId) return;
      if (err.data?.action) setAction(action.id, err.data.action);
      // A rejected edit keeps the draft open, with the reason shown.
      else if (decision === 'create' && err.status === 400) { setAction(action.id, before); setError(err.message); }
      else setAction(action.id, optimistic === 'running' ? { status: 'failed', error: err.message } : before);
    }
  };

  // ── render ─────────────────────────────────────────────────
  const empty = !activeId && messages.length === 0;

  const composer = (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4">
      {error && (
        <div role="alert" className="mb-2 flex items-start justify-between gap-3 rounded-lg bg-danger-soft px-4 py-2.5 text-body text-danger-fg">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0 rounded p-0.5 hover:bg-danger/10" aria-label="Dismiss"><Icon name="x" className="h-4 w-4" /></button>
        </div>
      )}
      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="relative rounded-xl bg-raised shadow-raised ring-1 ring-inset ring-line transition-shadow hover:ring-line-strong focus-within:ring-2 focus-within:ring-focus"
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
          className="block max-h-56 w-full resize-none rounded-xl bg-transparent px-4 pb-14 pt-3.5 text-body leading-relaxed text-fg placeholder:text-fg-subtle outline-none"
        />
        <div className="absolute inset-x-3 bottom-2.5 flex items-center justify-between">
          <span className="hidden pl-1 text-caption text-fg-subtle sm:inline">Enter to send · Shift + Enter for a new line</span>
          <span className="sm:hidden" />
          {streaming ? (
            <button type="button" onClick={stop} className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-on-ink transition-colors hover:bg-ink-hover" aria-label="Stop generating" title="Stop">
              <span className="h-2.5 w-2.5 rounded-sm bg-on-ink" />
            </button>
          ) : (
            <button type="submit" disabled={!draft.trim()} className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-on-accent transition-colors hover:bg-accent-hover disabled:bg-sunken disabled:text-fg-disabled" aria-label="Send message" title="Send">
              <Icon name="arrowUp" className="h-4 w-4" strokeWidth={2.25} />
            </button>
          )}
        </div>
      </form>
      <p className="mt-2 text-center text-caption text-fg-subtle">Nothing is created until you press Create. Novard Agent can make mistakes, so check anything important.</p>
    </div>
  );

  const crumbs = [
    { label: 'Home', to: '/home' },
    activeId ? { label: 'Novard Agent', onClick: newChat } : { label: 'Novard Agent' },
    ...(activeId && title ? [{ label: title }] : []),
  ];

  return (
    <AppShell page="agent" width="full" agent={false} crumbs={crumbs} title={activeId && title ? `${title} · Novard Agent` : 'Novard Agent'}>
    <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-xl bg-raised ring-1 ring-line-subtle">
      {/* chat history: a pane on desktop, a drawer inside the frame on small screens */}
      <div className={`absolute inset-y-0 left-0 z-20 transition-transform duration-200 md:static md:translate-x-0 ${sidebarOpen ? 'translate-x-0 shadow-modal md:shadow-none' : '-translate-x-full'}`}>
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
          onProfile={() => { setSidebarOpen(false); setProfileOpen(true); }}
          embedded
        />
      </div>
      {sidebarOpen && <button type="button" className="absolute inset-0 z-10 bg-black/30 dark:bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close chat list" />}

      <section className="flex min-w-0 flex-1 flex-col" aria-label="Conversation">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line-subtle px-3 sm:px-4">
          <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-fg-muted hover:bg-sunken hover:text-fg md:hidden" aria-label="Open chat list" title="Your chats">
            <Icon name="clock" className="h-5 w-5" />
          </button>
          <Icon name="agent" className="h-5 w-5 shrink-0 text-accent-fg" />
          <h1 className="min-w-0 flex-1 truncate text-body font-medium text-fg">{empty ? 'Novard Agent' : title || 'New chat'}</h1>
          {!empty && (
            <button type="button" onClick={newChat} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-body text-fg-muted transition-colors hover:bg-sunken hover:text-fg" title="New chat (Ctrl+Shift+O)">
              <Icon name="edit" className="h-4 w-4" />
              <span className="hidden sm:inline">New chat</span>
            </button>
          )}
        </header>

        {empty ? (
          <div className="flex flex-1 flex-col overflow-y-auto px-4">
            {/* my-auto centres the welcome when it fits and lets it scroll from the top when it does not. */}
            <div className="my-auto flex w-full flex-col items-center py-8">
            <div className="h-16 w-16 shrink-0"><BotMark /></div>
            <h2 className="mt-5 text-center text-display font-semibold text-fg">
              {firstName ? `Hi ${firstName}, how can I help?` : 'How can I help you today?'}
            </h2>
            <p className="mt-2 max-w-lg text-center text-body text-fg-muted">
              Ask about anything you are learning, or tell me what to make: a doubt, a video, a roadmap or a study plan. I ask a few questions first, then show you a draft to check.
            </p>
            <div className="mt-8 w-full">{composer}</div>
            <ul className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-x-4 px-4 sm:grid-cols-2">
              {STARTERS.map((s) => (
                <li key={s.title}>
                  <button
                    type="button"
                    onClick={() => send(s.text)}
                    className="group flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent-soft/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-fg ring-1 ring-inset ring-accent/15 transition-colors group-hover:bg-accent group-hover:text-on-accent">
                      <Icon name={s.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-body font-medium text-fg">{s.title}</span>
                      <span className="mt-0.5 block text-small text-fg-subtle">{s.text}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
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
                        <div className="ml-auto h-10 w-1/2 animate-pulse rounded-xl bg-sunken" />
                        <div className="h-4 w-full animate-pulse rounded bg-sunken" />
                        <div className="h-4 w-5/6 animate-pulse rounded bg-sunken" />
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
                    busy={streaming}
                    canAnswer={!streaming && i === messages.length - 1 && m.role === 'assistant'}
                    onAnswer={send}
                    onReport={activeId ? (msg) => openReport({ area: 'agent', source: { tool: 'agent', itemType: 'agent_message', itemId: activeId, messageIndex: i, excerpt: msg.content } }) : undefined}
                  />
                ))}
              </div>
            </div>
            {!atBottom && (
              <div className="pointer-events-none relative">
                <button type="button" onClick={() => scrollToBottom()} className="pointer-events-auto absolute -top-12 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-overlay text-fg-muted shadow-popover ring-1 ring-line-subtle hover:text-fg" aria-label="Jump to latest">
                  <Icon name="arrowDown" className="h-4 w-4" />
                </button>
              </div>
            )}
            {composer}
          </>
        )}
      </section>
    </div>
      <LearnerProfilePanel open={profileOpen} onClose={() => setProfileOpen(false)} />
    </AppShell>
  );
};

export default Chatbot;
