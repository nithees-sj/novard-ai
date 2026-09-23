import React, { useState, useEffect, useRef } from 'react';
import { MdSend } from 'react-icons/md';
import { Navigationinner } from '../components/navigationinner';
import MarkdownView from '../components/MarkdownView';
const apiUrl = process.env.REACT_APP_API_ENDPOINT;

const Chatbot = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt || isSending) return;

    setMessages((prevMessages) => [...prevMessages, { type: 'user', content: prompt }]);
    setInput('');
    setIsSending(true);

    try {
      const response = await fetch(`${apiUrl}/api/chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }

      setMessages((prevMessages) => [
        ...prevMessages,
        { type: 'ai', content: data.response || 'No response received.' },
      ]);
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
        <Navigationinner title="CHATBOT" />
      </div>

      <div style={styles.chatbotContainer}>
        <div style={styles.chatbox}>
          <div style={styles.messages}>
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
