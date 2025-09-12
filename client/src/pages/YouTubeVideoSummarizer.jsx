import React, { useState, useEffect } from 'react';
import axios from 'axios';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;

const YouTubeVideoSummarizer = () => {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [summary, setSummary] = useState('');
  const [quiz, setQuiz] = useState(null);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [currentQuizId, setCurrentQuizId] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizScore, setQuizScore] = useState(null);
  const [quizHistory, setQuizHistory] = useState([]);
  const [showAddVideoForm, setShowAddVideoForm] = useState(false);
  const [toast, setToast] = useState(null);
  const [showQuizConfirm, setShowQuizConfirm] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('videos');
  const [newVideo, setNewVideo] = useState({ title: '', videoUrl: '' });

  // Toast notification function
  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load user's YouTube videos
  const loadUserVideos = async () => {
    try {
      const userId = localStorage.getItem('userId') || 'demo-user';
      const response = await axios.get(`${apiUrl}/youtube-videos/${userId}`);
      const videosData = Array.isArray(response.data) ? response.data : [];
      setVideos(videosData);
      
      // If we have videos and no selected video, select the first one
      if (videosData.length > 0 && !selectedVideo) {
        setSelectedVideo(videosData[0]);
        loadVideoData(videosData[0]);
      }
    } catch (error) {
      console.error('Error loading videos:', error);
      setVideos([]);
    }
  };

  // Load video data (chat history, summary, quizzes)
  const loadVideoData = (video) => {
    if (!video) return;
    
    setChatMessages(video.chatHistory || []);
    setSummary(video.summary || '');
    setQuizHistory(video.quizzes || []);
  };

  // Add new video
  const handleAddVideo = async (e) => {
    e.preventDefault();
    
    if (!newVideo.title.trim() || !newVideo.videoUrl.trim()) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    // Basic YouTube URL validation
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;
    if (!youtubeRegex.test(newVideo.videoUrl)) {
      showToast('Please enter a valid YouTube URL', 'error');
      return;
    }

    // Check for duplicate titles
    const duplicateTitle = videos.find(video => 
      video.title.toLowerCase() === newVideo.title.toLowerCase()
    );
    if (duplicateTitle) {
      showToast('A video with this title already exists', 'error');
      return;
    }

    try {
      const userId = localStorage.getItem('userId') || 'demo-user';
      const response = await axios.post(`${apiUrl}/youtube-videos`, {
        title: newVideo.title,
        videoUrl: newVideo.videoUrl,
        userId
      });
      
      setNewVideo({ title: '', videoUrl: '' });
      setShowAddVideoForm(false);
      await loadUserVideos();
      showToast('Video added successfully!', 'success');
    } catch (error) {
      console.error('Error adding video:', error);
      showToast(error.response?.data?.error || 'Error adding video', 'error');
    }
  };

  // Send chat message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedVideo) return;

    const userMessage = newMessage.trim();
    setNewMessage('');
    setIsLoading(true);

    // Add user message immediately to UI
    const tempUserMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, tempUserMessage]);

    try {
      const response = await axios.post(`${apiUrl}/chat-with-youtube-video`, {
        videoId: selectedVideo._id,
        message: userMessage,
        userId: localStorage.getItem('userId') || 'demo-user'
      });

      // Add AI response immediately to UI
      const aiResponse = {
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, aiResponse]);

      // Reload videos to get updated chat history from database
      await loadUserVideos();
      
      // Update selectedVideo with the latest data
      const updatedVideos = await axios.get(`${apiUrl}/youtube-videos/${localStorage.getItem('userId') || 'demo-user'}`);
      const updatedVideo = updatedVideos.data.find(v => v._id === selectedVideo._id);
      if (updatedVideo) {
        setSelectedVideo(updatedVideo);
        setChatMessages(updatedVideo.chatHistory || []);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Error sending message', 'error');
      // Remove the temporary user message on error
      setChatMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  // Summarize video
  const handleSummarize = async () => {
    if (!selectedVideo) return;

    // If summary already exists, just show it
    if (selectedVideo.summary) {
      setSummary(selectedVideo.summary);
      setActiveTab('summary');
      return;
    }

    setIsSummarizing(true);
    try {
      const response = await axios.post(`${apiUrl}/summarize-youtube-video`, {
        videoId: selectedVideo._id,
        userId: localStorage.getItem('userId') || 'demo-user'
      });

      setSummary(response.data.summary);
      setActiveTab('summary');
      await loadUserVideos();
    } catch (error) {
      console.error('Error summarizing video:', error);
      showToast('Error generating summary', 'error');
    } finally {
      setIsSummarizing(false);
    }
  };

  // Generate quiz
  const handleGenerateQuiz = () => {
    if (!selectedVideo) return;
    setShowQuizConfirm(true);
  };

  // Confirm quiz generation
  const confirmGenerateQuiz = async () => {
    setShowQuizConfirm(false);
    setIsGeneratingQuiz(true);
    
    try {
      const response = await axios.post(`${apiUrl}/generate-youtube-quiz`, {
        videoId: selectedVideo._id,
        userId: localStorage.getItem('userId') || 'demo-user'
      });

      const newQuiz = response.data.quiz;
      setQuiz(newQuiz);
      setCurrentQuiz(newQuiz);
      setCurrentQuizId(selectedVideo.quizzes ? selectedVideo.quizzes.length : 0);
      setQuizAnswers({});
      setQuizScore(null);
      setActiveTab('quiz');
      await loadUserVideos();
    } catch (error) {
      console.error('Error generating quiz:', error);
      showToast('Error generating quiz', 'error');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  // Submit quiz
  const handleSubmitQuiz = async () => {
    if (!currentQuiz || !selectedVideo) return;

    let score = 0;
    const totalQuestions = currentQuiz.length;

    currentQuiz.forEach((question, index) => {
      if (quizAnswers[index] === question.correctAnswer) {
        score++;
      }
    });

    setQuizScore({ score, totalQuestions });

    // Save quiz results
    try {
      await axios.post(`${apiUrl}/save-youtube-quiz-results`, {
        videoId: selectedVideo._id,
        quizIndex: currentQuizId,
        score,
        userId: localStorage.getItem('userId') || 'demo-user'
      });
      await loadUserVideos();
    } catch (error) {
      console.error('Error saving quiz results:', error);
    }
  };

  // Delete video
  const handleDeleteVideo = async (videoId, videoTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${videoTitle}"?`)) {
      return;
    }

    try {
      await axios.delete(`${apiUrl}/youtube-videos/${videoId}`, {
        data: { userId: localStorage.getItem('userId') || 'demo-user' }
      });
      await loadUserVideos();
      
      if (selectedVideo && selectedVideo._id === videoId) {
        setSelectedVideo(null);
        setChatMessages([]);
        setSummary('');
        setQuiz(null);
        setCurrentQuiz(null);
        setQuizHistory([]);
      }
      showToast('Video deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting video:', error);
      showToast('Error deleting video', 'error');
    }
  };

  // Auto-resize textarea
  const autoResizeTextarea = (textarea) => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  // Render markdown-like content
  const renderMarkdown = (text) => {
    if (!text) return '';
    
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  };

  useEffect(() => {
    loadUserVideos();
  }, []);

  useEffect(() => {
    if (selectedVideo) {
      loadVideoData(selectedVideo);
    }
  }, [selectedVideo]);

  const styles = {
    container: {
      minHeight: "100vh",
      background: "#ffffff",
      padding: "3rem",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    },
    header: {
      textAlign: "center",
      marginBottom: "3rem",
    },
    title: {
      fontSize: "3.5rem",
      fontWeight: "700",
      color: "#000000",
      marginBottom: "1rem",
      background: "none",
      WebkitBackgroundClip: "unset",
      WebkitTextFillColor: "unset",
    },
    subtitle: {
      fontSize: "1.3rem",
      color: "#4a4a4a",
      maxWidth: "700px",
      margin: "0 auto",
    },
    mainContent: {
      display: "flex",
      gap: "3rem",
      maxWidth: "1600px",
      margin: "0 auto",
    },
    contentArea: {
      flex: 1,
      order: 1,
      background: "#ffffff",
      borderRadius: "12px",
      padding: "3rem",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
      backdropFilter: "none",
      border: "2px solid #000000",
      minHeight: "calc(100vh - 250px)",
    },
    sidebar: {
      width: "500px",
      order: 2,
      background: "#ffffff",
      borderRadius: "12px",
      padding: "3rem",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
      backdropFilter: "none",
      border: "2px solid #000000",
      minHeight: "calc(100vh - 250px)",
    },
    sidebarTitle: {
      fontSize: "1.8rem",
      fontWeight: "600",
      color: "#000000",
      marginBottom: "2rem",
      textAlign: "center",
    },
    tabs: {
      display: "flex",
      marginBottom: "3rem",
      borderBottom: "2px solid #000000",
      gap: "0.5rem",
    },
    tabButton: {
      padding: "1rem 2rem",
      fontSize: "1.1rem",
      fontWeight: "500",
      background: "#ffffff",
      color: "#000000",
      border: "2px solid #000000",
      borderBottom: "none",
      borderRadius: "8px 8px 0 0",
      cursor: "pointer",
      transition: "all 0.2s ease",
    },
    activeTabButton: {
      background: "#000000",
      color: "#ffffff",
    },
    sidebarTabs: {
      display: "flex",
      marginBottom: "2rem",
      gap: "0.5rem",
    },
    sidebarTab: {
      flex: 1,
      padding: "1rem",
      fontSize: "1rem",
      fontWeight: "500",
      background: "#ffffff",
      color: "#000000",
      border: "2px solid #000000",
      borderRadius: "8px",
      cursor: "pointer",
      textAlign: "center",
      transition: "all 0.2s ease",
    },
    activeSidebarTab: {
      background: "#000000",
      color: "#ffffff",
    },
    addButton: {
      width: "100%",
      padding: "1.2rem",
      fontSize: "1.1rem",
      fontWeight: "600",
      background: "#000000",
      color: "#ffffff",
      border: "2px solid #000000",
      borderRadius: "8px",
      cursor: "pointer",
      marginBottom: "2rem",
      transition: "all 0.2s ease",
    },
    chatContainer: {
      display: "flex",
      flexDirection: "column",
      height: "calc(100vh - 400px)",
      gap: "1.5rem",
    },
    messagesContainer: {
      flex: 1,
      overflowY: "auto",
      padding: "1.5rem",
      border: "2px solid #000000",
      borderRadius: "8px",
      background: "#ffffff",
    },
    message: {
      padding: "1.5rem",
      marginBottom: "1.5rem",
      borderRadius: "12px",
      fontSize: "1.1rem",
      lineHeight: "1.6",
    },
    userMessage: {
      background: "#000000",
      color: "#ffffff",
      marginLeft: "20%",
    },
    botMessage: {
      background: "#ffffff",
      color: "#000000",
      border: "2px solid #000000",
      marginRight: "20%",
    },
    chatInputContainer: {
      display: "flex",
      gap: "1rem",
      alignItems: "flex-end",
    },
    messageInput: {
      flex: 1,
      padding: "1.2rem",
      fontSize: "1.1rem",
      border: "2px solid #000000",
      borderRadius: "8px",
      background: "#ffffff",
      color: "#000000",
      resize: "none",
      minHeight: "60px",
      maxHeight: "150px",
    },
    sendButton: {
      padding: "1.2rem 2rem",
      fontSize: "1.1rem",
      fontWeight: "600",
      background: "#000000",
      color: "#ffffff",
      border: "2px solid #000000",
      borderRadius: "8px",
      cursor: "pointer",
      transition: "all 0.2s ease",
    },
    summaryContent: {
      padding: "2rem",
      fontSize: "1.2rem",
      lineHeight: "1.8",
      color: "#000000",
      border: "2px solid #000000",
      borderRadius: "8px",
      background: "#ffffff",
      minHeight: "400px",
    },
    quizContent: {
      padding: "2rem",
    },
    quizQuestion: {
      marginBottom: "3rem",
      padding: "2rem",
      border: "2px solid #000000",
      borderRadius: "8px",
      background: "#ffffff",
    },
    questionText: {
      fontSize: "1.3rem",
      fontWeight: "600",
      color: "#000000",
      marginBottom: "1.5rem",
      lineHeight: "1.5",
    },
    quizOption: {
      display: "block",
      width: "100%",
      padding: "1.2rem",
      fontSize: "1.1rem",
      background: "#ffffff",
      color: "#000000",
      border: "2px solid #000000",
      borderRadius: "8px",
      cursor: "pointer",
      marginBottom: "1rem",
      textAlign: "left",
      transition: "all 0.2s ease",
    },
    selectedOption: {
      background: "#000000",
      color: "#ffffff",
    },
    submitButton: {
      padding: "1.5rem 3rem",
      fontSize: "1.2rem",
      fontWeight: "600",
      background: "#000000",
      color: "#ffffff",
      border: "2px solid #000000",
      borderRadius: "8px",
      cursor: "pointer",
      marginTop: "2rem",
    },
    videoItem: {
      padding: "2rem",
      marginBottom: "1.5rem",
      border: "2px solid #000000",
      borderRadius: "8px",
      background: "#ffffff",
      cursor: "pointer",
      position: "relative",
      transition: "all 0.2s ease",
    },
    selectedVideoItem: {
      background: "#000000",
      color: "#ffffff",
    },
    videoTitle: {
      fontSize: "1.2rem",
      fontWeight: "600",
      marginBottom: "0.5rem",
    },
    videoUrl: {
      fontSize: "1rem",
      color: "#666666",
      marginBottom: "0.5rem",
      wordBreak: "break-all",
    },
    videoDate: {
      fontSize: "0.95rem",
      color: "#888888",
    },
    deleteButton: {
      position: "absolute",
      top: "1rem",
      right: "1rem",
      width: "40px",
      height: "40px",
      background: "#ffffff",
      border: "2px solid #000000",
      borderRadius: "50%",
      cursor: "pointer",
      fontSize: "1.2rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    addVideoForm: {
      padding: "2rem",
      marginBottom: "2rem",
      border: "2px solid #000000",
      borderRadius: "8px",
      background: "#ffffff",
    },
    formTitle: {
      fontSize: "1.4rem",
      fontWeight: "600",
      color: "#000000",
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
      color: "#000000",
      marginBottom: "0.8rem",
    },
    input: {
      width: "100%",
      padding: "1.2rem",
      fontSize: "1.1rem",
      border: "2px solid #000000",
      borderRadius: "8px",
      background: "#ffffff",
      color: "#000000",
    },
    button: {
      width: "100%",
      padding: "1.2rem",
      fontSize: "1.1rem",
      fontWeight: "600",
      background: "#000000",
      color: "#ffffff",
      border: "2px solid #000000",
      borderRadius: "8px",
      cursor: "pointer",
    },
    emptyState: {
      textAlign: "center",
      padding: "4rem 2rem",
      color: "#666666",
    },
    emptyStateTitle: {
      fontSize: "1.5rem",
      fontWeight: "600",
      color: "#000000",
      marginBottom: "1rem",
    },
    emptyStateText: {
      fontSize: "1.1rem",
      color: "#666666",
      lineHeight: "1.6",
    },
    loadingSpinner: {
      textAlign: "center",
      padding: "2rem",
      fontSize: "1.2rem",
      color: "#666666",
    },
    scoreDisplay: {
      textAlign: "center",
      padding: "3rem",
      border: "2px solid #000000",
      borderRadius: "8px",
      background: "#ffffff",
    },
    scoreText: {
      fontSize: "2.5rem",
      fontWeight: "700",
      color: "#000000",
      marginBottom: "1rem",
    },
    scoreSubtext: {
      fontSize: "1.3rem",
      color: "#666666",
    },
    quizHistoryItem: {
      padding: "1.5rem",
      marginBottom: "1rem",
      border: "2px solid #000000",
      borderRadius: "8px",
      background: "#ffffff",
    },
    quizHistoryScore: {
      fontSize: "1.2rem",
      fontWeight: "600",
      color: "#000000",
      marginBottom: "0.5rem",
    },
    quizHistoryDate: {
      fontSize: "1rem",
      color: "#666666",
    },
    toast: {
      position: "fixed",
      top: "2rem",
      right: "2rem",
      padding: "1.5rem 2rem",
      fontSize: "1.1rem",
      borderRadius: "8px",
      border: "2px solid #000000",
      zIndex: 1000,
      fontWeight: "500",
    },
    toastSuccess: {
      background: "#ffffff",
      color: "#000000",
    },
    toastError: {
      background: "#000000",
      color: "#ffffff",
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
      background: "#ffffff",
      padding: "3rem",
      borderRadius: "12px",
      border: "2px solid #000000",
      maxWidth: "500px",
      width: "90%",
    },
    confirmationTitle: {
      fontSize: "1.5rem",
      fontWeight: "600",
      color: "#000000",
      marginBottom: "1.5rem",
      textAlign: "center",
    },
    confirmationText: {
      fontSize: "1.1rem",
      color: "#666666",
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
      background: "#000000",
      color: "#ffffff",
      border: "2px solid #000000",
      borderRadius: "8px",
      cursor: "pointer",
    },
    cancelButton: {
      padding: "1rem 2rem",
      fontSize: "1.1rem",
      fontWeight: "600",
      background: "#ffffff",
      color: "#000000",
      border: "2px solid #000000",
      borderRadius: "8px",
      cursor: "pointer",
    },
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>YouTube Video Summarizer</h1>
        <p style={styles.subtitle}>
          Add YouTube videos and interact with them through chat, summarization, and quizzes
        </p>
      </div>

      <div style={styles.mainContent}>
        {/* Main Content Area */}
        <div style={styles.contentArea}>
          {selectedVideo ? (
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
                    ...(activeTab === 'quiz' ? styles.activeTabButton : {})
                  }}
                  onClick={handleGenerateQuiz}
                  disabled={isGeneratingQuiz}
                >
                  {isGeneratingQuiz ? '⏳ Generating...' : '🧠 Quiz'}
                </button>
              </div>

              {/* Chat Tab */}
              {activeTab === 'chat' && (
                <div style={styles.chatContainer}>
                  <div style={styles.messagesContainer}>
                    {chatMessages.length === 0 ? (
                      <div style={styles.emptyState}>
                        <div style={styles.emptyStateTitle}>Start a conversation</div>
                        <div style={styles.emptyStateText}>
                          Ask questions about this YouTube video to get started!
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
                      placeholder="Ask a question about this video..."
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
                      <div style={styles.emptyStateTitle}>No summary yet</div>
                      <div style={styles.emptyStateText}>
                        Click the "Summarize" button to generate a summary of this video.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quiz Tab */}
              {activeTab === 'quiz' && (
                <div style={styles.quizContent}>
                  {quizScore ? (
                    <div style={styles.scoreDisplay}>
                      <div style={styles.scoreText}>
                        Score: {quizScore.score}/{quizScore.totalQuestions}
                      </div>
                      <div style={styles.scoreSubtext}>
                        {((quizScore.score / quizScore.totalQuestions) * 100).toFixed(1)}% Correct
                      </div>
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
                        Click the "Quiz" button to generate a quiz based on this video.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={styles.emptyState}>
              <div style={styles.emptyStateTitle}>No video selected</div>
              <div style={styles.emptyStateText}>
                Add a YouTube video using the sidebar to get started!
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={styles.sidebar}>
          <h2 style={styles.sidebarTitle}>Your Videos</h2>
          
          {/* Sidebar Tabs */}
          <div style={styles.sidebarTabs}>
            <button
              style={{
                ...styles.sidebarTab,
                ...(sidebarTab === 'videos' ? styles.activeSidebarTab : {})
              }}
              onClick={() => setSidebarTab('videos')}
            >
              Videos
            </button>
            <button
              style={{
                ...styles.sidebarTab,
                ...(sidebarTab === 'quizzes' ? styles.activeSidebarTab : {})
              }}
              onClick={() => setSidebarTab('quizzes')}
            >
              Quizzes
            </button>
          </div>

          {/* Videos Tab */}
          {sidebarTab === 'videos' && (
            <>
              <button
                style={styles.addButton}
                onClick={() => setShowAddVideoForm(!showAddVideoForm)}
              >
                {showAddVideoForm ? '✕ Cancel' : '+ Add Video'}
              </button>

              {showAddVideoForm && (
                <form style={styles.addVideoForm} onSubmit={handleAddVideo}>
                  <div style={styles.formTitle}>Add New Video</div>
                  
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Video Title</label>
                    <input
                      style={styles.input}
                      type="text"
                      value={newVideo.title}
                      onChange={(e) => setNewVideo(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter video title"
                      required
                    />
                  </div>
                  
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>YouTube URL</label>
                    <input
                      style={styles.input}
                      type="url"
                      value={newVideo.videoUrl}
                      onChange={(e) => setNewVideo(prev => ({ ...prev, videoUrl: e.target.value }))}
                      placeholder="https://www.youtube.com/watch?v=..."
                      required
                    />
                  </div>
                  
                  <button type="submit" style={styles.button}>
                    Add Video
                  </button>
                </form>
              )}

              {videos.length === 0 ? (
                <div style={styles.emptyState}>
                  <div style={styles.emptyStateTitle}>No videos yet</div>
                  <div style={styles.emptyStateText}>
                    Add your first YouTube video to get started!
                  </div>
                </div>
              ) : (
                videos.map((video) => (
                  <div
                    key={video._id}
                    style={{
                      ...styles.videoItem,
                      ...(selectedVideo && selectedVideo._id === video._id ? styles.selectedVideoItem : {})
                    }}
                    onClick={() => setSelectedVideo(video)}
                  >
                    <button
                      style={styles.deleteButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVideo(video._id, video.title);
                      }}
                      title="Delete video"
                    >
                      🗑️
                    </button>
                    <div style={styles.videoTitle}>{video.title}</div>
                    <div style={styles.videoUrl}>{video.videoUrl}</div>
                    <div style={styles.videoDate}>
                      Added {new Date(video.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* Quiz History Tab */}
          {sidebarTab === 'quizzes' && selectedVideo && (
            <div>
              {quizHistory.length === 0 ? (
                <div style={styles.emptyState}>
                  <div style={styles.emptyStateTitle}>No quizzes yet</div>
                  <div style={styles.emptyStateText}>
                    Generate a quiz for this video to see your history here.
                  </div>
                </div>
              ) : (
                quizHistory.map((quiz, index) => (
                  <div key={index} style={styles.quizHistoryItem}>
                    <div style={styles.quizHistoryScore}>
                      Score: {quiz.score}/{quiz.totalQuestions}
                    </div>
                    <div style={styles.quizHistoryDate}>
                      {new Date(quiz.completedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
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

      {/* Quiz Confirmation Dialog */}
      {showQuizConfirm && (
        <div style={styles.confirmationDialog}>
          <div style={styles.confirmationContent}>
            <div style={styles.confirmationTitle}>Generate Quiz</div>
            <div style={styles.confirmationText}>
              This will generate a new quiz based on the video content. Continue?
            </div>
            <div style={styles.confirmationButtons}>
              <button
                style={styles.confirmButton}
                onClick={confirmGenerateQuiz}
              >
                Generate Quiz
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
    </div>
  );
};

export default YouTubeVideoSummarizer;
