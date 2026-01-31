import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;

// Component to render structured AI responses
const StructuredMessageRenderer = ({ content, role }) => {
  if (role === 'user') {
    return <div>{content}</div>;
  }

  // Helper function to render inline markdown (bold text)
  const renderInlineMarkdown = (text) => {
    const parts = [];
    let lastIndex = 0;
    const boldRegex = /\*\*(.+?)\*\*/g;
    let match;

    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before the bold part
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      // Add the bold part
      parts.push(<strong key={match.index} className="font-semibold">{match[1]}</strong>);
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  // Parse structured content
  const parseStructuredContent = (text) => {
    const elements = [];
    const lines = text.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Header detection (### or full line **)
      if (line.match(/^###\s+(.+)/) || line.match(/^\*\*(.+)\*\*$/)) {
        const headerText = line.replace(/^###\s+/, '').replace(/^\*\*|\*\*$/g, '').replace(/[:]/g, '').trim();
        elements.push({ type: 'header', content: headerText });
        i++;
      }
      // Code block detection
      else if (line.startsWith('```')) {
        const codeLines = [];
        const lang = line.replace('```', '').trim() || 'text';
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        elements.push({ type: 'code', content: codeLines.join('\n'), language: lang });
        i++;
      }
      // Bullet list detection
      else if (line.match(/^[-•*]\s+(.+)/)) {
        const listItems = [];
        while (i < lines.length && lines[i].match(/^[-•*]\s+(.+)/)) {
          listItems.push(lines[i].replace(/^[-•*]\s+/, ''));
          i++;
        }
        elements.push({ type: 'bullet_list', items: listItems });
      }
      // Numbered list detection
      else if (line.match(/^\d+\.\s+(.+)/)) {
        const listItems = [];
        while (i < lines.length && lines[i].match(/^\d+\.\s+(.+)/)) {
          listItems.push(lines[i].replace(/^\d+\.\s+/, ''));
          i++;
        }
        elements.push({ type: 'numbered_list', items: listItems });
      }
      // Info/Note box detection
      else if (line.match(/^(ℹ️|💡|⚠️|✅|❌)\s+(.+)/)) {
        const match = line.match(/^(ℹ️|💡|⚠️|✅|❌)\s+(.+)/);
        const icon = match[1];
        const noteContent = match[2];
        elements.push({ type: 'note', icon, content: noteContent });
        i++;
      }
      // Regular paragraph
      else if (line.trim().length > 0) {
        elements.push({ type: 'paragraph', content: line });
        i++;
      }
      else {
        i++;
      }
    }

    return elements;
  };

  const elements = parseStructuredContent(content);

  return (
    <div className="space-y-3">
      {elements.map((element, idx) => {
        switch (element.type) {
          case 'header':
            return (
              <div key={idx} className="flex items-center gap-2 mt-4 mb-2 pb-2 border-b border-gray-200">
                <div className="w-1 h-5 bg-blue-600 rounded"></div>
                <h4 className="text-sm font-bold text-gray-900">{element.content}</h4>
              </div>
            );

          case 'code':
            return (
              <div key={idx} className="my-3">
                <div className="flex items-center justify-between bg-gray-800 px-3 py-1.5 rounded-t-md">
                  <span className="text-xs text-gray-300 font-mono">{element.language}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(element.content)}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    📋 Copy
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-3 rounded-b-md overflow-x-auto text-xs font-mono">
                  <code>{element.content}</code>
                </pre>
              </div>
            );

          case 'bullet_list':
            return (
              <ul key={idx} className="space-y-1.5 ml-2">
                {element.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-blue-600 mt-1.5 flex-shrink-0">•</span>
                    <span className="flex-1">{renderInlineMarkdown(item)}</span>
                  </li>
                ))}
              </ul>
            );

          case 'numbered_list':
            return (
              <ol key={idx} className="space-y-1.5 ml-2">
                {element.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-blue-600 font-semibold mt-0.5 flex-shrink-0">{itemIdx + 1}.</span>
                    <span className="flex-1">{renderInlineMarkdown(item)}</span>
                  </li>
                ))}
              </ol>
            );

          case 'note':
            const noteColors = {
              'ℹ️': 'bg-blue-50 border-blue-200 text-blue-800',
              '💡': 'bg-yellow-50 border-yellow-200 text-yellow-800',
              '⚠️': 'bg-orange-50 border-orange-200 text-orange-800',
              '✅': 'bg-green-50 border-green-200 text-green-800',
              '❌': 'bg-red-50 border-red-200 text-red-800'
            };
            return (
              <div key={idx} className={`flex items-start gap-2 p-3 rounded-md border ${noteColors[element.icon] || 'bg-gray-50 border-gray-200 text-gray-800'}`}>
                <span className="text-lg flex-shrink-0">{element.icon}</span>
                <p className="text-sm flex-1">{renderInlineMarkdown(element.content)}</p>
              </div>
            );

          case 'paragraph':
            return (
              <p key={idx} className="text-sm text-gray-700 leading-relaxed">
                {renderInlineMarkdown(element.content)}
              </p>
            );

          default:
            return null;
        }
      })}
    </div>
  );
};

