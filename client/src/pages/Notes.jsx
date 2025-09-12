import React, { useState, useRef, useEffect } from 'react';
import { Navigationinner } from "../components/navigationinner";
import ChatbotButton from '../components/ChatbotButton';
import axios from 'axios';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;

const Notes = () => {
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'summarizer', 'quiz'
  const [summary, setSummary] = useState('');
  const [quiz, setQuiz] = useState([]);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [currentQuizId, setCurrentQuizId] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizScore, setQuizScore] = useState(null);
  const [quizHistory, setQuizHistory] = useState([]);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showQuizPopup, setShowQuizPopup] = useState(false);
  const [toast, setToast] = useState(null);
  const [showQuizConfirm, setShowQuizConfirm] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('notes'); // 'notes' or 'quizzes'
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  // Toast notification system
  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load notes on component mount
  useEffect(() => {
    loadUserNotes();
  }, []);

  // Debug effect to monitor chat messages state
  useEffect(() => {
    console.log('Chat messages updated:', {
      selectedNote: selectedNote?.title || 'none',
      activeTab,
      chatMessagesCount: Array.isArray(chatMessages) ? chatMessages.length : 'not array',
      chatMessagesType: typeof chatMessages
    });
  }, [chatMessages, selectedNote, activeTab]);

  // Load notes when selectedNote changes
  useEffect(() => {
    if (selectedNote) {
      loadChatHistory();
    }
  }, [selectedNote]);

  const loadUserNotes = async () => {
    try {
      // Get user ID from localStorage or use a placeholder
      const userId = localStorage.getItem('userId') || 'temp-user-id';
      const response = await axios.get(`${apiUrl}/notes/${userId}`);
      
      // Ensure response.data is an array
      const notesData = Array.isArray(response.data) ? response.data : [];
      setNotes(notesData);
      
      // If we have notes and no selected note, select the first one
      if (notesData.length > 0 && !selectedNote) {
        console.log('Auto-selecting first note:', notesData[0].title);
        setSelectedNote(notesData[0]);
        setActiveTab('chat');
        // Load the stored data for the selected note
        setTimeout(() => {
          loadNoteData(notesData[0]);
        }, 0);
      }
    } catch (error) {
      console.error('Error loading notes:', error);
      // Set empty array on error to prevent map errors
      setNotes([]);
    }
  };

  const loadNoteData = (note) => {
    if (!note) return;
    
    // Load stored summary
    setSummary(note.summary || '');
    
    // Load stored chat history - ensure it's always an array
    const chatHistory = Array.isArray(note.chatHistory) ? note.chatHistory : [];
    setChatMessages(chatHistory);
    
    // Load stored quiz history - ensure it's always an array
    const quizHistory = Array.isArray(note.quizzes) ? note.quizzes : [];
    setQuizHistory(quizHistory);
    
    console.log('Loaded note data:', {
      title: note.title,
      chatHistory: chatHistory.length,
      quizHistory: quizHistory.length,
      summary: note.summary ? 'present' : 'empty'
    });
  };

  const loadChatHistory = () => {
    // Load chat history from localStorage for the selected note
    if (!selectedNote) return;
    const noteId = selectedNote._id || selectedNote.id;
    const chatHistory = localStorage.getItem(`chat-${noteId}`) || '[]';
    setChatMessages(JSON.parse(chatHistory));
  };

  const saveChatHistory = (messages) => {
    if (selectedNote) {
      const noteId = selectedNote._id || selectedNote.id;
      localStorage.setItem(`chat-${noteId}`, JSON.stringify(messages));
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      showToast('Please select a PDF file', 'error');
      return;
    }

    // Check file size (2MB = 2 * 1024 * 1024 bytes)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast('File size must be less than 2MB', 'error');
      return;
    }

    // Check for duplicate names
    const existingNote = notes.find(note => note.title === file.name);
    if (existingNote) {
      showToast(`A note with the name "${file.name}" already exists. Please rename the file or delete the existing note.`, 'error');
      return;
    }

    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('title', file.name);
    formData.append('userId', localStorage.getItem('userId') || 'temp-user-id');

    try {
      setIsLoading(true);
      const response = await axios.post(`${apiUrl}/upload-notes`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Refresh the notes list
      await loadUserNotes();
      setSelectedNote(response.data);
      setShowAddNote(false);
      setActiveTab('chat');
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

    const userMessage = { role: 'user', content: newMessage };
    const updatedMessages = [...chatMessages, userMessage];
    setChatMessages(updatedMessages);
    setNewMessage('');
    setIsLoading(true);

    // Reset textarea height
    setTimeout(() => {
      const textarea = document.querySelector('textarea[placeholder*="Ask a question"]');
      if (textarea) {
        textarea.style.height = '50px';
      }
    }, 0);

    try {
      const response = await axios.post(`${apiUrl}/chat-with-notes`, {
        noteId: selectedNote._id,
        message: newMessage,
        chatHistory: chatMessages
      });

      const botMessage = { role: 'assistant', content: response.data.response };
      const finalMessages = [...updatedMessages, botMessage];
      setChatMessages(finalMessages);
      
      // Refresh notes to get updated chat history from database
      await loadUserNotes();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!selectedNote) return;

    // If summary already exists, just switch to summarizer tab
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
      
      // Refresh notes to get updated summary from database
      await loadUserNotes();
    } catch (error) {
      console.error('Error generating summary:', error);
      alert('Error generating summary. Please try again.');
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
      setQuiz(response.data.quiz);
      setCurrentQuiz(response.data.quiz);
      setCurrentQuizId(response.data.quizId);
      setQuizAnswers({});
      setQuizScore(null);
      
      // Refresh notes to get updated quiz history from database
      await loadUserNotes();
      showToast('Quiz generated successfully!', 'success');
    } catch (error) {
      console.error('Error generating quiz:', error);
      showToast('Error generating quiz. Please try again.', 'error');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleQuizAnswer = (questionIndex, answer) => {
    setQuizAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
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

    // Save quiz results to database
    try {
      await axios.post(`${apiUrl}/save-quiz-results`, {
        noteId: selectedNote._id,
        quizId: currentQuizId,
        userAnswers: quizAnswers,
        score: scoreData
      });
      
      // Refresh notes to get updated quiz history
      await loadUserNotes();
    } catch (error) {
      console.error('Error saving quiz results:', error);
    }
  };

  const resetQuiz = () => {
    setQuizScore(null);
    setQuizAnswers({});
    setCurrentQuiz(null);
    setCurrentQuizId(null);
  };

  const selectQuiz = (quiz) => {
    setCurrentQuiz(quiz.questions);
    setCurrentQuizId(quiz.quizId);
    setQuizAnswers(quiz.userAnswers || {});
    setQuizScore(quiz.score || null);
  };

  const handleNoteSelect = (note) => {
    console.log('Selecting note:', note.title);
    
    // Reset states first
    setActiveTab('chat');
    resetQuiz();
    
    // Set selected note
    setSelectedNote(note);
    
    // Load note data after a brief delay to ensure state is updated
    setTimeout(() => {
      loadNoteData(note);
    }, 0);
  };

  const handleDeleteNote = async (noteId, noteTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${noteTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`${apiUrl}/notes/${noteId}`);
      showToast('Note deleted successfully!', 'success');
      
      // Refresh notes list
      await loadUserNotes();
      
      // If the deleted note was selected, clear selection
      if (selectedNote && (selectedNote._id === noteId || selectedNote.id === noteId)) {
        setSelectedNote(null);
        setActiveTab('chat');
        resetQuiz();
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      showToast('Error deleting note. Please try again.', 'error');
    }
  };



  // Auto-resize textarea based on content
  const autoResizeTextarea = (textarea) => {
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const minHeight = 50;
      const maxHeight = 150;
      
      if (scrollHeight > maxHeight) {
        textarea.style.height = `${maxHeight}px`;
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.height = `${Math.max(scrollHeight, minHeight)}px`;
        textarea.style.overflowY = 'hidden';
      }
    }
  };

  // Handle textarea change with auto-resize
  const handleTextareaChange = (e) => {
    setNewMessage(e.target.value);
    autoResizeTextarea(e.target);
  };

  // Enhanced markdown renderer for chat responses
  const renderMarkdown = (text) => {
    if (!text) return '';
    
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background: rgba(0,0,0,0.1); padding: 2px 4px; border-radius: 4px; font-family: monospace;">$1</code>')
      .replace(/```([\s\S]*?)```/g, '<pre style="background: rgba(0,0,0,0.05); padding: 1rem; border-radius: 8px; overflow-x: auto; font-family: monospace; white-space: pre-wrap;">$1</pre>')
      .replace(/^### (.*$)/gim, '<h3 style="margin: 1rem 0 0.5rem 0; color: #1f2937;">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="margin: 1rem 0 0.5rem 0; color: #1f2937;">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 style="margin: 1rem 0 0.5rem 0; color: #1f2937;">$1</h1>')
      .replace(/^\d+\. (.*$)/gim, '<div style="margin: 0.5rem 0; padding-left: 1rem;">$1</div>')
      .replace(/^\* (.*$)/gim, '<div style="margin: 0.5rem 0; padding-left: 1rem;">• $1</div>')
      .replace(/^- (.*$)/gim, '<div style="margin: 0.5rem 0; padding-left: 1rem;">• $1</div>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^(?!<[h|d|p|p|u|l])(.*)$/gm, '<p style="margin: 0.5rem 0;">$1</p>');
  };

  // Loading spinner component
  const LoadingSpinner = ({ size = 'medium' }) => {
    const spinnerSize = size === 'large' ? '40px' : size === 'small' ? '20px' : '30px';
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2rem'
      }}>
        <div style={{
          width: spinnerSize,
          height: spinnerSize,
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
      </div>
    );
  };

  const styles = {
    container: {
      display: 'flex',
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    },
    mainContent: {
      flex: '1',
      display: 'flex',
      flexDirection: 'column',
      padding: '1.5rem',
      gap: '1rem'
    },
    sidebar: {
      width: '350px',
      background: 'rgba(255, 255, 255, 0.98)',
      backdropFilter: 'blur(20px)',
      borderLeft: '1px solid rgba(229, 231, 235, 0.8)',
      padding: '1.5rem',
      overflowY: 'auto',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
    },
    sidebarHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '2rem',
      paddingBottom: '1.5rem',
      borderBottom: '2px solid rgba(102, 126, 234, 0.1)'
    },
    addButton: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      border: 'none',
      borderRadius: '12px',
      width: '44px',
      height: '44px',
      cursor: 'pointer',
      fontSize: '1.4rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)',
      fontWeight: '600'
    },
    noteItem: {
      padding: '1.5rem',
      marginBottom: '0.75rem',
      borderRadius: '12px',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      border: '1px solid transparent',
      background: 'rgba(255, 255, 255, 0.6)',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      position: 'relative'
    },
    noteItemActive: {
      background: 'rgba(102, 126, 234, 0.1)',
      border: '1px solid rgba(102, 126, 234, 0.3)'
    },
    mainContent: {
      flex: '1',
      display: 'flex',
      flexDirection: 'column',
      padding: '1.5rem',
      gap: '1rem',
      height: 'calc(100vh - 80px)',
      overflow: 'hidden'
    },
    contentHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1.5rem',
      background: 'rgba(255, 255, 255, 0.98)',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.2)'
    },
    tabButtons: {
      display: 'flex',
      gap: '1rem'
    },
    tabButton: {
      padding: '1.2rem 2.5rem',
      border: 'none',
      borderRadius: '12px',
      cursor: 'pointer',
      fontSize: '1.1rem',
      fontWeight: '600',
      transition: 'all 0.3s ease',
      minWidth: '140px',
      textAlign: 'center'
    },
    tabButtonActive: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
      transform: 'translateY(-2px)'
    },
    tabButtonInactive: {
      background: 'rgba(255, 255, 255, 0.8)',
      color: '#6b7280',
      border: '2px solid rgba(229, 231, 235, 0.8)'
    },
    chatContainer: {
      flex: '1',
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      overflow: 'hidden'
    },
    messagesContainer: {
      flex: '1',
      padding: '1rem 1.5rem',
      overflowY: 'auto',
      height: '500px',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem'
    },
    chatInputContainer: {
      background: 'rgba(255, 255, 255, 0.98)',
      borderRadius: '12px',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
      padding: '0.3rem',
      border: '1px solid rgba(229, 231, 235, 0.8)',
      width: '680px',
      margin: '1rem auto 0 auto',
      minHeight: 'auto'
    },
    message: {
      marginBottom: '1.25rem',
      padding: '1.25rem 1.5rem',
      borderRadius: '20px',
      width: '680px',
      minWidth: '280px',
      maxWidth: '580px',
      wordWrap: 'break-word',
      overflowWrap: 'break-word',
      display: 'inline-block',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.2)'
    },
    userMessage: {
      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.9) 100%)',
      color: '#1f2937',
      border: '1px solid rgba(226, 232, 240, 0.8)',
      display: 'block',
      textAlign: 'left',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
      position: 'relative'
    },
    botMessage: {
      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.9) 100%)',
      color: '#1f2937',
      border: '1px solid rgba(226, 232, 240, 0.8)',
      display: 'block',
      textAlign: 'left',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
      position: 'relative'
    },
    inputContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem'
    },
    inputRow: {
      display: 'flex',
      gap: '0.75rem',
      alignItems: 'flex-end'
    },
    inputRowSimple: {
      display: 'flex',
      flexDirection: 'row',
      gap: '0.5rem',
      alignItems: 'center'
    },
    messageInput: {
      flex: '1',
      padding: '0.75rem 1rem',
      border: '1px solid rgba(229, 231, 235, 0.8)',
      borderRadius: '8px',
      fontSize: '1.5rem',
      outline: 'none',
      transition: 'all 0.3s ease',
      minHeight: '65px',
      maxHeight: '60px',
      resize: 'none',
      fontFamily: 'inherit',
      lineHeight: '1.4',
      width: '100%',
      overflow: 'hidden'
    },
    sendButton: {
      padding: '0.4rem 0.8rem',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '1.8rem',
      fontWeight: '600',
      transition: 'all 0.3s ease',
      boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
      minWidth: '60px',
      height: '30px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    contentArea: {
      flex: '1',
      background: 'rgba(255, 255, 255, 0.98)',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      padding: '2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.2)'
    },
    contentArea: {
      flex: '1',
      background: 'rgba(255, 255, 255, 0.98)',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      padding: '2rem',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      overflowY: 'auto',
      height: '400px',
      display: 'flex',
      flexDirection: 'column'
    },
    summaryContent: {
      flex: '1',
      background: 'rgba(255, 255, 255, 0.98)',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      padding: '1.5rem',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      overflowY: 'auto',
      height: '500px'
    },
    quizContent: {
      flex: '1',
      background: 'rgba(255, 255, 255, 0.98)',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      padding: '1.5rem',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      overflowY: 'auto',
      height: '500px'
    },
    quizQuestion: {
      marginBottom: '2rem',
      padding: '1.5rem',
      background: 'rgba(59, 130, 246, 0.05)',
      borderRadius: '12px',
      border: '1px solid rgba(59, 130, 246, 0.1)'
    },
    quizOption: {
      marginBottom: '0.75rem',
      padding: '0.75rem 1rem',
      background: 'rgba(255, 255, 255, 0.9)',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      border: '2px solid rgba(229, 231, 235, 0.8)'
    },
    quizOptionSelected: {
      background: 'rgba(59, 130, 246, 0.1)',
      border: '2px solid rgba(59, 130, 246, 0.4)'
    },
    quizSubmitButton: {
      padding: '1rem 2rem',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      border: 'none',
      borderRadius: '12px',
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: '600',
      transition: 'all 0.3s ease',
      boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)',
      marginTop: '1rem'
    },
    scoreCard: {
      textAlign: 'center',
      padding: '2rem',
      background: 'rgba(255, 255, 255, 0.98)',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.2)'
    },
    emptyState: {
      textAlign: 'center',
      color: '#6b7280',
      fontSize: '1.1rem'
    },
    hiddenInput: {
      display: 'none'
    },
    quizPopup: {
      position: 'absolute',
      top: '0',
      right: '100%',
      width: '300px',
      background: 'rgba(255, 255, 255, 0.98)',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
      padding: '1rem',
      marginRight: '1rem',
      zIndex: 1000,
      maxHeight: '400px',
      overflowY: 'auto',
      border: '1px solid rgba(229, 231, 235, 0.8)'
    },
    quizPopupHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1rem',
      paddingBottom: '0.5rem',
      borderBottom: '1px solid rgba(229, 231, 235, 0.8)'
    },
    closeButton: {
      background: 'none',
      border: 'none',
      fontSize: '1.2rem',
      cursor: 'pointer',
      color: '#6b7280'
    },
    toast: {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '1rem 1.5rem',
      borderRadius: '8px',
      color: 'white',
      fontWeight: '600',
      zIndex: 9999,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      animation: 'slideIn 0.3s ease-out'
    },
    toastSuccess: {
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
    },
    toastError: {
      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
    },
    confirmationDialog: {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    },
    confirmationContent: {
      background: 'white',
      borderRadius: '16px',
      padding: '2rem',
      maxWidth: '400px',
      width: '90%',
      textAlign: 'center',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
    },
    confirmationButtons: {
      display: 'flex',
      gap: '1rem',
      justifyContent: 'center',
      marginTop: '1.5rem'
    },
    confirmButton: {
      padding: '0.75rem 1.5rem',
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: '600',
      transition: 'all 0.3s ease'
    },
    cancelButton: {
      padding: '0.75rem 1.5rem',
      background: 'rgba(107, 114, 128, 0.1)',
      color: '#6b7280',
      border: '2px solid rgba(107, 114, 128, 0.2)',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: '600',
      transition: 'all 0.3s ease'
    },
    deleteButton: {
      position: 'absolute',
      top: '0.5rem',
      right: '0.5rem',
      background: 'rgba(239, 68, 68, 0.1)',
      color: '#ef4444',
      border: 'none',
      borderRadius: '6px',
      width: '24px',
      height: '24px',
      cursor: 'pointer',
      fontSize: '1.0rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.3s ease',
      opacity: '0.7'
    },
    sidebarTabs: {
      display: 'flex',
      marginBottom: '1.5rem',
      background: 'rgba(255, 255, 255, 0.5)',
      borderRadius: '8px',
      padding: '0.25rem'
    },
    sidebarTab: {
      flex: '1',
      padding: '0.75rem 1rem',
      background: 'transparent',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '1.3rem',
      fontWeight: '600',
      color: '#6b7280',
      transition: 'all 0.3s ease',
      textAlign: 'center'
    },
    sidebarTabActive: {
      background: 'rgba(102, 126, 234, 0.1)',
      color: '#667eea'
    }
  };

  return (
    <>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>
      <Navigationinner title={"NOTES"} />
      <div style={styles.container}>
        {/* Main Content */}
        <div style={styles.mainContent}>
          {selectedNote ? (
            <>
              <div style={styles.contentHeader}>
                <h2 style={{ margin: 0, color: '#1f2937', fontSize: '1.8rem' }}>{selectedNote.title}</h2>
                <div style={styles.tabButtons}>
                  <button
                    style={{
                      ...styles.tabButton,
                      ...(activeTab === 'chat' ? styles.tabButtonActive : styles.tabButtonInactive)
                    }}
                    onClick={() => setActiveTab('chat')}
                  >
                    💬 Chat
                  </button>
                  <button
                    style={{
                      ...styles.tabButton,
                      ...(activeTab === 'summarizer' ? styles.tabButtonActive : styles.tabButtonInactive)
                    }}
                    onClick={handleSummarize}
                    disabled={isLoading}
                  >
                    📝 Summarize
                  </button>
                  <button
                    style={{
                      ...styles.tabButton,
                      ...(activeTab === 'quiz' ? styles.tabButtonActive : styles.tabButtonInactive)
                    }}
                    onClick={handleGenerateQuiz}
                    disabled={isLoading}
                  >
                    🧠 Quiz
                  </button>
                </div>
              </div>

              {activeTab === 'chat' && selectedNote && (
                <>
                  <div style={styles.chatContainer}>
                    <div style={styles.messagesContainer}>
                      {Array.isArray(chatMessages) && chatMessages.map((message, index) => (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                            width: '100%'
                          }}
                        >
                          <div
                            style={{
                              ...styles.message,
                              ...(message.role === 'user' ? styles.userMessage : styles.botMessage)
                            }}
                          >
                            {message.role === 'user' ? (
                              <div style={{ 
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                lineHeight: '1.7',
                                fontSize: '1.5rem',
                                fontWeight: '400',
                                letterSpacing: '0.01em'
                              }}>
                                {message.content}
                              </div>
                            ) : (
                              <div 
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                                style={{
                                  lineHeight: '1.2',
                                  // wordBreak: 'break-word',
                                  fontSize: '1.5rem',
                                  fontWeight: '400',
                                  letterSpacing: '0.02em'
                                }}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                      {Array.isArray(chatMessages) && chatMessages.length === 0 && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          height: '200px',
                          width: '100%'
                        }}>
                          <div style={{
                            textAlign: 'center',
                            color: '#6b7280',
                            fontSize: '1.1rem'
                          }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
                            <p>Start a conversation about your notes!</p>
                            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                              Ask questions, get explanations, or request summaries.
                            </p>
                          </div>
                        </div>
                      )}
                      {isLoading && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'flex-start',
                          width: '100%'
                        }}>
                          <div style={{ ...styles.message, ...styles.botMessage }}>
                            <LoadingSpinner size="small" />
                            <span style={{ 
                              marginLeft: '0.5rem', 
                              fontSize: '1.1rem',
                              fontWeight: '500',
                              color: '#6b7280'
                            }}>Thinking...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div style={styles.chatInputContainer}>
                    <div style={styles.inputRowSimple}>
                      <textarea
                        value={newMessage}
                        onChange={handleTextareaChange}
                        placeholder="Ask a question about your notes..."
                        style={styles.messageInput}
                        rows={1}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        onInput={(e) => autoResizeTextarea(e.target)}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <button
                          onClick={handleSendMessage}
                          disabled={!newMessage.trim() || isLoading}
                          style={styles.sendButton}
                        >
                          {isLoading ? '⏳' : '📤'}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'summarizer' && (
                <div style={styles.summaryContent}>
                  {isSummarizing ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                      <LoadingSpinner size="large" />
                      <h3 style={{ marginTop: '1rem', color: '#667eea' }}>Generating Summary...</h3>
                      <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>This may take a few moments</p>
                    </div>
                  ) : summary ? (
                    <div style={{ textAlign: 'left', lineHeight: '1.8' }}>
                      <h2 style={{ 
                        marginBottom: '2rem', 
                        color: '#1f2937',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontSize: '2.2rem',
                        fontWeight: '700',
                        textAlign: 'center'
                      }}>
                        📝 Summary
                      </h2>
                      <div 
                        style={{ 
                          color: '#374151',
                          fontSize: '1.3rem',
                          lineHeight: '2',
                          maxWidth: 'none',
                          textAlign: 'left'
                        }}
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(summary) }}
                      />
                    </div>
                  ) : (
                    <div style={styles.emptyState}>
                      <h3 style={{ color: '#1f2937', marginBottom: '1rem' }}>Generate Summary</h3>
                      <p>Click the Summarize button to generate a comprehensive summary of your notes.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'quiz' && (
                <div style={styles.quizContent}>
                  {isGeneratingQuiz ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                      <LoadingSpinner size="large" />
                      <h3 style={{ marginTop: '1rem', color: '#667eea' }}>Generating Quiz...</h3>
                      <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>Creating questions from your notes</p>
                    </div>
                  ) : quizScore ? (
                    <div style={styles.scoreCard}>
                      <h2 style={{ 
                        color: '#1f2937',
                        marginBottom: '1rem',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontSize: '2rem',
                        fontWeight: '700'
                      }}>
                        🎯 Quiz Results
                      </h2>
                      <div style={{ fontSize: '3rem', fontWeight: '700', marginBottom: '1rem' }}>
                        {quizScore.percentage >= 80 ? '🎉' : quizScore.percentage >= 60 ? '👍' : '💪'}
                      </div>
                      <div style={{ fontSize: '4rem', fontWeight: '700', marginBottom: '1rem' }}>
                        <span style={{ 
                          color: quizScore.percentage >= 80 ? '#10b981' : 
                                 quizScore.percentage >= 60 ? '#f59e0b' : '#ef4444'
                        }}>
                          {quizScore.percentage}%
                        </span>
                      </div>
                      <p style={{ fontSize: '1.2rem', color: '#6b7280', marginBottom: '1rem' }}>
                        You got {quizScore.correct} out of {quizScore.total} questions correct
                      </p>
                      <button 
                        onClick={resetQuiz}
                        style={styles.quizSubmitButton}
                      >
                        Take Quiz Again
                      </button>
                    </div>
                  ) : currentQuiz && currentQuiz.length > 0 ? (
                    <div style={{ width: '100%' }}>
                      <h2 style={{ 
                        marginBottom: '2rem', 
                        color: '#1f2937',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontSize: '1.8rem',
                        fontWeight: '700',
                        textAlign: 'center'
                      }}>
                        🧠 Quiz Time
                      </h2>
                      {currentQuiz.map((q, index) => (
                        <div key={index} style={styles.quizQuestion}>
                          <h4 style={{ marginBottom: '1rem', color: '#1f2937', fontSize: '1.2rem' }}>
                            {index + 1}. {q.question}
                          </h4>
                          <div>
                            {q.options.map((option, optIndex) => (
                              <div 
                                key={optIndex} 
                                style={{
                                  ...styles.quizOption,
                                  ...(quizAnswers[index] === String.fromCharCode(65 + optIndex) ? styles.quizOptionSelected : {})
                                }}
                                onClick={() => handleQuizAnswer(index, String.fromCharCode(65 + optIndex))}
                              >
                                <strong>{String.fromCharCode(65 + optIndex)}.</strong> {option}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                        <button 
                          onClick={handleSubmitQuiz}
                          style={styles.quizSubmitButton}
                          disabled={Object.keys(quizAnswers).length !== currentQuiz.length}
                        >
                          Submit Quiz
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={styles.emptyState}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🧠</div>
                      <h3 style={{ color: '#1f2937', marginBottom: '1rem' }}>No Quiz Yet</h3>
                      <p style={{ marginBottom: '1rem' }}>Click the "🧠 Quiz" button above to generate interactive questions based on your notes.</p>
                      <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                        Each quiz will be saved and you can access it anytime from the sidebar.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={styles.contentArea}>
              <div style={styles.emptyState}>
                <h2>Welcome to Notes</h2>
                <p>Upload a PDF to start chatting with your notes, generate summaries, or create quizzes.</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <h3 style={{ margin: 0, color: '#1f2937', fontSize: '1.4rem', fontWeight: '700' }}>📚 My Notes</h3>
            {sidebarTab === 'notes' && (
              <button
                style={styles.addButton}
                onClick={() => fileInputRef.current?.click()}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.1)';
                  e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                  e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
                }}
              >
                +
              </button>
            )}
          </div>

          {/* Sidebar Tabs */}
          <div style={styles.sidebarTabs}>
            <button
              style={{
                ...styles.sidebarTab,
                ...(sidebarTab === 'notes' ? styles.sidebarTabActive : {})
              }}
              onClick={() => setSidebarTab('notes')}
            >
              📄 Notes
            </button>
            <button
              style={{
                ...styles.sidebarTab,
                ...(sidebarTab === 'quizzes' ? styles.sidebarTabActive : {})
              }}
              onClick={() => setSidebarTab('quizzes')}
            >
              🧠 Quizzes
            </button>
          </div>
          
          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf"
            onChange={handleFileUpload}
            style={styles.hiddenInput}
          />

          {sidebarTab === 'notes' && Array.isArray(notes) && notes.map((note) => (
            <div key={note._id || note.id} style={{ position: 'relative' }}>
              <div
                style={{
                  ...styles.noteItem,
                  ...(selectedNote?._id === note._id || selectedNote?.id === note.id ? styles.noteItemActive : {})
                }}
                onClick={() => handleNoteSelect(note)}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(102, 126, 234, 0.1)';
                  e.target.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = (selectedNote?._id === note._id || selectedNote?.id === note.id)
                    ? 'rgba(102, 126, 234, 0.1)' 
                    : 'rgba(255, 255, 255, 0.5)';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                <button
                  style={styles.deleteButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNote(note._id || note.id, note.title);
                  }}
                  title="Delete note"
                  onMouseEnter={(e) => {
                    e.target.style.opacity = '1';
                    e.target.style.background = 'rgba(239, 68, 68, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.opacity = '0.7';
                    e.target.style.background = 'rgba(239, 68, 68, 0.1)';
                  }}
                >
                  🗑️
                </button>
                <div style={{ fontWeight: '700', marginBottom: '0.5rem', fontSize: '1.3rem'}}>
                  {note.title}
                </div>
                <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                  📅 {new Date(note.uploadedAt).toLocaleDateString()}
                </div>
                {note.summary && (
                  <div style={{ 
                    fontSize: '1.0rem', 
                    color: '#10b981', 
                    marginTop: '0.5rem',
                    fontWeight: '600',
                    marginRight : "5px",
                    padding: '0.25rem 0.5rem',
                    background: 'rgba(16, 185, 129, 0.1)',
                    borderRadius: '6px',
                    display: 'inline-block'
                  }}>
                    ✅ Summary Available
                  </div>
                )}
                {note.quizzes && note.quizzes.length > 0 && (
                  <div 
                    style={{ 
                      fontSize: '1.0rem', 
                      color: '#3b82f6', 
                      marginTop: '0.5rem', 
                      cursor: 'pointer',
                      fontWeight: '600',
                      padding: '0.25rem 0.5rem',
                      background: 'rgba(59, 130, 246, 0.1)',
                      borderRadius: '6px',
                      display: 'inline-block'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNote(note);
                      loadNoteData(note);
                      setSidebarTab('quizzes');
                    }}
                  >
                    🧠 {note.quizzes.length} Quiz{note.quizzes.length > 1 ? 'zes' : ''} (Click to view)
                  </div>
                )}
              </div>

            </div>
          ))}

          {sidebarTab === 'notes' && (!Array.isArray(notes) || notes.length === 0) && (
            <div style={{ textAlign: 'center', color: '#6b7280', marginTop: '2rem', padding: '2rem' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>📄</div>
              <p style={{ fontSize: '1.2rem', marginBottom: '0.75rem', fontWeight: '600', color: '#374151' }}>No notes uploaded yet</p>
              <p style={{ fontSize: '1rem', color: '#6b7280' }}>Click + to add your first PDF</p>
            </div>
          )}

          {/* Quizzes Tab Content */}
          {sidebarTab === 'quizzes' && (
            <>
              {selectedNote && selectedNote.quizzes && selectedNote.quizzes.length > 0 ? (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <h4 style={{ color: '#1f2937', fontSize: '1.1rem', fontWeight: '600' }}>
                      📚 {selectedNote.title}
                    </h4>
                  </div>
                  {selectedNote.quizzes.map((quiz, index) => (
                    <div
                      key={quiz.quizId}
                      style={{
                        ...styles.noteItem,
                        cursor: 'pointer',
                        background: quiz.score ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.6)',
                        marginBottom: '0.75rem',
                        padding: '1.25rem'
                      }}
                      onClick={() => {
                        selectQuiz(quiz);
                        setActiveTab('quiz');
                      }}
                    >
                      <div style={{ fontWeight: '700', fontSize: '1rem', color: '#1f2937', marginBottom: '0.5rem' }}>
                        Quiz #{index + 1}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                        📅 {new Date(quiz.createdAt).toLocaleDateString()}
                      </div>
                      {quiz.score && (
                        <div style={{ 
                          fontSize: '0.9rem', 
                          color: '#10b981', 
                          marginTop: '0.5rem',
                          fontWeight: '600',
                          padding: '0.25rem 0.5rem',
                          background: 'rgba(16, 185, 129, 0.1)',
                          borderRadius: '6px',
                          display: 'inline-block'
                        }}>
                          🎯 Score: {quiz.score.percentage}%
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ textAlign: 'center', color: '#6b7280', marginTop: '2rem', padding: '2rem' }}>
                  <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🧠</div>
                  <p style={{ fontSize: '1.2rem', marginBottom: '0.75rem', fontWeight: '600', color: '#374151' }}>
                    {selectedNote ? 'No quizzes for this note yet' : 'Select a note to view quizzes'}
                  </p>
                  <p style={{ fontSize: '1rem', color: '#6b7280' }}>
                    {selectedNote ? 'Generate a quiz to see it here' : 'Choose a note from the Notes tab'}
                  </p>
                </div>
              )}
            </>
          )}

        </div>
      </div>
      
      {/* Toast Notification */}
      {toast && (
        <div style={{
          ...styles.toast,
          ...(toast.type === 'success' ? styles.toastSuccess : styles.toastError)
        }}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.message}
        </div>
      )}

      {/* Quiz Confirmation Dialog */}
      {showQuizConfirm && (
        <div style={styles.confirmationDialog}>
          <div style={styles.confirmationContent}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🧠</div>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1f2937' }}>Generate Quiz?</h3>
            <p style={{ margin: '0 0 1rem 0', color: '#6b7280' }}>
              Do you want to create a quiz based on "{selectedNote?.title}"? 
              This will generate 5-10 interactive questions from your notes.
            </p>
            <div style={styles.confirmationButtons}>
              <button
                style={styles.confirmButton}
                onClick={confirmGenerateQuiz}
              >
                Yes, Generate Quiz
              </button>
              <button
                style={styles.cancelButton}
                onClick={() => setShowQuizConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      <ChatbotButton />
    </>
  );
};

export default Notes;
