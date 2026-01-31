import React, { useState, useEffect } from 'react';
import axios from 'axios';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;

const VideoSummarizerInlineView = () => {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [summary, setSummary] = useState('');
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [currentQuizId, setCurrentQuizId] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizScore, setQuizScore] = useState(null);
  const [showAddVideoForm, setShowAddVideoForm] = useState(false);
  const [toast, setToast] = useState(null);
  const [showQuizConfirm, setShowQuizConfirm] = useState(false);
  const [newVideo, setNewVideo] = useState({ title: '', videoUrl: '' });
  const [isAddingVideo, setIsAddingVideo] = useState(false);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadUserVideos = async () => {
    try {
      const userId = localStorage.getItem('email') || 'demo-user';
      const response = await axios.get(`${apiUrl}/youtube-videos/${userId}`);
      const videosData = Array.isArray(response.data) ? response.data : [];
      setVideos(videosData);
      if (videosData.length > 0 && !selectedVideo) {
        setSelectedVideo(videosData[0]);
        loadVideoData(videosData[0]);
      }
    } catch (error) {
      console.error('Error loading videos:', error);
      setVideos([]);
    }
  };

  const loadVideoData = (video) => {
    if (!video) return;
    const chatHistory = Array.isArray(video.chatHistory) ? video.chatHistory : [];
    const cleanedChatHistory = chatHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    setChatMessages(cleanedChatHistory);
    setSummary(video.summary || '');
  };

  const handleAddVideo = async (e) => {
    e.preventDefault();
    if (!newVideo.title.trim() || !newVideo.videoUrl.trim()) {
      showToast('Please fill in all fields', 'error');
      return;
    }
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;
    if (!youtubeRegex.test(newVideo.videoUrl)) {
      showToast('Please enter a valid YouTube URL', 'error');
      return;
    }
    const duplicateTitle = videos.find(video => video.title.toLowerCase() === newVideo.title.toLowerCase());
    if (duplicateTitle) {
      showToast('A video with this title already exists', 'error');
      return;
    }
    setIsAddingVideo(true);
    try {
      const userId = localStorage.getItem('email') || 'demo-user';
      await axios.post(`${apiUrl}/youtube-videos`, {
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
    } finally {
      setIsAddingVideo(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedVideo) return;
    const userMessage = newMessage.trim();
    setNewMessage('');
    setIsLoading(true);
    const tempUserMessage = { role: 'user', content: userMessage, timestamp: new Date() };
    setChatMessages(prev => [...prev, tempUserMessage]);
    try {
      const response = await axios.post(`${apiUrl}/chat-with-youtube-video`, {
        videoId: selectedVideo._id,
        message: userMessage,
        userId: localStorage.getItem('email') || 'demo-user'
      });
      const aiResponse = { role: 'assistant', content: response.data.response, timestamp: new Date() };
      setChatMessages(prev => [...prev, aiResponse]);
      await loadUserVideos();
      const updatedVideos = await axios.get(`${apiUrl}/youtube-videos/${localStorage.getItem('email') || 'demo-user'}`);
      const updatedVideo = updatedVideos.data.find(v => v._id === selectedVideo._id);
      if (updatedVideo) {
        setSelectedVideo(updatedVideo);
        const chatHistory = Array.isArray(updatedVideo.chatHistory) ? updatedVideo.chatHistory : [];
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
    if (!selectedVideo) return;
    if (selectedVideo.summary) {
      setSummary(selectedVideo.summary);
      setActiveTab('summary');
      return;
    }
    setIsSummarizing(true);
    try {
      const response = await axios.post(`${apiUrl}/summarize-youtube-video`, {
        videoId: selectedVideo._id,
        userId: localStorage.getItem('email') || 'demo-user'
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

  const handleGenerateQuiz = () => {
    if (!selectedVideo) return;
    setShowQuizConfirm(true);
  };

  const confirmGenerateQuiz = async () => {
    setShowQuizConfirm(false);
    setIsGeneratingQuiz(true);
    try {
      const response = await axios.post(`${apiUrl}/generate-youtube-quiz`, {
        videoId: selectedVideo._id,
        userId: localStorage.getItem('email') || 'demo-user'
      });
      const newQuiz = response.data.quiz;
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
    try {
      await axios.post(`${apiUrl}/save-youtube-quiz-results`, {
        videoId: selectedVideo._id,
        quizIndex: currentQuizId,
        score,
        userId: localStorage.getItem('email') || 'demo-user'
      });
      await loadUserVideos();
    } catch (error) {
      console.error('Error saving quiz results:', error);
    }
  };

  const handleDeleteVideo = async (videoId, videoTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${videoTitle}"?`)) {
      return;
    }
    try {
      await axios.delete(`${apiUrl}/youtube-videos/${videoId}`, {
        data: { userId: localStorage.getItem('email') || 'demo-user' }
      });
      await loadUserVideos();
      if (selectedVideo && selectedVideo._id === videoId) {
        setSelectedVideo(null);
        setChatMessages([]);
        setSummary('');
        setCurrentQuiz(null);
      }
      showToast('Video deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting video:', error);
      showToast('Error deleting video', 'error');
    }
  };

  useEffect(() => {
    loadUserVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedVideo) {
      loadVideoData(selectedVideo);
    }
  }, [selectedVideo]);

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1">
        {selectedVideo ? (
          <>
            {/* Header */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedVideo.title}</h2>
              <a
                href={selectedVideo.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline block mb-4"
              >
                {selectedVideo.videoUrl}
              </a>
              <div className="flex gap-2">
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
                  📝 Summarize
                </button>
                <button
                  onClick={handleGenerateQuiz}
                  disabled={isGeneratingQuiz}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'quiz' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  🧠 Quiz
                </button>
              </div>
            </div>

            {/* Chat Tab */}
            {activeTab === 'chat' && (
              <div className="bg-white rounded-lg shadow-md h-[calc(100vh-330px)] flex flex-col">
                <div className="flex-1 overflow-y-auto scroll-smooth scrollbar-hide p-4 space-y-3">
                  {chatMessages.map((message, index) => (
                    <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-4 py-3 rounded-lg text-sm ${message.role === 'user'
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
                      placeholder="Ask about this video..."
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

            {/* Summary Tab */}
            {activeTab === 'summary' && (
              <div className="bg-white rounded-lg shadow-md p-6 h-[calc(100vh-330px)] overflow-y-auto scroll-smooth scrollbar-hide">
                {isSummarizing ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-4xl mb-4">📝</div>
                      <p className="text-sm text-gray-600">Generating summary...</p>
                    </div>
                  </div>
                ) : summary ? (
                  <div className="prose max-w-none text-sm">{summary}</div>
                ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="text-4xl mb-4">📝</div>
                        <p className="text-sm text-gray-600">Click "Summarize" to generate a summary.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quiz Tab */}
            {activeTab === 'quiz' && (
              <div className="bg-white rounded-lg shadow-md p-6 h-[calc(100vh-330px)] overflow-y-auto scroll-smooth scrollbar-hide">
                {isGeneratingQuiz ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-4xl mb-4">🧠</div>
                      <p className="text-sm text-gray-600">Generating quiz...</p>
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
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="text-4xl mb-4">🧠</div>
                          <p className="text-sm text-gray-600">Click "Quiz" to generate questions.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
            <div className="flex items-center justify-center h-[calc(100vh-250px)] bg-white rounded-lg border border-gray-200">
              <div className="text-center">
                <div className="text-6xl mb-4">📺</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Video Summarizer</h2>
                <p className="text-sm text-gray-600">Add a YouTube video to get started.</p>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="w-80 bg-white rounded-lg border border-gray-200 p-4 h-[calc(100vh-160px)] overflow-y-auto scroll-smooth scrollbar-hide">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Your Videos</h3>
        </div>
        <button
          onClick={() => setShowAddVideoForm(!showAddVideoForm)}
          className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 mb-4"
        >
          + Add Video
        </button>

        {/* Add Video Form */}
        {showAddVideoForm && (
          <form onSubmit={handleAddVideo} className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <input
              type="text"
              value={newVideo.title}
              onChange={(e) => setNewVideo({ ...newVideo, title: e.target.value })}
              placeholder="Video title"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <input
              type="text"
              value={newVideo.videoUrl}
              onChange={(e) => setNewVideo({ ...newVideo, videoUrl: e.target.value })}
              placeholder="YouTube URL"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isAddingVideo}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isAddingVideo ? 'Adding...' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddVideoForm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Videos List */}
        {videos.length > 0 ? (
          <div className="space-y-3">
            {videos.map((video) => (
              <div
                key={video._id}
                onClick={() => setSelectedVideo(video)}
                className={`relative p-3 rounded-lg cursor-pointer border ${selectedVideo?._id === video._id
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-gray-50 text-gray-900 border-gray-200 hover:border-gray-300'
                  }`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteVideo(video._id, video.title);
                  }}
                  className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-red-600 hover:bg-red-50 rounded"
                >
                  🗑️
                </button>
                <div className="font-semibold text-sm mb-1 pr-8 truncate">{video.title}</div>
                <div className="text-xs opacity-75 mb-1 truncate">{video.videoUrl}</div>
                <div className="text-xs opacity-75">
                  Added {new Date(video.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">📺</div>
              <p className="text-sm font-semibold text-gray-900 mb-1">No videos yet</p>
              <p className="text-xs text-gray-600">Click "+ Add Video" to get started</p>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded-md shadow-lg text-sm font-medium z-50 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
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
                Create a quiz based on "{selectedVideo?.title}"?
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

export default VideoSummarizerInlineView;