const NotesInlineView = () => {
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [activeTab, setActiveTab] = useState('read');
  const [summary, setSummary] = useState('');
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [currentQuizId, setCurrentQuizId] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizScore, setQuizScore] = useState(null);
  const [toast, setToast] = useState(null);
  const [showQuizConfirm, setShowQuizConfirm] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('notes');
  const fileInputRef = useRef(null);

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    loadUserNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedNote) {
      loadNoteData(selectedNote);
    }
  }, [selectedNote]);

  const loadUserNotes = async () => {
    try {
      const userId = localStorage.getItem('email') || 'temp-user-id';
      const response = await axios.get(`${apiUrl}/notes/${userId}`);
      const notesData = Array.isArray(response.data) ? response.data : [];
      setNotes(notesData);
      if (notesData.length > 0 && !selectedNote) {
        setSelectedNote(notesData[0]);
        setActiveTab('read');
        setTimeout(() => loadNoteData(notesData[0]), 0);
      }
    } catch (error) {
      console.error('Error loading notes:', error);
      setNotes([]);
    }
  };

  const loadNoteData = (note) => {
    if (!note) return;
    setSummary(note.summary || '');
    const chatHistory = Array.isArray(note.chatHistory) ? note.chatHistory : [];
    const cleanedChatHistory = chatHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    setChatMessages(cleanedChatHistory);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      showToast('Please select a PDF file', 'error');
      return;
    }
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast('File size must be less than 2MB', 'error');
      return;
    }
    const existingNote = notes.find(note => note.title === file.name);
    if (existingNote) {
      showToast(`A note with the name "${file.name}" already exists.`, 'error');
      return;
    }
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('title', file.name);
    formData.append('userId', localStorage.getItem('email') || 'temp-user-id');
    try {
      setIsLoading(true);
      const response = await axios.post(`${apiUrl}/upload-notes`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await loadUserNotes();
      setSelectedNote(response.data);
      setActiveTab('read');
      showToast('PDF uploaded successfully!', 'success');
    } catch (error) {
      console.error('Error uploading notes:', error);
      showToast('Error uploading notes. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedNote) return;
    
    const messageText = newMessage.trim(); // Preserve the message text
    console.log('Sending message:', messageText);
    console.log('Selected note ID:', selectedNote._id);
    
    const userMessage = { role: 'user', content: messageText };
    const updatedMessages = [...chatMessages, userMessage];
    
    // Update UI immediately
    setChatMessages(updatedMessages);
    setNewMessage('');
    setIsLoading(true);
    
    try {
      const response = await axios.post(`${apiUrl}/chat-with-notes`, {
        noteId: selectedNote._id,
        message: messageText, // Use preserved text
        chatHistory: chatMessages
      });
      
      console.log('API Response:', response.data);
      
      if (response.data && response.data.response) {
        const botMessage = { role: 'assistant', content: response.data.response };
        const finalMessages = [...updatedMessages, botMessage];
        setChatMessages(finalMessages);
        await loadUserNotes();
      } else {
        console.error('Invalid API response format:', response.data);
        showToast('Received invalid response from server');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      console.error('Error details:', error.response?.data || error.message);
      showToast('Error sending message. Please try again.');
      // Revert the user message if there was an error
      setChatMessages(chatMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!selectedNote) return;
    if (selectedNote.summary && selectedNote.summary.trim()) {
      setSummary(selectedNote.summary);
      setActiveTab('summarizer');
      return;
    }
    try {
      setIsSummarizing(true);
      setActiveTab('summarizer');
      const response = await axios.post(`${apiUrl}/summarize-notes`, {
        noteId: selectedNote._id
      });
      setSummary(response.data.summary);
      await loadUserNotes();
    } catch (error) {
      console.error('Error generating summary:', error);
      showToast('Error generating summary. Please try again.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!selectedNote) return;
    setShowQuizConfirm(true);
  };

  const confirmGenerateQuiz = async () => {
    if (!selectedNote) return;
    try {
      setIsGeneratingQuiz(true);
      setActiveTab('quiz');
      setShowQuizConfirm(false);
      const response = await axios.post(`${apiUrl}/generate-quiz`, {
        noteId: selectedNote._id
      });
      setCurrentQuiz(response.data.quiz);
      setCurrentQuizId(response.data.quizId);
      setQuizAnswers({});
      setQuizScore(null);
      await loadUserNotes();
      showToast('Quiz generated successfully!', 'success');
    } catch (error) {
      console.error('Error generating quiz:', error);
      showToast('Error generating quiz. Please try again.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleQuizAnswer = (questionIndex, answer) => {
    setQuizAnswers(prev => ({ ...prev, [questionIndex]: answer }));
  };

  const handleSubmitQuiz = async () => {
    if (!currentQuiz || !currentQuizId) return;
    let correctAnswers = 0;
    currentQuiz.forEach((question, index) => {
      if (quizAnswers[index] === question.correctAnswer) {
        correctAnswers++;
      }
    });
    const score = Math.round((correctAnswers / currentQuiz.length) * 100);
    const scoreData = {
      correct: correctAnswers,
      total: currentQuiz.length,
      percentage: score
    };
    setQuizScore(scoreData);
    try {
      await axios.post(`${apiUrl}/save-quiz-results`, {
        noteId: selectedNote._id,
        quizId: currentQuizId,
        userAnswers: quizAnswers,
        score: scoreData
      });
      await loadUserNotes();
    } catch (error) {
      console.error('Error saving quiz results:', error);
    }
  };

  const handleNoteSelect = (note) => {
    setActiveTab('read');
    setQuizScore(null);
    setQuizAnswers({});
    setCurrentQuiz(null);
    setSelectedNote(note);
    setTimeout(() => loadNoteData(note), 0);
  };

  const handleDeleteNote = async (noteId, noteTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${noteTitle}"?`)) {
      return;
    }
    try {
      await axios.delete(`${apiUrl}/notes/${noteId}`);
      showToast('Note deleted successfully!', 'success');
      await loadUserNotes();
      if (selectedNote && (selectedNote._id === noteId || selectedNote.id === noteId)) {
        setSelectedNote(null);
        setActiveTab('read');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      showToast('Error deleting note. Please try again.');
    }
  };

  const selectQuiz = (quiz) => {
    setCurrentQuiz(quiz.questions);
    setCurrentQuizId(quiz.quizId);
    setQuizAnswers(quiz.userAnswers || {});
    setQuizScore(quiz.score || null);
  };

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1">
        {selectedNote ? (
          <>
            {/* Header with Note Title and Tabs */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 truncate">{selectedNote.title}</h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('read')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    activeTab === 'read'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Read
                </button>
                <button
                  onClick={handleSummarize}
                  disabled={isLoading}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    activeTab === 'summarizer'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Summarize
                </button>
                <button
                  onClick={handleGenerateQuiz}
                  disabled={isLoading}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    activeTab === 'quiz'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Quiz
                </button>
              </div>
            </div>

            {/* Read/Chat Tab */}
            {activeTab === 'read' && (
              <div className="bg-white rounded-lg border border-gray-200 h-[calc(100vh-340px)] flex flex-col">
                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                  {Array.isArray(chatMessages) && chatMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] px-4 py-3 rounded-lg text-sm ${
                          message.role === 'user'
                            ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-900 border border-gray-200 shadow-sm'
                        }`}
                      >
                        {message.role === 'user' ? (
                          <div className="whitespace-pre-wrap break-words">
                            {message.content}
                          </div>
                        ) : (
                          <StructuredMessageRenderer content={message.content} role={message.role} />
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 px-4 py-3 rounded-lg text-sm text-gray-600 border border-gray-200">
                        Thinking...
                      </div>
                    </div>
                  )}
                  {chatMessages.length === 0 && !isLoading && (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="text-4xl mb-4">💬</div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Start a Conversation</h3>
                        <p className="text-sm text-gray-600">Ask questions about your notes and get instant answers.</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-gray-200">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Ask a question about your notes..."
                      className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isLoading || !newMessage.trim()}
                      className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Summary Tab - Structured Display */}
            {activeTab === 'summarizer' && (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 h-[calc(100vh-340px)] overflow-y-auto">
                {isSummarizing ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-4xl mb-4">📝</div>
                      <p className="text-sm text-gray-600">Generating summary...</p>
                    </div>
                  </div>
                ) : summary ? (
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Summary Overview</h3>
                        <p className="text-xs text-gray-500">{selectedNote.title}</p>
                      </div>
                    </div>

                    {/* Parse and display summary in structured format */}
                    {(() => {
                      // Split summary into sentences
                      const sentences = summary.split(/\.(?=\s|$)/).filter(s => s.trim().length > 0);
                      
                      // Try to identify different sections by looking for patterns
                      const sections = [];
                      let currentSection = { title: 'Overview', content: [] };
                      
                      sentences.forEach((sentence, idx) => {
                        const trimmed = sentence.trim();
                        
                        // Check if this looks like a section header (contains ** or starts with capital words)
                        const headerMatch = trimmed.match(/\*\*([^*]+)\*\*/);
                        if (headerMatch) {
                          // Save previous section if it has content
                          if (currentSection.content.length > 0) {
                            sections.push(currentSection);
                          }
                          // Start new section
                          currentSection = {
                            title: headerMatch[1].replace(/[:]/g, '').trim(),
                            content: [trimmed.replace(/\*\*[^*]+\*\*/, '').trim()]
                          };
                        } else {
                          currentSection.content.push(trimmed);
                        }
                      });
                      
                      // Add the last section
                      if (currentSection.content.length > 0) {
                        sections.push(currentSection);
                      }
                      
                      // If no sections were identified, create a default structure
                      if (sections.length === 0) {
                        sections.push({
                          title: 'Summary',
                          content: sentences
                        });
                      }
                      
                      return (
                        <>
                          {sections.map((section, idx) => (
                            <div key={idx} className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 mt-1">
                                  {idx === 0 ? (
                                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                                      <span className="text-lg">📄</span>
                                    </div>
                                  ) : (
                                    <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                                      <span className="text-lg">📚</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <h4 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    {section.title}
                                    {idx === 0 && (
                                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                        Main
                                      </span>
                                    )}
                                  </h4>
                                  <div className="space-y-2">
                                    {section.content.map((item, itemIdx) => {
                                      const cleanItem = item.trim();
                                      if (!cleanItem || cleanItem.length < 3) return null;
                                      
                                      return (
                                        <div key={itemIdx} className="flex items-start gap-2">
                                          <div className="flex-shrink-0 mt-1.5">
                                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                                          </div>
                                          <p className="text-sm text-gray-700 leading-relaxed">
                                            {cleanItem}{cleanItem.endsWith('.') ? '' : '.'}
                                          </p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {/* Summary Stats Footer */}
                          <div className="mt-6 pt-4 border-t border-gray-200">
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  {sections.length} {sections.length === 1 ? 'section' : 'sections'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                  </svg>
                                  {sentences.length} key points
                                </span>
                              </div>
                              <span className="text-green-600 font-medium">✓ Summarized</span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-4xl mb-4">📝</div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Summary Yet</h3>
                      <p className="text-sm text-gray-600">Click "Summarize" to generate a summary of this note.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quiz Tab */}
            {activeTab === 'quiz' && (
              <div className="bg-white rounded-lg border border-gray-200 p-6 h-[calc(100vh-340px)] overflow-y-auto">
                {isGeneratingQuiz ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-4xl mb-4">🧠</div>
                      <p className="text-sm text-gray-600">Generating quiz...</p>
                    </div>
                  </div>
                ) : currentQuiz ? (
                  <>
                    {quizScore ? (
                      <div className="text-center p-8 bg-blue-50 rounded-lg">
                        <div className="text-5xl mb-4">🎯</div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Quiz Complete!</h3>
                        <p className="text-4xl font-bold text-blue-600 mb-4">{quizScore.percentage}%</p>
                        <p className="text-sm text-gray-600 mb-6">
                          You got {quizScore.correct} out of {quizScore.total} questions correct
                        </p>
                        <button
                          onClick={() => {
                            setQuizScore(null);
                            setQuizAnswers({});
                            setCurrentQuiz(null);
                          }}
                          className="px-6 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800"
                        >
                          Try Another Quiz
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {currentQuiz.map((question, qIndex) => (
                          <div key={qIndex} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="font-semibold text-sm text-gray-900 mb-3">
                              {qIndex + 1}. {question.question}
                            </p>
                            <div className="space-y-2">
                              {question.options.map((option, oIndex) => (
                                <button
                                  key={oIndex}
                                  onClick={() => handleQuizAnswer(qIndex, oIndex)}
                                  className={`w-full text-left px-3 py-2 text-sm rounded-md border transition-colors ${
                                    quizAnswers[qIndex] === oIndex
                                      ? 'bg-blue-600 text-white border-blue-600'
                                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                                  }`}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={handleSubmitQuiz}
                          className="w-full px-6 py-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                        >
                          Submit Quiz
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-4xl mb-4">🧠</div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Quiz Yet</h3>
                      <p className="text-sm text-gray-600">Click "Quiz" to generate questions.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-[calc(100vh-260px)] bg-white rounded-lg border border-gray-200">
            <div className="text-center">
              <div className="text-6xl mb-4">📚</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Notes & Quiz</h2>
              <p className="text-sm text-gray-600">Upload a PDF to start reading, get summaries, or create quizzes.</p>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      <div className="w-80 bg-white rounded-lg border border-gray-200 p-4 h-[calc(100vh-260px)] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-medium text-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New Note
          </button>
        </div>

        {/* Sidebar Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSidebarTab('notes')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              sidebarTab === 'notes'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Notes
          </button>
          <button
            onClick={() => setSidebarTab('quizzes')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              sidebarTab === 'quizzes'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Quizzes
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          accept=".pdf"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Notes List */}
        {sidebarTab === 'notes' && (
          Array.isArray(notes) && notes.length > 0 ? (
            <div className="space-y-2">
              {notes.map((note) => (
                <div
                  key={note._id || note.id}
                  onClick={() => handleNoteSelect(note)}
                  className={`relative p-3 rounded-lg cursor-pointer transition-all border ${
                    selectedNote?._id === note._id || selectedNote?.id === note.id
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-gray-50 text-gray-900 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNote(note._id || note.id, note.title);
                    }}
                    className="absolute top-2 right-2 p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <div className="font-semibold text-sm mb-1 pr-8 truncate">{note.title}</div>
                  <div className="text-xs opacity-75 mb-2">
                    {new Date(note.uploadedAt).toLocaleDateString()}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {note.summary && (
                      <div className={`text-xs px-2 py-1 rounded inline-block ${
                        selectedNote?._id === note._id ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800'
                      }`}>
                        Summary
                      </div>
                    )}
                    {note.quizzes && note.quizzes.length > 0 && (
                      <div className={`text-xs px-2 py-1 rounded inline-block ${
                        selectedNote?._id === note._id ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {note.quizzes.length} Quiz{note.quizzes.length > 1 ? 'zes' : ''}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">📄</div>
              <p className="text-sm font-semibold text-gray-900 mb-1">No notes yet</p>
              <p className="text-xs text-gray-600">Click "Add New Note" to upload your first PDF</p>
            </div>
          )
        )}

        {/* Quizzes List */}
        {sidebarTab === 'quizzes' && (
          selectedNote && selectedNote.quizzes && selectedNote.quizzes.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                {selectedNote.title}
              </h4>
              {selectedNote.quizzes.map((quiz, index) => (
                <div
                  key={quiz.quizId}
                  onClick={() => {
                    selectQuiz(quiz);
                    setActiveTab('quiz');
                  }}
                  className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 border border-gray-200"
                >
                  <div className="font-semibold text-sm text-gray-900 mb-1">
                    Quiz #{index + 1}
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    {new Date(quiz.createdAt).toLocaleDateString()}
                  </div>
                  {quiz.score && (
                    <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded inline-block">
                      Score: {quiz.score.percentage}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">🧠</div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                {selectedNote ? 'No quizzes yet' : 'Select a note'}
              </p>
              <p className="text-xs text-gray-600">
                {selectedNote ? 'Generate a quiz to see it here' : 'Choose a note from the Notes tab'}
              </p>
            </div>
          )
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded-md shadow-lg text-sm font-medium z-50 ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.message}
        </div>
      )}

      {/* Quiz Confirmation */}
      {showQuizConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="text-4xl mb-4">🧠</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Generate Quiz?</h3>
              <p className="text-sm text-gray-600 mb-6">
                Do you want to create a quiz based on "{selectedNote?.title}"?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={confirmGenerateQuiz}
                  className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
                >
                  Yes, Generate
                </button>
                <button
                  onClick={() => setShowQuizConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesInlineView;
