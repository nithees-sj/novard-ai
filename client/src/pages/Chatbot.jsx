import React, { useState, useEffect, useRef } from 'react';
import { MdSend } from 'react-icons/md';
import { Navigationinner } from '../components/navigationinner';
import MarkdownView from '../components/MarkdownView';
const apiUrl = process.env.REACT_APP_API_ENDPOINT;

const STARTERS = [
  'How do I prepare for a junior developer interview?',
  'Explain REST vs GraphQL with an example',
  'Help me plan 10 hours a week of study',
];

const Chatbot = () => {
  const userId = localStorage.getItem('email') || 'anonymous';
  // The open conversation survives reloads; the server keeps its full history as LangChain memory.
  const storageKey = `novard:chatbot:${userId}`;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState(() => {
    try { return localStorage.getItem(storageKey); } catch { return null; }
  });
  const [title, setTitle] = useState('New chat');
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef(null);

  const remember = (id) => {
    setConversationId(id);
    try { id ? localStorage.setItem(storageKey, id) : localStorage.removeItem(storageKey); } catch { /* storage unavailable */ }
  };

  const openConversation = async (id) => {
    try {
      const res = await fetch(`${apiUrl}/api/chatbot/conversations/${id}?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) throw new Error('not found');
      const data = await res.json();
      setMessages(data.messages.map((m) => ({ type: m.role === 'user' ? 'user' : 'ai', content: m.content })));
      setTitle(data.title || 'Chat');
      remember(id);
    } catch {
      remember(null);
      setMessages([]);
      setTitle('New chat');
    }
    setShowHistory(false);
  };

  const loadHistory = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/chatbot/conversations/user/${encodeURIComponent(userId)}`);
      setHistory(res.ok ? await res.json() : []);
    } catch {
      setHistory([]);
    }
  };

  const newChat = () => {
    remember(null);
    setMessages([]);
    setTitle('New chat');
    setShowHistory(false);
  };

  const deleteConversation = async (id) => {
    await fetch(`${apiUrl}/api/chatbot/conversations/${id}?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' }).catch(() => {});
    if (id === conversationId) newChat();
    loadHistory();
  };

  // Reopen the last conversation on load.
  useEffect(() => {
    if (conversationId) openConversation(conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const handleSend = async (preset) => {
    const prompt = (typeof preset === 'string' ? preset : input).trim();
    if (!prompt || isSending) return;

    setMessages((prevMessages) => [...prevMessages, { type: 'user', content: prompt }]);
    setInput('');
    setIsSending(true);

    try {
      const response = await fetch(`${apiUrl}/api/chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, userId, conversationId }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }

      setMessages((prevMessages) => [
        ...prevMessages,
        { type: 'ai', content: data.response || 'No response received.' },
      ]);
      if (data.conversationId && data.conversationId !== conversationId) remember(data.conversationId);
      if (data.title) setTitle(data.title);
    } catch (error) {
      console.error('Error interacting with chatbot:', error);
      setMessages((prevMessages) => [
        ...prevMessages,
        { type: 'ai', content: `Sorry — ${error.message}. Please try again.` },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

const styles = {
  pageContainer: {
    minHeight: '100vh',
    backgroundColor: '#fff', // White background
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  navbar: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    zIndex: 1000,
  },
  chatbotContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    paddingTop: '80px',
  },
  chatbox: {
    width: '100%',
    maxWidth: '900px',
    height: '76vh',
    backgroundColor: '#fff',
    borderRadius: '18px',
    boxShadow: '0 8px 36px rgba(0,0,0,0.12)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
  },
  message: {
    padding: '14px 24px',
    borderRadius: '16px',
    marginBottom: '18px',
    maxWidth: '85%',
    minWidth: 0,
    display: 'inline-block',
    wordBreak: 'break-word',
    fontSize: '1.1rem',
    alignSelf: 'flex-start',
    background: '#f4f4f4',
    color: '#1a1a1a',
  },
  userMessage: {
    backgroundColor: '#111827',
    color: '#fff',
    textAlign: 'left',
    whiteSpace: 'pre-wrap',
    alignSelf: 'flex-end',
  },
  aiMessage: {
    backgroundColor: '#f3f4f6',
    color: '#232323',
    textAlign: 'left',
  },
  inputContainer: {
    borderTop: '1.5px solid #e5e7eb',
    padding: '15px',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  inputBox: {
    flex: 1,
    padding: '14px 22px',
    borderRadius: '32px',
    border: '1.5px solid #d1d5db',
    fontSize: '1.15rem',
    outline: 'none',
    background: '#f8fafb',
  },
  sendButton: {
    marginLeft: '12px',
    backgroundColor: '#111827',
    color: '#fff',
    padding: '13px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.3s, box-shadow 0.3s',
    fontSize: '1.25rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.10)'
  },
  sendButtonHover: {
    backgroundColor: '#23272b',
    boxShadow: '0 6px 22px rgba(0,0,0,0.14)'
  },
};


  return (
    <div style={styles.pageContainer}>
      <div style={styles.navbar}>
        <Navigationinner title="CHATBOT" hasSidebar={false} />
      </div>

      <div style={styles.chatbotContainer}>
        <div style={styles.chatbox}>
          <div className="relative flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-3">
            <span className="min-w-0 truncate text-sm font-semibold text-gray-800" title={title}>{title}</span>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => { if (!showHistory) loadHistory(); setShowHistory((v) => !v); }}
                aria-expanded={showHistory}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                History ▾
              </button>
              <button type="button" onClick={newChat} className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-gray-800">
                + New chat
              </button>
            </div>
            {showHistory && (
              <div className="absolute right-4 top-full z-20 mt-2 max-h-80 w-80 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                {history.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-gray-500">No saved chats yet.</p>
                ) : history.map((h) => (
                  <div key={h._id} className={`group flex items-center gap-2 rounded-lg px-3 py-2 ${h._id === conversationId ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                    <button type="button" onClick={() => openConversation(h._id)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-medium text-gray-900">{h.title}</span>
                      <span className="block text-xs text-gray-500">{h.messageCount} messages · {new Date(h.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                    </button>
                    <button type="button" onClick={() => deleteConversation(h._id)} aria-label={`Delete ${h.title}`} className="text-gray-400 hover:text-red-600">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={styles.messages}>
            {messages.length === 0 && !isSending && (
              <div className="m-auto max-w-md text-center">
                <p className="text-lg font-semibold text-gray-900">Ask me anything about learning and careers</p>
                <p className="mt-1 text-sm text-gray-500">I remember this conversation, so you can ask follow-ups about anything above.</p>
                <div className="mt-4 flex flex-col gap-2">
                  {STARTERS.map((q) => (
                    <button key={q} type="button" onClick={() => handleSend(q)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message, index) => (
              <div
                key={index}
                style={{
                  ...styles.message,
                  ...(message.type === 'user' ? styles.userMessage : styles.aiMessage),
                }}
              >
                {message.type === 'ai' ? (
                  <MarkdownView content={message.content} size="base" />
                ) : (
                  message.content
                )}
              </div>
            ))}
            {isSending && (
              <div style={{ ...styles.message, ...styles.aiMessage }}>
                <span className="inline-flex items-center gap-2 text-gray-500">
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
                  Thinking&hellip;
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={styles.inputContainer}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending}
              placeholder={isSending ? 'Waiting for a reply\u2026' : 'Type your message...'}
              style={{ ...styles.inputBox, opacity: isSending ? 0.6 : 1 }}
            />
            <button
              onClick={handleSend}
              disabled={isSending || !input.trim()}
              aria-label="Send message"
              style={{
                ...styles.sendButton,
                opacity: isSending || !input.trim() ? 0.5 : 1,
                cursor: isSending || !input.trim() ? 'not-allowed' : 'pointer',
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = styles.sendButtonHover.backgroundColor)}
              onMouseOut={(e) => (e.target.style.backgroundColor = styles.sendButton.backgroundColor)}
            >
              <MdSend size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
