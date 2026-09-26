import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Workspace, Panel, ItemFrame, TabBody, TabBar, ChatPanel, GeneratingState, EmptyState, SummaryView,
  QuizRunner, SideList, ListItem, ListEmpty, Toast, Icon, btn, inputClass, formatDate,
} from './learning/LearningUI';
import QuizSetup from './quiz/QuizSetup';
import { countCorrect } from '../lib/quiz';
import { readOpenParam, clearOpenParam } from '../lib/openParam';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;


const VideoSummarizerInlineView = () => {
  const [openId] = useState(readOpenParam); // ?open=<id>, e.g. from the Novard Agent
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
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
  const [quizError, setQuizError] = useState(null);
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
      const target = openId && videosData.find((item) => item._id === openId);
      if (target) {
        setSelectedVideo(target);
        loadVideoData(target);
        clearOpenParam();
      } else if (videosData.length > 0 && !selectedVideo) {
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
      const { data: created } = await axios.post(`${apiUrl}/youtube-videos`, {
        title: newVideo.title,
        videoUrl: newVideo.videoUrl,
        userId
      });
      setNewVideo({ title: '', videoUrl: '' });
      setShowAddVideoForm(false);
      await loadUserVideos();
      if (created) { setSelectedVideo(created); setActiveTab('chat'); }
      showToast('Video added successfully!', 'success');
    } catch (error) {
      console.error('Error adding video:', error);
      showToast(error.response?.data?.error || 'Error adding video', 'error');
    } finally {
      setIsAddingVideo(false);
    }
  };

  // Returns false on failure so the chat box can restore what was typed.
  const handleSendMessage = async (userMessage) => {
    if (!userMessage || !selectedVideo) return false;
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
      showToast('Could not send your message. Please try again.', 'error');
      setChatMessages(prev => prev.slice(0, -1));
      return false;
    } finally {
      setIsLoading(false);
    }
    return true;
  };

  const handleSummarize = async () => {
    if (!selectedVideo) return;
    if (selectedVideo.summary) {
      setSummary(selectedVideo.summary);
      setActiveTab('summary');
      return;
    }
    setActiveTab('summary');
    setIsSummarizing(true);
    try {
      const response = await axios.post(`${apiUrl}/summarize-youtube-video`, {
        videoId: selectedVideo._id,
        userId: localStorage.getItem('email') || 'demo-user'
      });
      setSummary(response.data.summary);
      await loadUserVideos();
    } catch (error) {
      console.error('Error summarizing video:', error);
      showToast('Error generating summary', 'error');
    } finally {
      setIsSummarizing(false);
    }
  };

  // "Quiz" opens the setup screen: previous marks on this video + quiz options.
  const handleGenerateQuiz = () => {
    if (!selectedVideo) return;
    setActiveTab('quiz');
    setCurrentQuiz(null);
    setQuizScore(null);
    setQuizAnswers({});
    setQuizError(null);
  };

  const confirmGenerateQuiz = async (settings) => {
    setIsGeneratingQuiz(true);
    setQuizError(null);
    try {
      const response = await axios.post(`${apiUrl}/generate-youtube-quiz`, {
        videoId: selectedVideo._id,
        userId: localStorage.getItem('email') || 'demo-user',
        ...settings
      });
      const newQuiz = response.data.quiz;
      setCurrentQuiz(newQuiz);
      // The server reports which slot it stored the quiz in; the local count
      // can be stale if selectedVideo was not refreshed after an earlier quiz.
      setCurrentQuizId(
        Number.isInteger(response.data.quizIndex)
          ? response.data.quizIndex
          : (selectedVideo.quizzes ? selectedVideo.quizzes.length : 0)
      );
      setQuizAnswers({});
      setQuizScore(null);
      await loadUserVideos();
    } catch (error) {
      console.error('Error generating quiz:', error);
      setQuizError(error.response?.data?.error || 'Could not generate the quiz. Please try again.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!currentQuiz || !selectedVideo) return;
    const totalQuestions = currentQuiz.length;
    const score = countCorrect(currentQuiz, quizAnswers);
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

  const onTab = (id) => {
    if (id === 'chat') setActiveTab('chat');
    else if (id === 'summary') handleSummarize();
    else if (id === 'quiz') handleGenerateQuiz();
  };
  const quizResult = quizScore ? { correct: quizScore.score, total: quizScore.totalQuestions } : null;

  return (
    <>
      <Workspace
        side={(
          <SideList
            title="Your videos"
            count={videos.length}
            action={showAddVideoForm ? (
              <form onSubmit={handleAddVideo} className="space-y-2.5">
                <input type="text" value={newVideo.title} onChange={(e) => setNewVideo({ ...newVideo, title: e.target.value })} placeholder="Video title" className={inputClass} autoFocus />
                <input type="url" value={newVideo.videoUrl} onChange={(e) => setNewVideo({ ...newVideo, videoUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" className={inputClass} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowAddVideoForm(false)} className={`${btn.secondary} flex-1`}>Cancel</button>
                  <button type="submit" disabled={isAddingVideo} className={`${btn.primary} flex-1`}>{isAddingVideo ? 'Adding…' : 'Add video'}</button>
                </div>
                {isAddingVideo && <p className="text-xs text-gray-500">Fetching the video details and transcript…</p>}
              </form>
            ) : (
              <button type="button" onClick={() => setShowAddVideoForm(true)} className={`${btn.primary} w-full`}>
                <Icon name="plus" /> Add video
              </button>
            )}
          >
            {videos.length > 0 ? videos.map((video) => (
              <ListItem
                key={video._id}
                active={selectedVideo?._id === video._id}
                title={video.title}
                meta={formatDate(video.createdAt)}
                badges={<>
                  {video.summary && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">Summary</span>}
                  {video.quizzes?.length > 0 && <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-100">{video.quizzes.length} {video.quizzes.length === 1 ? 'quiz' : 'quizzes'}</span>}
                </>}
                onSelect={() => { setSelectedVideo(video); setActiveTab('chat'); }}
                onDelete={() => handleDeleteVideo(video._id, video.title)}
              />
            )) : <ListEmpty icon="video" title="No videos yet" text="Add a YouTube link to get started." />}
          </SideList>
        )}
      >
        {selectedVideo ? (
          <>
            <ItemFrame
              icon="video"
              title={selectedVideo.title}
              meta={(
                <a href={selectedVideo.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline">
                  Watch on YouTube <Icon name="link" className="h-3 w-3" />
                </a>
              )}
              tabs={(
                <TabBar
                  size="sm"
                  active={activeTab}
                  onChange={onTab}
                  tabs={[
                    { id: 'chat', label: 'Chat', icon: 'chat' },
                    { id: 'summary', label: 'Summary', icon: 'summary', busy: isSummarizing },
                    { id: 'quiz', label: 'Quiz', icon: 'quiz', busy: isGeneratingQuiz },
                  ]}
                />
              )}
            >
              {activeTab === 'chat' && (
                <ChatPanel
                  messages={chatMessages}
                  sending={isLoading}
                  onSend={handleSendMessage}
                  placeholder="Ask anything about this video…"
                  emptyTitle="Chat with this video"
                  emptyText="Ask about any part of the video - the assistant answers from its transcript."
                  suggestions={['What are the key takeaways?', 'Explain the main concept simply', 'What should I learn next?']}
                />
              )}

              {activeTab === 'summary' && (
                <TabBody>
                  {isSummarizing ? (
                    <GeneratingState icon="summary" title="Summarising the video" hint="Reading the transcript and writing a structured summary with a diagram. This usually takes 10-20 seconds." />
                  ) : summary ? (
                    <SummaryView icon="video" title="Video summary" content={summary} />
                  ) : (
                    <EmptyState icon="summary" title="No summary yet" text="Generate a structured summary of this video." action={<button type="button" onClick={handleSummarize} className={btn.primary}>Generate summary</button>} />
                  )}
                </TabBody>
              )}

              {activeTab === 'quiz' && (
                <TabBody>
                  {isGeneratingQuiz ? (
                    <GeneratingState icon="quiz" title="Building your quiz" hint="Writing questions from the video. This usually takes 10-30 seconds." />
                  ) : currentQuiz ? (
                    <QuizRunner
                      questions={currentQuiz}
                      answers={quizAnswers}
                      onAnswer={(qi, oi) => setQuizAnswers((prev) => ({ ...prev, [qi]: oi }))}
                      onSubmit={handleSubmitQuiz}
                      result={quizResult}
                      onRetry={handleGenerateQuiz}
                    />
                  ) : (
                    <div className="h-full overflow-y-auto p-6">
                      <QuizSetup source="youtube" itemId={selectedVideo._id} topic={selectedVideo.title} onStart={confirmGenerateQuiz} starting={isGeneratingQuiz} error={quizError} />
                    </div>
                  )}
                </TabBody>
              )}
            </ItemFrame>
          </>
        ) : (
          <Panel fill>
            <EmptyState icon="video" title="Welcome to Video Summarizer" text="Add a YouTube video to chat with it, get a summary and test yourself with a quiz." action={<button type="button" onClick={() => setShowAddVideoForm(true)} className={btn.primary}><Icon name="plus" /> Add your first video</button>} />
          </Panel>
        )}
      </Workspace>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
};

export default VideoSummarizerInlineView;
