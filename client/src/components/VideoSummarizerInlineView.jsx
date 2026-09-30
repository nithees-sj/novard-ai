import React, { useState, useEffect } from 'react';
import { api, errorMessage } from '../lib/api';
import logger from '../lib/logger';
import { currentEmail } from '../lib/session';
import {
  Workspace, Panel, ItemFrame, TabBody, TabBar, ChatPanel, GeneratingState, EmptyState, SummaryView,
  QuizRunner, LoadingPanel, SideList, ListItem, ListEmpty, Toast, Icon, btn, formatDate,
} from './learning/LearningUI';
import NewVideoForm from './learning/NewVideoForm';
import QuizSetup from './quiz/QuizSetup';
import { countCorrect } from '../lib/quiz';
import { readOpenParam, clearOpenParam } from '../lib/openParam';



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
  const [isAddingVideo, setIsAddingVideo] = useState(false);
  const [addError, setAddError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Reloads the list and keeps the open video in step with it.
  const loadUserVideos = async () => {
    try {
      const response = await api.get(`/youtube-videos/${encodeURIComponent(currentEmail())}`);
      const videosData = Array.isArray(response.data) ? response.data : [];
      setVideos(videosData);
      const target = openId && videosData.find((item) => item._id === openId);
      if (target) {
        setSelectedVideo(target);
        clearOpenParam();
      } else {
        setSelectedVideo((current) => (current
          ? videosData.find((v) => v._id === current._id) || current
          : videosData[0] || null));
      }
    } catch (error) {
      logger.error('Error loading videos', error);
      showToast(errorMessage(error, 'Could not load your videos.'), 'error');
    } finally {
      setLoaded(true);
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

  // Called by the add-video form in the main area; returns true when the video was added.
  const handleAddVideo = async ({ videoUrl, title }) => {
    setIsAddingVideo(true);
    setAddError(null);
    try {
      const { data: created } = await api.post('/youtube-videos', { videoUrl, title: title || undefined, userId: currentEmail() });
      // Open the new video first, then refresh the list, so the old selection never flashes.
      if (created) { setSelectedVideo(created); setActiveTab('chat'); }
      setShowAddVideoForm(false);
      await loadUserVideos();
      showToast('Video added - ask it anything.', 'success');
      return true;
    } catch (error) {
      logger.error('Error adding video', error);
      setAddError(errorMessage(error, 'The video could not be added. Please try again.'));
      return false;
    } finally {
      setIsAddingVideo(false);
    }
  };

  const openVideo = (video) => {
    setSelectedVideo(video);
    setShowAddVideoForm(false);
    setAddError(null);
    setActiveTab('chat');
  };

  // Returns false on failure so the chat box can restore what was typed.
  const handleSendMessage = async (userMessage) => {
    if (!userMessage || !selectedVideo) return false;
    setIsLoading(true);
    const tempUserMessage = { role: 'user', content: userMessage, timestamp: new Date() };
    setChatMessages(prev => [...prev, tempUserMessage]);
    try {
      const response = await api.post(`/chat-with-youtube-video`, {
        videoId: selectedVideo._id,
        message: userMessage,
        userId: currentEmail()
      });
      const aiResponse = { role: 'assistant', content: response.data.response, timestamp: new Date() };
      setChatMessages(prev => [...prev, aiResponse]);
      loadUserVideos(); // refresh the list in the background - the result is already on screen
    } catch (error) {
      logger.error('Error sending message', error);
      showToast(errorMessage(error, 'Could not send your message. Please try again.'), 'error');
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
      const response = await api.post(`/summarize-youtube-video`, {
        videoId: selectedVideo._id,
        userId: currentEmail()
      });
      setSummary(response.data.summary);
      loadUserVideos(); // refresh the list in the background - the result is already on screen
    } catch (error) {
      logger.error('Error summarizing video', error);
      showToast(errorMessage(error, 'Error generating summary'), 'error');
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
      const response = await api.post(`/generate-youtube-quiz`, {
        videoId: selectedVideo._id,
        userId: currentEmail(),
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
      loadUserVideos(); // refresh the list in the background - the result is already on screen
    } catch (error) {
      logger.error('Error generating quiz', error);
      setQuizError(errorMessage(error, 'Could not generate the quiz. Please try again.'));
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
      await api.post(`/save-youtube-quiz-results`, {
        videoId: selectedVideo._id,
        quizIndex: currentQuizId,
        score,
        userId: currentEmail()
      });
      await loadUserVideos();
    } catch (error) {
      logger.error('Error saving quiz results', error);
      showToast(errorMessage(error, 'Your score could not be saved.'), 'error');
    }
  };

  const handleDeleteVideo = async (videoId, videoTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${videoTitle}"?`)) {
      return;
    }
    try {
      await api.delete(`/youtube-videos/${videoId}`, {
        data: { userId: currentEmail() }
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
      logger.error('Error deleting video', error);
      showToast(errorMessage(error, 'Error deleting video'), 'error');
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
  // The add form fills the main area: on request, or straight away when there are no videos yet.
  const adding = showAddVideoForm || (loaded && videos.length === 0);

  return (
    <>
      <Workspace
        side={(
          <SideList
            loading={!loaded}
            title="Your videos"
            count={videos.length}
            action={(
              <button
                type="button"
                onClick={() => { setShowAddVideoForm(true); setAddError(null); }}
                aria-pressed={adding}
                className={`${adding ? btn.secondary : btn.primary} w-full`}
              >
                <Icon name="plus" /> {adding ? 'Adding a video…' : 'Add video'}
              </button>
            )}
          >
            {videos.length > 0 ? videos.map((video) => (
              <ListItem
                key={video._id}
                active={selectedVideo?._id === video._id && !adding}
                title={video.title}
                meta={formatDate(video.createdAt)}
                badges={<>
                  {video.summary && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">Summary</span>}
                  {video.quizzes?.length > 0 && <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-100">{video.quizzes.length} {video.quizzes.length === 1 ? 'quiz' : 'quizzes'}</span>}
                </>}
                onSelect={() => openVideo(video)}
                onDelete={() => handleDeleteVideo(video._id, video.title)}
              />
            )) : <ListEmpty icon="video" title="No videos yet" text="Add a YouTube link to get started." />}
          </SideList>
        )}
      >
        {adding ? (
          <NewVideoForm
            onSubmit={handleAddVideo}
            onCancel={videos.length > 0 ? () => { setShowAddVideoForm(false); setAddError(null); } : undefined}
            onOpenExisting={(dup) => openVideo(videos.find((v) => v._id === dup._id) || dup)}
            existing={videos}
            submitting={isAddingVideo}
            error={addError}
            isFirst={videos.length === 0}
          />
        ) : selectedVideo ? (
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
          loaded ? (
            <Panel fill>
              <EmptyState icon="video" title="Pick a video" text="Choose a video from your list, or add a new one." />
            </Panel>
          ) : <LoadingPanel label="Loading your videos…" />
        )}
      </Workspace>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
};

export default VideoSummarizerInlineView;
