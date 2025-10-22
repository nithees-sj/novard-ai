import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Navigationinner } from "../components/navigationinner";

const apiUrl = process.env.REACT_APP_API_ENDPOINT || 'http://localhost:5001';
console.log('DoubtClearance API URL:', apiUrl);

const DoubtClearance = () => {
  const [doubts, setDoubts] = useState([]);
  const [selectedDoubt, setSelectedDoubt] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [isGettingRecommendations, setIsGettingRecommendations] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [summary, setSummary] = useState('');
  const [quiz, setQuiz] = useState(null);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [currentQuizId, setCurrentQuizId] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizScore, setQuizScore] = useState(null);
  const [quizHistory, setQuizHistory] = useState([]);
  const [youtubeRecommendations, setYoutubeRecommendations] = useState([]);
  const [showAddDoubtForm, setShowAddDoubtForm] = useState(false);
  const [toast, setToast] = useState(null);
  const [newDoubt, setNewDoubt] = useState({ title: '', description: '', imageUrl: '' });
  const [isAddingDoubt, setIsAddingDoubt] = useState(false);
  const [showQuizHistory, setShowQuizHistory] = useState(false);

  // Toast notification function
  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load user's doubts
  const loadUserDoubts = async () => {
    try {
      const userId = localStorage.getItem('userId') || 'demo-user';
      console.log('Loading doubts for userId:', userId);
      console.log('API URL for loading doubts:', apiUrl);
      console.log('Making GET request to:', `${apiUrl}/doubt-clearances/${userId}`);
      
      const response = await axios.get(`${apiUrl}/doubt-clearances/${userId}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Doubts response status:', response.status);
      console.log('Doubts response data:', response.data);
      const doubtsData = Array.isArray(response.data) ? response.data : [];
      setDoubts(doubtsData);
      
      if (doubtsData.length > 0 && !selectedDoubt) {
        setSelectedDoubt(doubtsData[0]);
        loadDoubtData(doubtsData[0]);
      }
    } catch (error) {
      console.error('Error loading doubts:', error);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      setDoubts([]);
    }
  };

  // Load doubt data (chat history, summary, quizzes, recommendations)
  const loadDoubtData = (doubt) => {
    if (!doubt) return;
    
    // Clean chat history to remove MongoDB _id fields
    const chatHistory = Array.isArray(doubt.chatHistory) ? doubt.chatHistory : [];
    const cleanedChatHistory = chatHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    setChatMessages(cleanedChatHistory);
    setSummary(doubt.summary || '');
    setQuizHistory(doubt.quizzes || []);
    setYoutubeRecommendations(doubt.youtubeRecommendations || []);
  };

  // Add new doubt
  const handleAddDoubt = async (e) => {
    e.preventDefault();
    
    if (!newDoubt.title.trim() || !newDoubt.description.trim()) {
      showToast('Please fill in title and description', 'error');
      return;
    }

    console.log('API URL:', apiUrl);
    console.log('Adding doubt with data:', {
      title: newDoubt.title,
      description: newDoubt.description,
      imageUrl: newDoubt.imageUrl,
      userId: localStorage.getItem('userId') || 'demo-user'
    });

    setIsAddingDoubt(true);
    try {
      const userId = localStorage.getItem('userId') || 'demo-user';
      const requestData = {
        title: newDoubt.title,
        description: newDoubt.description,
        imageUrl: newDoubt.imageUrl,
        userId
      };
      
      console.log('Making request to:', `${apiUrl}/doubt-clearances`);
      console.log('Request data:', requestData);
      
      const response = await axios.post(`${apiUrl}/doubt-clearances`, requestData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Doubt added successfully:', response.data);
      setNewDoubt({ title: '', description: '', imageUrl: '' });
      setShowAddDoubtForm(false);
      await loadUserDoubts();
      showToast('Doubt added successfully!', 'success');
    } catch (error) {
      console.error('Error adding doubt:', error);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      showToast(error.response?.data?.error || error.message || 'Error adding doubt', 'error');
    } finally {
      setIsAddingDoubt(false);
    }
  };

  // Send chat message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedDoubt) return;

    const userMessage = newMessage.trim();
    setNewMessage('');
    setIsLoading(true);

    const tempUserMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, tempUserMessage]);

    try {
      const response = await axios.post(`${apiUrl}/chat-with-doubt-clearance`, {
        doubtId: selectedDoubt._id,
        message: userMessage,
        userId: localStorage.getItem('userId') || 'demo-user'
      });

      const aiResponse = {
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, aiResponse]);

      await loadUserDoubts();
      
      const updatedDoubts = await axios.get(`${apiUrl}/doubt-clearances/${localStorage.getItem('userId') || 'demo-user'}`);
      const updatedDoubt = updatedDoubts.data.find(d => d._id === selectedDoubt._id);
      if (updatedDoubt) {
        setSelectedDoubt(updatedDoubt);
        // Clean chat history to remove MongoDB _id fields
        const chatHistory = Array.isArray(updatedDoubt.chatHistory) ? updatedDoubt.chatHistory : [];
        const cleanedChatHistory = chatHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        }));
        setChatMessages(cleanedChatHistory);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Error sending message', 'error');
      setChatMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  // Summarize doubt
  const handleSummarize = async () => {
    if (!selectedDoubt) return;

    if (selectedDoubt.summary) {
      setSummary(selectedDoubt.summary);
      setActiveTab('summary');
      return;
    }

    setIsSummarizing(true);
    try {
      const response = await axios.post(`${apiUrl}/summarize-doubt-clearance`, {
        doubtId: selectedDoubt._id,
        userId: localStorage.getItem('userId') || 'demo-user'
      });

      setSummary(response.data.summary);
      setActiveTab('Solutions');
      await loadUserDoubts();
    } catch (error) {
      console.error('Error summarizing doubt:', error);
      showToast('Error generating summary', 'error');
    } finally {
      setIsSummarizing(false);
    }
  };

  // Generate quiz
  const handleGenerateQuiz = async () => {
    if (!selectedDoubt) return;
    setIsGeneratingQuiz(true);
    
    try {
      const response = await axios.post(`${apiUrl}/generate-doubt-quiz`, {
        doubtId: selectedDoubt._id,
        userId: localStorage.getItem('userId') || 'demo-user'
      });

      const newQuiz = response.data.quiz;
      setQuiz(newQuiz);
      setCurrentQuiz(newQuiz);
      setCurrentQuizId(selectedDoubt.quizzes ? selectedDoubt.quizzes.length : 0);
      setQuizAnswers({});
      setQuizScore(null);
      setShowQuizHistory(false);
      await loadUserDoubts();
    } catch (error) {
      console.error('Error generating quiz:', error);
      showToast(error.response?.data?.error || 'Error generating quiz', 'error');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  // Get YouTube recommendations
  const handleGetRecommendations = async () => {
    if (!selectedDoubt) return;

    setIsGettingRecommendations(true);
    try {
      const response = await axios.post(`${apiUrl}/get-youtube-recommendations`, {
        doubtId: selectedDoubt._id,
        userId: localStorage.getItem('userId') || 'demo-user'
      });

      setYoutubeRecommendations(response.data.recommendations);
      setActiveTab('recommendations');
      await loadUserDoubts();
    } catch (error) {
      console.error('Error getting recommendations:', error);
      showToast(error.response?.data?.error || 'Error getting recommendations', 'error');
    } finally {
      setIsGettingRecommendations(false);
    }
  };

  // Submit quiz
  const handleSubmitQuiz = async () => {
    if (!currentQuiz || !selectedDoubt) return;

    let score = 0;
    const totalQuestions = currentQuiz.length;

    currentQuiz.forEach((question, index) => {
      if (quizAnswers[index] === question.correctAnswer) {
        score++;
      }
    });

    setQuizScore({ score, totalQuestions });

    try {
      await axios.post(`${apiUrl}/save-doubt-quiz-results`, {
        doubtId: selectedDoubt._id,
        quizIndex: currentQuizId,
        score,
        userId: localStorage.getItem('userId') || 'demo-user'
      });
      await loadUserDoubts();
    } catch (error) {
      console.error('Error saving quiz results:', error);
    }
  };

  // Delete doubt
  const handleDeleteDoubt = async (doubtId, doubtTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${doubtTitle}"?`)) {
      return;
    }

    try {
      await axios.delete(`${apiUrl}/doubt-clearances/${doubtId}`, {
        data: { userId: localStorage.getItem('userId') || 'demo-user' }
      });
      await loadUserDoubts();
      
      if (selectedDoubt && selectedDoubt._id === doubtId) {
        setSelectedDoubt(null);
        setChatMessages([]);
        setSummary('');
        setQuiz(null);
        setCurrentQuiz(null);
        setQuizHistory([]);
        setYoutubeRecommendations([]);
      }
      showToast('Doubt deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting doubt:', error);
      showToast('Error deleting doubt', 'error');
    }
  };

  // Auto-resize textarea
  const autoResizeTextarea = (textarea) => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  // Render markdown-like content with better formatting
  const renderMarkdown = (text) => {
    if (!text) return '';
    
    let html = text
      // Handle headers first
      .replace(/^### (.*$)/gim, '<h3 style="font-size: 1.2rem; font-weight: 600; color: #374151; margin: 1rem 0 0.5rem 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.25rem;">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="font-size: 1.4rem; font-weight: 700; color: #1f2937; margin: 1.5rem 0 0.75rem 0; border-bottom: 3px solid #3b82f6; padding-bottom: 0.5rem;">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 style="font-size: 1.6rem; font-weight: 800; color: #111827; margin: 2rem 0 1rem 0;">$1</h1>')
      
      // Handle lists
      .replace(/^\* (.*$)/gim, '<li style="margin: 0.25rem 0; padding-left: 0.5rem;">$1</li>')
      .replace(/^- (.*$)/gim, '<li style="margin: 0.25rem 0; padding-left: 0.5rem;">$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li style="margin: 0.25rem 0; padding-left: 0.5rem;">$1</li>')
      
      // Handle inline formatting
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #e11d48;">$1</code>')
      
      // Handle line breaks and paragraphs
      .replace(/\n\n/g, '</p><p style="margin: 0.75rem 0; line-height: 1.6;">')
      .replace(/\n/g, '<br>');
    
    // Wrap in paragraphs if not already wrapped
    if (!html.startsWith('<h') && !html.startsWith('<li') && !html.startsWith('<p')) {
      html = '<p style="margin: 0.75rem 0; line-height: 1.6;">' + html + '</p>';
    }
    
    // Group consecutive list items into ul/ol
    html = html.replace(/(<li[^>]*>.*?<\/li>)(\s*<li[^>]*>.*?<\/li>)*/g, (match) => {
      return '<ul style="margin: 0.75rem 0; padding-left: 1.5rem;">' + match + '</ul>';
    });
    
    return html;
  };

  useEffect(() => {
    loadUserDoubts();
  }, []);

  useEffect(() => {
    if (selectedDoubt) {
      loadDoubtData(selectedDoubt);
    }
  }, [selectedDoubt]);

  // Styles object (similar to YouTubeVideoSummarizer)
  const styles = {
    container: {
      height: "100vh",
      background: "#f8fafc",
      padding: "1rem",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      overflow: "hidden",
    },
    mainContent: {
      display: "flex",
      gap: "1.5rem",
      maxWidth: "1800px",
      margin: "0 auto",
      marginTop: "20px",
      height: "calc(100vh - 120px)",
    },
    contentArea: {
      flex: 1,
      order: 1,
      background: "rgba(255, 255, 255, 0.95)",
      borderRadius: "20px",
      padding: "2rem",
      boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
      backdropFilter: "blur(10px)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    },
    sidebar: {
      width: "360px",
      order: 2,
      background: "rgba(255, 255, 255, 0.95)",
      borderRadius: "20px",
      padding: "1.5rem",
      boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
      backdropFilter: "blur(10px)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      height: "100%",
      overflowY: "auto",
      overflowX: "hidden",
    },
    sidebarTitle: {
      fontSize: "1.8rem",
      fontWeight: "700",
      color: "#374151",
      marginBottom: "2rem",
      textAlign: "center",
    },
    tabs: {
      display: "flex",
      marginBottom: "2rem",
      background: "rgba(255, 255, 255, 0.5)",
      borderRadius: "15px",
      padding: "0.5rem",
      gap: "0.5rem",
    },
    tabButton: {
      padding: "1rem 2rem",
      fontSize: "1.3rem",
      fontWeight: "600",
      background: "transparent",
      color: "#9ca3af",
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      transition: "all 0.3s ease",
    },
    activeTabButton: {
      background: "#374151",
      color: "#ffffff",
      boxShadow: "0 2px 8px rgba(55, 65, 81, 0.2)",
    },
    disabledTabButton: {
      background: "#f3f4f6",
      color: "#9ca3af",
      cursor: "not-allowed",
      opacity: 0.6,
    },
    requirementText: {
      fontSize: "0.9rem",
      color: "#ef4444",
      fontWeight: "500",
    },
    addButton: {
      width: "100%",
      padding: "1.2rem",
      fontSize: "1.3rem",
      fontWeight: "600",
      background: "#3b82f6",
      color: "#ffffff",
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      marginBottom: "2rem",
      transition: "all 0.3s ease",
      boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
    },
    chatContainer: {
      display: "flex",
      flexDirection: "column",
      height: "100%",
      gap: "1rem",
      flex: 1,
      minHeight: 0,
      overflow: "hidden",
    },
    messagesContainer: {
      flex: 1,
      overflowY: "auto",
      padding: "1.5rem",
      border: "1px solid rgba(107, 114, 128, 0.2)",
      borderRadius: "15px",
      background: "rgba(255, 255, 255, 0.8)",
      backdropFilter: "blur(10px)",
      minHeight: 0,
    },
    message: {
      padding: "1.5rem",
      marginBottom: "1.5rem",
      borderRadius: "20px",
      fontSize: "1.3rem",
      lineHeight: "1.7",
      boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
    },
    userMessage: {
      background: "#374151",
      color: "#ffffff",
      marginLeft: "30%",
      maxWidth: "70%",
    },
    botMessage: {
      background: "rgba(255, 255, 255, 0.9)",
      color: "#374151",
      border: "1px solid rgba(107, 114, 128, 0.2)",
      marginRight: "30%",
      maxWidth: "70%",
    },
    chatInputContainer: {
      display: "flex",
      gap: "1rem",
      alignItems: "flex-end",
      width: "100%",
      marginTop: "auto",
    },
    messageInput: {
      flex: 1,
      padding: "1.2rem",
      fontSize: "1.3rem",
      border: "1px solid rgba(107, 114, 128, 0.3)",
      borderRadius: "15px",
      background: "rgba(255, 255, 255, 0.9)",
      color: "#374151",
      resize: "none",
      minHeight: "60px",
      maxHeight: "150px",
      boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
      fontFamily: "inherit",
      outline: "none",
      width: "100%",
    },
    sendButton: {
      padding: "1rem 2rem",
      fontSize: "1.3rem",
      fontWeight: "600",
      background: "#3b82f6",
      marginBottom: "12px",
      color: "#ffffff",
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      transition: "all 0.3s ease",
      boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
    },
    addDoubtForm: {
      padding: "2rem",
      marginBottom: "2rem",
      border: "1px solid rgba(107, 114, 128, 0.2)",
      borderRadius: "20px",
      background: "rgba(255, 255, 255, 0.9)",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
    },
    formTitle: {
      fontSize: "1.4rem",
      fontWeight: "600",
      color: "#374151",
      marginBottom: "2rem",
      textAlign: "center",
    },
    inputGroup: {
      marginBottom: "2rem",
    },
    label: {
      display: "block",
      fontSize: "1.1rem",
      fontWeight: "500",
      color: "#374151",
      marginBottom: "0.8rem",
    },
    input: {
      width: "100%",
      padding: "1.2rem",
      fontSize: "1.1rem",
      border: "1px solid rgba(107, 114, 128, 0.3)",
      borderRadius: "15px",
      background: "rgba(255, 255, 255, 0.9)",
      color: "#374151",
      boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
    },
    button: {
      width: "100%",
      padding: "1.2rem",
      fontSize: "1.1rem",
      fontWeight: "600",
      background: "#3b82f6",
      color: "#ffffff",
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
      transition: "all 0.3s ease",
    },
    disabledButton: {
      background: "#9ca3af",
      cursor: "not-allowed",
      boxShadow: "0 2px 8px rgba(156, 163, 175, 0.3)",
    },
    doubtItem: {
      padding: "1.2rem",
      marginBottom: "1rem",
      border: "1px solid rgba(107, 114, 128, 0.2)",
      borderRadius: "15px",
      background: "rgba(255, 255, 255, 0.9)",
      cursor: "pointer",
      position: "relative",
      transition: "all 0.3s ease",
      boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
    },
    selectedDoubtItem: {
      background: "#f3f4f6",
      color: "#374151",
      border: "2px solid #374151",
      boxShadow: "0 4px 20px rgba(55, 65, 81, 0.2)",
    },
    doubtTitle: {
      fontSize: "1.4rem",
      fontWeight: "600",
      marginBottom: "0.5rem",
      color: "#374151",
    },
    doubtDescription: {
      fontSize: "1.2rem",
      color: "#6b7280",
      marginBottom: "0.5rem",
      wordBreak: "break-word",
    },
    doubtDate: {
      fontSize: "1.1rem",
      color: "#9ca3af",
    },
    deleteButton: {
      position: "absolute",
      top: "0.5rem",
      right: "0.5rem",
      width: "28px",
      height: "28px",
      background: "rgba(239, 68, 68, 0.1)",
      border: "1px solid rgba(239, 68, 68, 0.3)",
      borderRadius: "50%",
      cursor: "pointer",
      fontSize: "0.9rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#ef4444",
      transition: "all 0.3s ease",
    },
    emptyState: {
      textAlign: "center",
      padding: "4rem 2rem",
      color: "#6b7280",
    },
    emptyStateTitle: {
      fontSize: "1.5rem",
      fontWeight: "600",
      color: "#374151",
      marginBottom: "1rem",
    },
    emptyStateText: {
      fontSize: "1.1rem",
      color: "#6b7280",
      lineHeight: "1.6",
    },
    loadingSpinner: {
      textAlign: "center",
      padding: "2rem",
      fontSize: "1.2rem",
      color: "#6b7280",
    },
    toast: {
      position: "fixed",
      top: "2rem",
      right: "2rem",
      padding: "1.5rem 2rem",
      fontSize: "1.1rem",
      borderRadius: "15px",
      border: "1px solid rgba(107, 114, 128, 0.2)",
      zIndex: 1000,
      fontWeight: "500",
      boxShadow: "0 8px 30px rgba(0, 0, 0, 0.15)",
      backdropFilter: "blur(10px)",
    },
    toastSuccess: {
      background: "rgba(16, 185, 129, 0.1)",
      color: "#059669",
      border: "1px solid rgba(16, 185, 129, 0.3)",
    },
    toastError: {
      background: "rgba(239, 68, 68, 0.1)",
      color: "#dc2626",
      border: "1px solid rgba(239, 68, 68, 0.3)",
    },
    confirmationDialog: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.7)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    },
    confirmationContent: {
      background: "rgba(255, 255, 255, 0.95)",
      padding: "3rem",
      borderRadius: "20px",
      border: "1px solid rgba(107, 114, 128, 0.2)",
      maxWidth: "500px",
      width: "90%",
      boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)",
      backdropFilter: "blur(10px)",
    },
    confirmationTitle: {
      fontSize: "1.5rem",
      fontWeight: "600",
      color: "#374151",
      marginBottom: "1.5rem",
      textAlign: "center",
    },
    confirmationText: {
      fontSize: "1.1rem",
      color: "#6b7280",
      marginBottom: "2rem",
      textAlign: "center",
      lineHeight: "1.6",
    },
    confirmationButtons: {
      display: "flex",
      gap: "1rem",
      justifyContent: "center",
    },
    confirmButton: {
      padding: "1rem 2rem",
      fontSize: "1.1rem",
      fontWeight: "600",
      background: "#374151",
      color: "#ffffff",
      border: "none",
      borderRadius: "15px",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(55, 65, 81, 0.2)",
      transition: "all 0.3s ease",
    },
    cancelButton: {
      padding: "1rem 2rem",
      fontSize: "1.1rem",
      fontWeight: "600",
      background: "rgba(255, 255, 255, 0.9)",
      color: "#6b7280",
      border: "1px solid rgba(102, 126, 234, 0.3)",
      borderRadius: "15px",
      cursor: "pointer",
      transition: "all 0.3s ease",
    },
    summaryContent: {
      padding: "1.5rem",
      fontSize: "1.4rem",
      lineHeight: "1.8",
      color: "#374151",
      border: "1px solid rgba(107, 114, 128, 0.2)",
      borderRadius: "20px",
      background: "rgba(255, 255, 255, 0.9)",
      height: "100%",
      overflowY: "auto",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
      flex: 1,
    },
    quizContent: {
      padding: "1.5rem",
      height: "100%",
      overflowY: "auto",
      flex: 1,
    },
    quizQuestion: {
      marginBottom: "2rem",
      padding: "2rem",
      border: "1px solid rgba(107, 114, 128, 0.2)",
      borderRadius: "20px",
      background: "rgba(255, 255, 255, 0.9)",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
    },
    questionText: {
      fontSize: "1.5rem",
      fontWeight: "600",
      color: "#374151",
      marginBottom: "1.5rem",
      lineHeight: "1.5",
    },
    quizOption: {
      display: "block",
      width: "100%",
      padding: "1.2rem",
      fontSize: "1.3rem",
      background: "rgba(255, 255, 255, 0.8)",
      color: "#374151",
      border: "1px solid rgba(156, 163, 175, 0.3)",
      borderRadius: "12px",
      cursor: "pointer",
      marginBottom: "1rem",
      textAlign: "left",
      transition: "all 0.3s ease",
      boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
    },
    selectedOption: {
      background: "#374151",
      color: "#ffffff",
      boxShadow: "0 2px 8px rgba(55, 65, 81, 0.2)",
    },
    submitButton: {
      padding: "1.5rem 3rem",
      fontSize: "1.2rem",
      fontWeight: "600",
      background: "#3b82f6",
      color: "#ffffff",
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      marginTop: "2rem",
      boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
      transition: "all 0.3s ease",
    },
    scoreDisplay: {
      textAlign: "center",
      padding: "3rem",
      border: "1px solid rgba(107, 114, 128, 0.2)",
      borderRadius: "20px",
      background: "rgba(255, 255, 255, 0.9)",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
    },
    scoreText: {
      fontSize: "2.5rem",
      fontWeight: "700",
      color: "#374151",
      marginBottom: "1rem",
    },
    scoreSubtext: {
      fontSize: "1.3rem",
      color: "#6b7280",
    },
    recommendationsContent: {
      padding: "1.5rem",
      height: "100%",
      overflowY: "auto",
      flex: 1,
    },
    recommendationsTitle: {
      fontSize: "1.8rem",
      fontWeight: "700",
      color: "#374151",
      marginBottom: "2rem",
      textAlign: "center",
    },
    videoRecommendation: {
      display: "flex",
      padding: "1.5rem",
      marginBottom: "1.5rem",
      border: "1px solid rgba(107, 114, 128, 0.2)",
      borderRadius: "15px",
      background: "rgba(255, 255, 255, 0.9)",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
      transition: "all 0.3s ease",
    },
    videoThumbnail: {
      width: "200px",
      height: "120px",
      objectFit: "cover",
      borderRadius: "10px",
      marginRight: "1.5rem",
    },
    videoInfo: {
      flex: 1,
    },
    videoTitle: {
      fontSize: "1.4rem",
      fontWeight: "600",
      color: "#374151",
      marginBottom: "0.5rem",
      lineHeight: "1.3",
    },
    videoDescription: {
      fontSize: "1.1rem",
      color: "#6b7280",
      marginBottom: "0.5rem",
      lineHeight: "1.5",
    },
    videoReason: {
      fontSize: "1rem",
      color: "#9ca3af",
      marginBottom: "1rem",
      fontStyle: "italic",
    },
    videoMeta: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    videoDuration: {
      fontSize: "1rem",
      color: "#6b7280",
      fontWeight: "500",
    },
    videoLink: {
      fontSize: "1rem",
      color: "#3b82f6",
      textDecoration: "none",
      fontWeight: "600",
      padding: "0.5rem 1rem",
      border: "1px solid #3b82f6",
      borderRadius: "8px",
      transition: "all 0.3s ease",
    },
    quizHistoryToggle: {
      marginBottom: "2rem",
      display: "flex",
      justifyContent: "center",
    },
    quizHistoryContainer: {
      padding: "1rem",
    },
    quizHistoryTitle: {
      fontSize: "1.8rem",
      fontWeight: "700",
      color: "#374151",
      marginBottom: "2rem",
      textAlign: "center",
    },
    quizHistoryItem: {
      padding: "1.5rem",
      marginBottom: "1rem",
      border: "1px solid rgba(107, 114, 128, 0.2)",
      borderRadius: "15px",
      background: "rgba(255, 255, 255, 0.9)",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
      transition: "all 0.3s ease",
    },
    quizHistoryHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "0.5rem",
    },
    quizHistoryScore: {
      fontSize: "1.2rem",
      fontWeight: "600",
      color: "#374151",
    },
    quizHistoryPercentage: {
      fontSize: "1.1rem",
      fontWeight: "700",
      color: "#3b82f6",
    },
    quizHistoryDate: {
      fontSize: "1rem",
      color: "#6b7280",
      marginBottom: "1rem",
    },
    quizHistoryProgress: {
      width: "100%",
      height: "8px",
      backgroundColor: "rgba(107, 114, 128, 0.2)",
      borderRadius: "4px",
      overflow: "hidden",
    },
    quizHistoryProgressBar: {
      height: "100%",
      backgroundColor: "#3b82f6",
      borderRadius: "4px",
      transition: "width 0.3s ease",
    },
    newQuizButton: {
      padding: "1rem 2rem",
      fontSize: "1.1rem",
      fontWeight: "600",
      background: "#10b981",
      color: "#ffffff",
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      marginTop: "1.5rem",
      boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
      transition: "all 0.3s ease",
    },
    quizOptionsContainer: {
      marginBottom: "2rem",
      padding: "1.5rem",
      border: "1px solid rgba(107, 114, 128, 0.2)",
      borderRadius: "15px",
      background: "rgba(255, 255, 255, 0.9)",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
    },
    quizOptionsTitle: {
      fontSize: "1.4rem",
      fontWeight: "600",
      color: "#374151",
      marginBottom: "1rem",
      textAlign: "center",
    },
    quizOptionsButtons: {
      display: "flex",
      gap: "1rem",
      justifyContent: "center",
    },
    quizOptionButton: {
      padding: "1rem 2rem",
      fontSize: "1.1rem",
      fontWeight: "600",
      background: "rgba(255, 255, 255, 0.8)",
      color: "#6b7280",
      border: "2px solid rgba(107, 114, 128, 0.3)",
      borderRadius: "12px",
      cursor: "pointer",
      transition: "all 0.3s ease",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
    },
    activeQuizOptionButton: {
      background: "#3b82f6",
      color: "#ffffff",
      border: "2px solid #3b82f6",
      boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
    },
    disabledQuizOptionButton: {
      background: "#f3f4f6",
      color: "#9ca3af",
      border: "2px solid #e5e7eb",
      cursor: "not-allowed",
      opacity: 0.6,
    },
    createQuizButton: {
      padding: "1.2rem 2.5rem",
      fontSize: "1.2rem",
      fontWeight: "600",
      background: "#3b82f6",
      color: "#ffffff",
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      marginTop: "1.5rem",
      boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
      transition: "all 0.3s ease",
    },
  };

  return (
    <>
      <Navigationinner title="Doubt Clearance" />
      <div style={styles.container}>
        <div style={styles.mainContent}>
          {/* Main Content Area */}
          <div style={styles.contentArea}>
            {selectedDoubt ? (
              <>
                {/* Tabs */}
                <div style={styles.tabs}>
                  <button
                    style={{
                      ...styles.tabButton,
                      ...(activeTab === 'chat' ? styles.activeTabButton : {})
                    }}
                    onClick={() => setActiveTab('chat')}
                  >
                    💬 Chat
                  </button>
                  <button
                    style={{
                      ...styles.tabButton,
                      ...(activeTab === 'summary' ? styles.activeTabButton : {})
                    }}
                    onClick={handleSummarize}
                    disabled={isSummarizing}
                  >
                    {isSummarizing ? '⏳ Summarizing...' : '📝 Summarize'}
                  </button>
                  <button
                    style={{
                      ...styles.tabButton,
                      ...(activeTab === 'quiz' ? styles.activeTabButton : {}),
                      ...(selectedDoubt && selectedDoubt.chatHistory && selectedDoubt.chatHistory.length < 4 ? styles.disabledTabButton : {})
                    }}
                    onClick={() => {
                      if (selectedDoubt && selectedDoubt.chatHistory && selectedDoubt.chatHistory.length >= 4) {
                        setActiveTab('quiz');
                      } else {
                        showToast('Please have at least 4 conversations before generating a quiz', 'error');
                      }
                    }}
                    disabled={isGeneratingQuiz || (selectedDoubt && selectedDoubt.chatHistory && selectedDoubt.chatHistory.length < 4)}
                  >
                    {isGeneratingQuiz ? '⏳ Generating...' : '🧠 Quiz'}
                    {selectedDoubt && selectedDoubt.chatHistory && selectedDoubt.chatHistory.length < 4 && (
                      <span style={styles.requirementText}> (4+ chats)</span>
                    )}
                  </button>
                  <button
                    style={{
                      ...styles.tabButton,
                      ...(activeTab === 'recommendations' ? styles.activeTabButton : {}),
                      ...(selectedDoubt && selectedDoubt.chatHistory && selectedDoubt.chatHistory.length < 4 ? styles.disabledTabButton : {})
                    }}
                    onClick={() => {
                      if (selectedDoubt && selectedDoubt.chatHistory && selectedDoubt.chatHistory.length >= 4) {
                        handleGetRecommendations();
                      } else {
                        showToast('Please have at least 4 conversations before getting video recommendations', 'error');
                      }
                    }}
                    disabled={isGettingRecommendations || (selectedDoubt && selectedDoubt.chatHistory && selectedDoubt.chatHistory.length < 4)}
                  >
                    {isGettingRecommendations ? '⏳ Loading...' : '📺 Videos'}
                    {selectedDoubt && selectedDoubt.chatHistory && selectedDoubt.chatHistory.length < 4 && (
                      <span style={styles.requirementText}> (4+ chats)</span>
                    )}
                  </button>
                </div>

                {/* Content based on active tab */}
                {activeTab === 'chat' && (
                  <div style={styles.chatContainer}>
                    <div style={styles.messagesContainer}>
                      {chatMessages.length === 0 ? (
                        <div style={styles.emptyState}>
                          <div style={styles.emptyStateTitle}>Start a conversation</div>
                          <div style={styles.emptyStateText}>
                            Ask questions about your doubt to get started!
                          </div>
                        </div>
                      ) : (
                        chatMessages.map((message, index) => (
                          <div
                            key={index}
                            style={{
                              ...styles.message,
                              ...(message.role === 'user' ? styles.userMessage : styles.botMessage)
                            }}
                            dangerouslySetInnerHTML={{
                              __html: renderMarkdown(message.content)
                            }}
                          />
                        ))
                      )}
                      {isLoading && (
                        <div style={styles.loadingSpinner}>
                          <div>🤖 AI is thinking...</div>
                        </div>
                      )}
                    </div>
                    
                    <div style={styles.chatInputContainer}>
                      <textarea
                        style={styles.messageInput}
                        value={newMessage}
                        onChange={(e) => {
                          setNewMessage(e.target.value);
                          autoResizeTextarea(e.target);
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder="Ask a question about your doubt..."
                        disabled={isLoading}
                      />
                      <button
                        style={styles.sendButton}
                        onClick={handleSendMessage}
                        disabled={isLoading || !newMessage.trim()}
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}

                {/* Summary Tab */}
                {activeTab === 'summary' && (
                  <div style={styles.summaryContent}>
                    {summary ? (
                      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(summary) }} />
                    ) : (
                      <div style={styles.emptyState}>
                        <div style={styles.emptyStateTitle}>No Solutions yet</div>
                        <div style={styles.emptyStateText}>
                          Click the "Solution" button to generate a summary of this doubt discussion.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Quiz Tab */}
                {activeTab === 'quiz' && (
                  <div style={styles.quizContent}>
                    {/* Quiz Options */}
                    <div style={styles.quizOptionsContainer}>
                      <h3 style={styles.quizOptionsTitle}>Quiz Options</h3>
                      <div style={styles.quizOptionsButtons}>
                        <button
                          style={{
                            ...styles.quizOptionButton,
                            ...(showQuizHistory ? styles.activeQuizOptionButton : {})
                          }}
                          onClick={() => setShowQuizHistory(true)}
                        >
                          📊 Quiz History
                        </button>
                        <button
                          style={{
                            ...styles.quizOptionButton,
                            ...(!showQuizHistory ? styles.activeQuizOptionButton : {}),
                            ...(selectedDoubt && selectedDoubt.chatHistory && selectedDoubt.chatHistory.length < 4 ? styles.disabledQuizOptionButton : {})
                          }}
                          onClick={() => {
                            if (selectedDoubt && selectedDoubt.chatHistory && selectedDoubt.chatHistory.length >= 4) {
                              setShowQuizHistory(false);
                            } else {
                              showToast('Please have at least 4 conversations before creating a quiz', 'error');
                            }
                          }}
                          disabled={selectedDoubt && selectedDoubt.chatHistory && selectedDoubt.chatHistory.length < 4}
                        >
                          📝 {currentQuiz ? 'Current Quiz' : 'Create New Quiz'}
                          {selectedDoubt && selectedDoubt.chatHistory && selectedDoubt.chatHistory.length < 4 && (
                            <span style={styles.requirementText}> (4+ chats)</span>
                          )}
                        </button>
                      </div>
                    </div>

                    {showQuizHistory ? (
                      /* Quiz History */
                      <div style={styles.quizHistoryContainer}>
                        <h3 style={styles.quizHistoryTitle}>Quiz History</h3>
                        {quizHistory.length === 0 ? (
                          <div style={styles.emptyState}>
                            <div style={styles.emptyStateTitle}>No quiz history yet</div>
                            <div style={styles.emptyStateText}>
                              Complete some quizzes to see your history here.
                            </div>
                          </div>
                        ) : (
                          quizHistory.map((quiz, index) => (
                            <div key={index} style={styles.quizHistoryItem}>
                              <div style={styles.quizHistoryHeader}>
                                <div style={styles.quizHistoryScore}>
                                  Quiz #{index + 1}: {quiz.score || 0}/{quiz.totalQuestions || 0}
                                </div>
                                <div style={styles.quizHistoryPercentage}>
                                  {quiz.totalQuestions ? ((quiz.score || 0) / quiz.totalQuestions * 100).toFixed(1) : 0}%
                                </div>
                              </div>
                              <div style={styles.quizHistoryDate}>
                                {new Date(quiz.completedAt).toLocaleDateString()} at {new Date(quiz.completedAt).toLocaleTimeString()}
                              </div>
                              <div style={styles.quizHistoryProgress}>
                                <div 
                                  style={{
                                    ...styles.quizHistoryProgressBar,
                                    width: `${quiz.totalQuestions ? ((quiz.score || 0) / quiz.totalQuestions * 100) : 0}%`
                                  }}
                                />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    ) : (
                      /* Current Quiz */
                      <>
                        {quizScore ? (
                          <div style={styles.scoreDisplay}>
                            <div style={styles.scoreText}>
                              Score: {quizScore.score}/{quizScore.totalQuestions}
                            </div>
                            <div style={styles.scoreSubtext}>
                              {((quizScore.score / quizScore.totalQuestions) * 100).toFixed(1)}% Correct
                            </div>
                            <button
                              style={styles.newQuizButton}
                              onClick={() => {
                                setQuizScore(null);
                                setCurrentQuiz(null);
                                setQuizAnswers({});
                              }}
                            >
                              Take Another Quiz
                            </button>
                          </div>
                        ) : currentQuiz ? (
                          <>
                            {currentQuiz.map((question, qIndex) => (
                              <div key={qIndex} style={styles.quizQuestion}>
                                <div style={styles.questionText}>
                                  {qIndex + 1}. {question.question}
                                </div>
                                {question.options.map((option, oIndex) => (
                                  <button
                                    key={oIndex}
                                    style={{
                                      ...styles.quizOption,
                                      ...(quizAnswers[qIndex] === oIndex ? styles.selectedOption : {})
                                    }}
                                    onClick={() => {
                                      setQuizAnswers(prev => ({
                                        ...prev,
                                        [qIndex]: oIndex
                                      }));
                                    }}
                                  >
                                    {String.fromCharCode(65 + oIndex)}. {option}
                                  </button>
                                ))}
                              </div>
                            ))}
                            <button
                              style={styles.submitButton}
                              onClick={handleSubmitQuiz}
                              disabled={Object.keys(quizAnswers).length !== currentQuiz.length}
                            >
                              Submit Quiz
                            </button>
                          </>
                        ) : (
                          <div style={styles.emptyState}>
                            <div style={styles.emptyStateTitle}>No quiz yet</div>
                            <div style={styles.emptyStateText}>
                              Generate a quiz based on your doubt discussion to test your understanding.
                            </div>
                            <button
                              style={styles.createQuizButton}
                              onClick={handleGenerateQuiz}
                              disabled={isGeneratingQuiz}
                            >
                              {isGeneratingQuiz ? '⏳ Generating Quiz...' : '🧠 Create New Quiz'}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* YouTube Recommendations Tab */}
                {activeTab === 'recommendations' && (
                  <div style={styles.recommendationsContent}>
                    {youtubeRecommendations.length > 0 ? (
                      <div>
                        <h3 style={styles.recommendationsTitle}>Recommended Videos</h3>
                        {youtubeRecommendations.map((video, index) => (
                          <div key={index} style={styles.videoRecommendation}>
                            <img 
                              src={video.thumbnail} 
                              alt={video.title}
                              style={styles.videoThumbnail}
                            />
                            <div style={styles.videoInfo}>
                              <h4 style={styles.videoTitle}>{video.title}</h4>
                              <p style={styles.videoDescription}>{video.description}</p>
                              <p style={styles.videoReason}>{video.reason}</p>
                              <div style={styles.videoMeta}>
                                <span style={styles.videoDuration}>{video.duration}</span>
                                <a 
                                  href={video.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  style={styles.videoLink}
                                >
                                  Watch on YouTube
                                </a>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={styles.emptyState}>
                        <div style={styles.emptyStateTitle}>No videos found</div>
                        <div style={styles.emptyStateText}>
                          No relevant YouTube videos found for your doubt. Try having more conversations about your doubt to get better recommendations, or click the "Videos" button to search again.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div style={styles.emptyState}>
                <div style={styles.emptyStateTitle}>No doubt selected</div>
                <div style={styles.emptyStateText}>
                  Add a doubt using the sidebar to get started!
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={styles.sidebar}>
            <h2 style={styles.sidebarTitle}>Your Doubts</h2>
            
            <button
              style={styles.addButton}
              onClick={() => setShowAddDoubtForm(!showAddDoubtForm)}
              disabled={isAddingDoubt}
            >
              {showAddDoubtForm ? '✕ Cancel' : '+ Add Doubt'}
            </button>

            {showAddDoubtForm && (
              <form style={styles.addDoubtForm} onSubmit={handleAddDoubt}>
                <div style={styles.formTitle}>Add New Doubt</div>
                
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Doubt Title</label>
                  <input
                    style={styles.input}
                    type="text"
                    value={newDoubt.title}
                    onChange={(e) => setNewDoubt(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter doubt title"
                    disabled={isAddingDoubt}
                    required
                  />
                </div>
                
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Description</label>
                  <textarea
                    style={styles.input}
                    value={newDoubt.description}
                    onChange={(e) => setNewDoubt(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your doubt in detail..."
                    disabled={isAddingDoubt}
                    required
                    rows="4"
                  />
                </div>
                
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Image URL (Optional)</label>
                  <input
                    style={styles.input}
                    type="url"
                    value={newDoubt.imageUrl}
                    onChange={(e) => setNewDoubt(prev => ({ ...prev, imageUrl: e.target.value }))}
                    placeholder="https://example.com/image.jpg"
                    disabled={isAddingDoubt}
                  />
                </div>
                
                <button 
                  type="submit" 
                  style={{
                    ...styles.button,
                    ...(isAddingDoubt ? styles.disabledButton : {})
                  }}
                  disabled={isAddingDoubt}
                >
                  {isAddingDoubt ? '⏳ Adding Doubt...' : 'Add Doubt'}
                </button>
              </form>
            )}

            {doubts.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyStateTitle}>No doubts yet</div>
                <div style={styles.emptyStateText}>
                  Add your first doubt to get started!
                </div>
              </div>
            ) : (
              doubts.map((doubt) => (
                <div
                  key={doubt._id}
                  style={{
                    ...styles.doubtItem,
                    ...(selectedDoubt && selectedDoubt._id === doubt._id ? styles.selectedDoubtItem : {})
                  }}
                  onClick={() => setSelectedDoubt(doubt)}
                >
                  <button
                    style={styles.deleteButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDoubt(doubt._id, doubt.title);
                    }}
                    title="Delete doubt"
                  >
                    🗑️
                  </button>
                  <div style={styles.doubtTitle}>{doubt.title}</div>
                  <div style={styles.doubtDescription}>{doubt.description}</div>
                  <div style={styles.doubtDate}>
                    Added {new Date(doubt.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Toast Notification */}
        {toast && (
          <div style={{
            ...styles.toast,
            ...(toast.type === 'success' ? styles.toastSuccess : styles.toastError)
          }}>
            {toast.message}
          </div>
        )}

      </div>
    </>
  );
};

export default DoubtClearance;
