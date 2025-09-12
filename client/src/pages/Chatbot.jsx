import React, { useState, useEffect, useRef } from 'react';
import { MdSend } from 'react-icons/md';
import { Navigationinner } from '../components/navigationinner';
import ReactMarkdown from 'react-markdown';
const apiUrl = process.env.REACT_APP_API_ENDPOINT;

console.log(process.env.API_ENDPOINT);

const Chatbot = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { type: 'user', content: input };
    setMessages((prevMessages) => [...prevMessages, userMessage]);

    setInput('');

    try {
      const response = await fetch(`${apiUrl}/api/chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: input }),
      });

      const data = await response.json();
      const aiMessage = {
        type: 'ai',
        content: data.response || 'No response received.',
      };
      setMessages((prevMessages) => [...prevMessages, aiMessage]);
    } catch (error) {
      console.error('Error interacting with chatbot:', error);
      const errorMessage = { type: 'ai', content: 'Error processing your request.' };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
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
    maxWidth: '75%',
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
    textAlign: 'right',
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
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                ) : (
                  message.content
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div style={styles.inputContainer}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              style={styles.inputBox}
            />
            <button
              onClick={handleSend}
              style={styles.sendButton}
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
