import React, { useState, useEffect } from 'react';
import { readOpenParam, clearOpenParam } from '../lib/openParam';
import axios from 'axios';
import { Navigationinner } from "../components/navigationinner";
import MarkdownView from '../components/MarkdownView';
import SummaryHeader from '../components/SummaryHeader';
import NewDoubtForm from '../components/NewDoubtForm';
import QuizSetup from '../components/quiz/QuizSetup';
import { countCorrect } from '../lib/quiz';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;

const DoubtClearance = () => {
  const [openId] = useState(readOpenParam); // ?open=<id> from the Novard Agent
  const [doubts, setDoubts] = useState([]);
  const [selectedDoubt, setSelectedDoubt] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizError, setQuizError] = useState(null);
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
  const [addDoubtError, setAddDoubtError] = useState(null);
  const [isAddingDoubt, setIsAddingDoubt] = useState(false);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadUserDoubts = async () => {
    try {
      const userId = localStorage.getItem('email') || 'demo-user';
      const response = await axios.get(`${apiUrl}/doubt-clearances/${userId}`);
      const doubtsData = Array.isArray(response.data) ? response.data : [];
      setDoubts(doubtsData);
      const target = openId && doubtsData.find((d) => d._id === openId);
      if (target) {
        setSelectedDoubt(target);
        loadDoubtData(target);
        clearOpenParam();
      } else if (doubtsData.length > 0 && !selectedDoubt) {
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

  // Returns true on success so the form can clear itself.
  const handleAddDoubt = async ({ title, description, imageUrl }) => {
    setIsAddingDoubt(true);
    setAddDoubtError(null);
    try {
      const userId = localStorage.getItem('email') || 'demo-user';
      const { data: created } = await axios.post(`${apiUrl}/doubt-clearances`, {
        title,
        description,
        imageUrl,
        userId
      });
      await loadUserDoubts();
      // Open the new doubt in the chat tab so the student can start asking straight away.
      setSelectedDoubt(created);
      setActiveTab('chat');
      setShowAddDoubtForm(false);
      showToast('Doubt added - ask your first question below.', 'success');
      return true;
    } catch (error) {
      console.error('Error adding doubt:', error);
      setAddDoubtError(error.response?.data?.error || 'Could not add the doubt. Please try again.');
      return false;
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
        userId: localStorage.getItem('email') || 'demo-user'
      });
      const aiResponse = { role: 'assistant', content: response.data.response, timestamp: new Date() };
      setChatMessages(prev => [...prev, aiResponse]);
      await loadUserDoubts();
      const updatedDoubts = await axios.get(`${apiUrl}/doubt-clearances/${localStorage.getItem('email') || 'demo-user'}`);
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
        userId: localStorage.getItem('email') || 'demo-user'
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

  // "Quiz" opens the setup screen: previous marks on this topic + quiz options.
  const handleGenerateQuiz = () => {
    if (!selectedDoubt) return;
    setActiveTab('quiz');
    setCurrentQuiz(null);
    setQuizScore(null);
    setQuizAnswers({});
    setQuizError(null);
  };

  const startQuiz = async (settings) => {
    setIsGeneratingQuiz(true);
    setQuizError(null);
    try {
      const response = await axios.post(`${apiUrl}/generate-doubt-quiz`, {
        doubtId: selectedDoubt._id,
        userId: localStorage.getItem('email') || 'demo-user',
        ...settings
      });
      const newQuiz = response.data.quiz;
      setCurrentQuiz(newQuiz);
      setCurrentQuizId(
        Number.isInteger(response.data.quizIndex)
          ? response.data.quizIndex
          : (selectedDoubt.quizzes ? selectedDoubt.quizzes.length : 0)
      );
      setQuizAnswers({});
      setQuizScore(null);
      setActiveTab('quiz');
      await loadUserDoubts();
    } catch (error) {
      console.error('Error generating quiz:', error);
      setQuizError(error.response?.data?.error || 'Could not generate the quiz. Please try again.');
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
        userId: localStorage.getItem('email') || 'demo-user'
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
    const totalQuestions = currentQuiz.length;
    const score = countCorrect(currentQuiz, quizAnswers);
    setQuizScore({ score, totalQuestions });
    try {
      await axios.post(`${apiUrl}/save-doubt-quiz-results`, {
        doubtId: selectedDoubt._id,
        quizIndex: currentQuizId,
        score,
        userId: localStorage.getItem('email') || 'demo-user'
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
        data: { userId: localStorage.getItem('email') || 'demo-user' }
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
    <>
      <Navigationinner title={"DOUBT CLEARANCE"} hasSidebar={false} />
      <div className="flex min-h-screen bg-gray-50 pt-14">
        {/* Main Content */}
        <div className="flex-1 min-w-0 p-6">
          {selectedDoubt && !showAddDoubtForm ? (
            <>
              {/* Header */}
              <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{selectedDoubt.title}</h2>
                <p className="text-sm text-gray-600 mb-4 whitespace-pre-wrap">{selectedDoubt.description}</p>
                {selectedDoubt.imageUrl && (
                  <a href={selectedDoubt.imageUrl} target="_blank" rel="noopener noreferrer" className="inline-block mb-4">
                    <img src={selectedDoubt.imageUrl} alt="Attached to this doubt" className="max-h-40 rounded-lg border border-gray-200 object-contain bg-gray-50" />
                  </a>
                )}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'chat' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    💬 Chat
                  </button>
                  <button
                    onClick={handleSummarize}
                    disabled={isSummarizing}
                    className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'summary' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    📝 Solutions
                  </button>
                  <button
                    onClick={handleGenerateQuiz}
                    disabled={isGeneratingQuiz}
                    className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'quiz' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    🧠 Quiz
                  </button>
                  <button
                    onClick={handleGetRecommendations}
                    disabled={isGettingRecommendations}
                    className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'recommendations' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    📺 Videos
                  </button>
                </div>
              </div>

              {/* Chat Tab */}
              {activeTab === 'chat' && (
                <div className="bg-white rounded-lg shadow-md h-[calc(100vh-300px)] flex flex-col">
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {chatMessages.map((message, index) => (
                      <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] min-w-0 px-4 py-3 rounded-lg text-sm ${message.role === 'user'
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-900 border border-gray-200'
                          }`}>
                          {message.role === 'user' ? (
                            <div className="whitespace-pre-wrap break-words">{message.content}</div>
                          ) : (
                            <MarkdownView content={message.content} />
                          )}
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
                <div className="bg-gray-50 rounded-lg shadow-md p-6 h-[calc(100vh-300px)] overflow-y-auto">
                  {isSummarizing ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="text-4xl mb-4">📝</div>
                        <p className="text-sm text-gray-600">Generating solutions...</p>
                      </div>
                    </div>
                  ) : summary ? (
                      <div className="space-y-4">
                        <SummaryHeader title="Solution Overview" subtitle={selectedDoubt.title} icon="check" tone="green" />
                        <MarkdownView content={summary} size="base" />
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
                <div className="bg-white rounded-lg shadow-md p-6 h-[calc(100vh-300px)] overflow-y-auto">
                  {currentQuiz ? (
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
                        <button
                          type="button"
                          onClick={handleGenerateQuiz}
                          className="mt-6 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
                        >
                          See all your marks · Try another quiz
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
                                      onClick={() => setQuizAnswers(prev => ({ ...prev, [qIndex]: oIndex }))}
                                      className={`w-full text-left px-3 py-2 text-sm rounded-md border ${quizAnswers[qIndex] === oIndex
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
                            <button onClick={handleSubmitQuiz} className="w-full px-6 py-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
                              Submit Quiz
                            </button>
                        </div>
                      )
                    ) : (
                    <QuizSetup
                      source="doubt"
                      itemId={selectedDoubt._id}
                      topic={selectedDoubt.title}
                      onStart={startQuiz}
                      starting={isGeneratingQuiz}
                      error={quizError}
                      blockedReason={Math.max(chatMessages.length, (selectedDoubt.chatHistory || []).length) < 4 ? 'Ask at least two questions in the chat first - the quiz is built from what was explained to you.' : null}
                    />
                  )}
                </div>
              )}

              {/* Recommendations Tab */}
              {activeTab === 'recommendations' && (
                <div className="bg-white rounded-lg shadow-md p-6 h-[calc(100vh-300px)] overflow-y-auto">
                  {isGettingRecommendations ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="text-4xl mb-4">📺</div>
                        <p className="text-sm text-gray-600">Finding videos...</p>
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
                          className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 border border-gray-200"
                        >
                          <h4 className="font-semibold text-sm text-gray-900 mb-1">{video.title}</h4>
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
            <div className="h-[calc(100vh-128px)] bg-white rounded-lg shadow-md">
              <NewDoubtForm
                onSubmit={handleAddDoubt}
                // Cancel only makes sense when there is a doubt to go back to.
                onCancel={selectedDoubt ? () => { setShowAddDoubtForm(false); setAddDoubtError(null); } : undefined}
                submitting={isAddingDoubt}
                error={addDoubtError}
                isFirstDoubt={doubts.length === 0}
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Your Doubts</h3>
          </div>
          <button
            onClick={() => { setShowAddDoubtForm(true); setAddDoubtError(null); }}
            aria-pressed={showAddDoubtForm || !selectedDoubt}
            className={`w-full px-4 py-2  text-sm font-medium rounded-md  mb-4 ${
              showAddDoubtForm || !selectedDoubt ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {showAddDoubtForm || !selectedDoubt ? 'Writing a new doubt…' : '+ Add Doubt'}
          </button>

          {/* Doubts List */}
          {doubts.length > 0 ? (
            <div className="space-y-3">
              {doubts.map((doubt) => (
                <div
                  key={doubt._id}
                  onClick={() => { setSelectedDoubt(doubt); setShowAddDoubtForm(false); }}
                  className={`relative p-3 rounded-lg cursor-pointer border ${selectedDoubt?._id === doubt._id && !showAddDoubtForm
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-gray-50 text-gray-900 border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDoubt(doubt._id, doubt.title);
                    }}
                    className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-red-600 hover:bg-red-50 rounded"
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
              <p className="text-xs text-gray-600">Fill in the form to add your first one</p>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded-md shadow-lg text-sm font-medium z-50 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.message}
        </div>
      )}
    </>
  );
};

export default DoubtClearance;
