import React, { useState, useEffect } from 'react';
import axios from 'axios';

const apiUrl = process.env.REACT_APP_API_ENDPOINT || 'http://localhost:5001';

const DoubtClearanceInlineView = () => {
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
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [currentQuizId, setCurrentQuizId] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizScore, setQuizScore] = useState(null);
  const [youtubeRecommendations, setYoutubeRecommendations] = useState([]);
  const [showAddDoubtForm, setShowAddDoubtForm] = useState(false);
  const [toast, setToast] = useState(null);
  const [newDoubt, setNewDoubt] = useState({ title: '', description: '', imageUrl: '' });
  const [isAddingDoubt, setIsAddingDoubt] = useState(false);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadUserDoubts = async () => {
    try {
      const userId = localStorage.getItem('userId') || 'demo-user';
      const response = await axios.get(`${apiUrl}/doubt-clearances/${userId}`);
      const doubtsData = Array.isArray(response.data) ? response.data : [];
      setDoubts(doubtsData);
      if (doubtsData.length > 0 && !selectedDoubt) {
        setSelectedDoubt(doubtsData[0]);
        loadDoubtData(doubtsData[0]);
      }
    } catch (error) {
      console.error('Error loading doubts:', error);
      setDoubts([]);
    }
  };

  const loadDoubtData = (doubt) => {
    if (!doubt) return;
    const chatHistory = Array.isArray(doubt.chatHistory) ? doubt.chatHistory : [];
    const cleanedChatHistory = chatHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    setChatMessages(cleanedChatHistory);
    setSummary(doubt.summary || '');
    setYoutubeRecommendations(doubt.youtubeRecommendations || []);
  };

  const handleAddDoubt = async (e) => {
    e.preventDefault();
    if (!newDoubt.title.trim() || !newDoubt.description.trim()) {
      showToast('Please fill in title and description', 'error');
      return;
    }
    setIsAddingDoubt(true);
    try {
      const userId = localStorage.getItem('userId') || 'demo-user';
      await axios.post(`${apiUrl}/doubt-clearances`, {
        title: newDoubt.title,
        description: newDoubt.description,
        imageUrl: newDoubt.imageUrl,
        userId
      });
      setNewDoubt({ title: '', description: '', imageUrl: '' });
      setShowAddDoubtForm(false);
      await loadUserDoubts();
      showToast('Doubt added successfully!', 'success');
    } catch (error) {
      console.error('Error adding doubt:', error);
      showToast(error.response?.data?.error || 'Error adding doubt', 'error');
    } finally {
      setIsAddingDoubt(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedDoubt) return;
    const userMessage = newMessage.trim();
    setNewMessage('');
    setIsLoading(true);
    const tempUserMessage = { role: 'user', content: userMessage, timestamp: new Date() };
    setChatMessages(prev => [...prev, tempUserMessage]);
    try {
      const response = await axios.post(`${apiUrl}/chat-with-doubt-clearance`, {
        doubtId: selectedDoubt._id,
        message: userMessage,
        userId: localStorage.getItem('userId') || 'demo-user'
      });
      const aiResponse = { role: 'assistant', content: response.data.response, timestamp: new Date() };
      setChatMessages(prev => [...prev, aiResponse]);
      await loadUserDoubts();
      const updatedDoubts = await axios.get(`${apiUrl}/doubt-clearances/${localStorage.getItem('userId') || 'demo-user'}`);
      const updatedDoubt = updatedDoubts.data.find(d => d._id === selectedDoubt._id);
      if (updatedDoubt) {
        setSelectedDoubt(updatedDoubt);
        const chatHistory = Array.isArray(updatedDoubt.chatHistory) ? updatedDoubt.chatHistory : [];
        const cleanedChatHistory = chatHistory.map(msg => ({ role: msg.role, content: msg.content }));
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
      setActiveTab('summary');
      await loadUserDoubts();
    } catch (error) {
      console.error('Error summarizing doubt:', error);
      showToast('Error generating summary', 'error');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!selectedDoubt) return;
    setIsGeneratingQuiz(true);
    try {
      const response = await axios.post(`${apiUrl}/generate-doubt-quiz`, {
        doubtId: selectedDoubt._id,
        userId: localStorage.getItem('userId') || 'demo-user'
      });
      const newQuiz = response.data.quiz;
      setCurrentQuiz(newQuiz);
      setCurrentQuizId(selectedDoubt.quizzes ? selectedDoubt.quizzes.length : 0);
      setQuizAnswers({});
      setQuizScore(null);
      setActiveTab('quiz');
      await loadUserDoubts();
    } catch (error) {
      console.error('Error generating quiz:', error);
      showToast(error.response?.data?.error || 'Error generating quiz', 'error');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

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
        setCurrentQuiz(null);
        setYoutubeRecommendations([]);
      }
      showToast('Doubt deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting doubt:', error);
      showToast('Error deleting doubt', 'error');
    }
  };

  useEffect(() => {
    loadUserDoubts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedDoubt) {
      loadDoubtData(selectedDoubt);
    }
  }, [selectedDoubt]);

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1">
        {selectedDoubt ? (
          <>
            {/* Header with Title and Tabs */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
              <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedDoubt.title}</h2>
              <p className="text-sm text-gray-600 mb-4">{selectedDoubt.description}</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'chat' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  💬 Chat
                </button>
                <button
                  onClick={handleSummarize}
                  disabled={isSummarizing}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'summary' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  📝 Solutions
                </button>
                <button
                  onClick={handleGenerateQuiz}
                  disabled={isGeneratingQuiz}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'quiz' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  🧠 Quiz
                </button>
                <button
                  onClick={handleGetRecommendations}
                  disabled={isGettingRecommendations}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'recommendations' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  📺 Videos
                </button>
              </div>
            </div>

            {/* Chat Tab */}
            {activeTab === 'chat' && (
              <div className="bg-white rounded-lg border border-gray-200 h-[calc(100vh-400px)] flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.map((message, index) => (
                    <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-4 py-3 rounded-lg text-sm ${
                        message.role === 'user'
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-900 border border-gray-200'
                      }`}>
                        {message.content}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 px-4 py-3 rounded-lg text-sm">Thinking...</div>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-gray-200">
                  <div className="flex gap-2">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Ask a question about your doubt..."
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
                      rows="2"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isLoading}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Summary Tab - Structured Display */}
            {activeTab === 'summary' && (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 h-[calc(100vh-400px)] overflow-y-auto">
                {isSummarizing ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-4xl mb-4">📝</div>
                      <p className="text-sm text-gray-600">Generating solutions...</p>
                    </div>
                  </div>
                ) : summary ? (
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Solution Overview</h3>
                        <p className="text-xs text-gray-500">{selectedDoubt.title}</p>
                      </div>
                    </div>

                    {/* Parse and display summary in structured format */}
                    {(() => {
                      const sentences = summary.split(/\.(?=\s|$)/).filter(s => s.trim().length > 0);
                      const sections = [];
                      let currentSection = { title: 'Solution', content: [] };
                      
                      sentences.forEach((sentence) => {
                        const trimmed = sentence.trim();
                        const headerMatch = trimmed.match(/\*\*([^*]+)\*\*/);
                        if (headerMatch) {
                          if (currentSection.content.length > 0) {
                            sections.push(currentSection);
                          }
                          currentSection = {
                            title: headerMatch[1].replace(/[:]/g, '').trim(),
                            content: [trimmed.replace(/\*\*[^*]+\*\*/, '').trim()]
                          };
                        } else {
                          currentSection.content.push(trimmed);
                        }
                      });
                      
                      if (currentSection.content.length > 0) {
                        sections.push(currentSection);
                      }
                      
                      if (sections.length === 0) {
                        sections.push({
                          title: 'Solution',
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
                                    <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                                      <span className="text-lg">✅</span>
                                    </div>
                                  ) : (
                                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                                      <span className="text-lg">💡</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <h4 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    {section.title}
                                    {idx === 0 && (
                                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                                        Primary
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
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {sentences.length} key points
                                </span>
                              </div>
                              <span className="text-green-600 font-medium">✓ Solution Ready</span>
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
                      <p className="text-sm text-gray-600">Click "Solutions" to generate a solution for this doubt.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quiz Tab */}
            {activeTab === 'quiz' && (
              <div className="bg-white rounded-lg border border-gray-200 p-6 h-[calc(100vh-400px)] overflow-y-auto">
                {isGeneratingQuiz ? (
                  <div className="flex items-center justify-center h-full bg-gradient-to-br from-blue-50 to-purple-50">
                    <div className="text-center p-8">
                      {/* Animated Icon */}
                      <div className="relative inline-block mb-6">
                        <div className="animate-spin rounded-full h-20 w-20 border-4 border-gray-200 border-t-blue-600"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-3xl">🧠</span>
                        </div>
                      </div>
                      
                      {/* Loading Text */}
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Generating Your Quiz</h3>
                      <p className="text-sm text-gray-600 mb-4">Our AI is crafting personalized questions...</p>
                      
                      {/* Progress Dots */}
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                      </div>
                    </div>
                  </div>
                ) : currentQuiz ? (
                  quizScore ? (
                    <div className="text-center p-8 bg-blue-50 rounded-lg">
                      <div className="text-5xl mb-4">🎯</div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">Quiz Complete!</h3>
                      <p className="text-4xl font-bold text-blue-600 mb-4">
                        {Math.round((quizScore.score / quizScore.totalQuestions) * 100)}%
                      </p>
                      <p className="text-sm text-gray-600">
                        {quizScore.score} out of {quizScore.totalQuestions} correct
                      </p>
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
                                onClick={() => setQuizAnswers(prev => ({ ...prev, [qIndex]: oIndex }))}
                                className={`w-full text-left px-3 py-2 text-sm rounded-md border ${
                                  quizAnswers[qIndex] === oIndex
                                    ? 'bg-gray-900 text-white'
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
                  )
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-4xl mb-4">🧠</div>
                      <p className="text-sm text-gray-600">Click "Quiz" to generate practice questions.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recommendations Tab */}
            {activeTab === 'recommendations' && (
              <div className="bg-white rounded-lg border border-gray-200 p-6 h-[calc(100vh-400px)] overflow-y-auto">
                {isGettingRecommendations ? (
                  <div className="flex items-center justify-center h-full bg-gradient-to-br from-red-50 to-orange-50">
                    <div className="text-center p-8">
                      {/* Animated Icon */}
                      <div className="relative inline-block mb-6">
                        <div className="animate-spin rounded-full h-20 w-20 border-4 border-gray-200 border-t-red-600"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-3xl">📺</span>
                        </div>
                      </div>
                      
                      {/* Loading Text */}
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Finding Video Resources</h3>
                      <p className="text-sm text-gray-600 mb-4">Searching YouTube for the best learning content...</p>
                      
                      {/* Progress Dots */}
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                        <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                      </div>
                    </div>
                  </div>
                ) : youtubeRecommendations.length > 0 ? (
                  <div className="space-y-3">
                    {youtubeRecommendations.map((video, index) => (
                      <a
                        key={index}
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors"
                      >
                        <h4 className="font-semibold text-sm text-gray-900 mb-1">{video.title}</h4>
                        <p className="text-xs text-gray-600">{video.description}</p>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-4xl mb-4">📺</div>
                      <p className="text-sm text-gray-600">Click "Videos" to get YouTube recommendations.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-[calc(100vh-250px)] bg-white rounded-lg border border-gray-200">
            <div className="text-center">
              <div className="text-6xl mb-4">💭</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">No Doubt Selected</h3>
              <p className="text-sm text-gray-600">Select or add a doubt to get started.</p>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      <div className="w-80 bg-white rounded-lg border border-gray-200 p-4 h-[calc(100vh-200px)] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Your Doubts</h3>
        </div>
        <button
          onClick={() => setShowAddDoubtForm(!showAddDoubtForm)}
          className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 mb-4 transition-colors"
        >
          + Add Doubt
        </button>

        {/* Add Doubt Form */}
        {showAddDoubtForm && (
          <form onSubmit={handleAddDoubt} className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <input
              type="text"
              value={newDoubt.title}
              onChange={(e) => setNewDoubt({ ...newDoubt, title: e.target.value })}
              placeholder="Doubt title"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <textarea
              value={newDoubt.description}
              onChange={(e) => setNewDoubt({ ...newDoubt, description: e.target.value })}
              placeholder="Describe your doubt..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-600"
              rows="3"
            />
            <input
              type="text"
              value={newDoubt.imageUrl}
              onChange={(e) => setNewDoubt({ ...newDoubt, imageUrl: e.target.value })}
              placeholder="Image URL (optional)"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isAddingDoubt}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isAddingDoubt ? 'Adding...' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddDoubtForm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Doubts List */}
        {doubts.length > 0 ? (
          <div className="space-y-3">
            {doubts.map((doubt) => (
              <div
                key={doubt._id}
                onClick={() => setSelectedDoubt(doubt)}
                className={`relative p-3 rounded-lg cursor-pointer border transition-all ${
                  selectedDoubt?._id === doubt._id
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-gray-50 text-gray-900 border-gray-200 hover:border-gray-300'
                }`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDoubt(doubt._id, doubt.title);
                  }}
                  className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  🗑️
                </button>
                <div className="font-semibold text-sm mb-1 pr-8">{doubt.title}</div>
                <div className="text-xs opacity-75 mb-1 line-clamp-2">{doubt.description}</div>
                <div className="text-xs opacity-75">
                  Added {new Date(doubt.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">💭</div>
            <p className="text-sm font-semibold text-gray-900 mb-1">No doubts yet</p>
            <p className="text-xs text-gray-600">Click "+ Add Doubt" to get started</p>
          </div>
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
    </div>
  );
};

export default DoubtClearanceInlineView;
