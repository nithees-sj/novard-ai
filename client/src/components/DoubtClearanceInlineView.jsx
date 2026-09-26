import React, { useState, useEffect } from 'react';
import axios from 'axios';
import NewDoubtForm from './NewDoubtForm';
import {
  Workspace, Panel, ItemFrame, TabBody, TabBar, ChatPanel, GeneratingState, EmptyState, SummaryView,
  QuizRunner, SideList, ListItem, ListEmpty, Toast, Icon, btn, formatDate,
} from './learning/LearningUI';
import QuizSetup from './quiz/QuizSetup';
import { countCorrect } from '../lib/quiz';
import { readOpenParam, clearOpenParam } from '../lib/openParam';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;


const DoubtClearanceInlineView = () => {
  const [openId] = useState(readOpenParam); // ?open=<id>, e.g. from the Novard Agent
  const [doubts, setDoubts] = useState([]);
  const [selectedDoubt, setSelectedDoubt] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
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
      const target = openId && doubtsData.find((item) => item._id === openId);
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
  const handleAddDoubt = async ({ description, imageUrl }) => {
    setIsAddingDoubt(true);
    setAddDoubtError(null);
    try {
      const userId = localStorage.getItem('email') || 'demo-user';
      const { data: created } = await axios.post(`${apiUrl}/doubt-clearances`, {
        description,
        imageUrl,
        userId
      });
      await loadUserDoubts();
      // Open the new doubt and put the question to the tutor straight away,
      // so the chat starts with the student's own words and an answer.
      setSelectedDoubt({ ...created, chatHistory: [{ role: 'user', content: description }] });
      setActiveTab('chat');
      setShowAddDoubtForm(false);
      handleSendMessage(description, created, { echo: false });
      return true;
    } catch (error) {
      console.error('Error adding doubt:', error);
      setAddDoubtError(error.response?.data?.error || 'Could not add the doubt. Please try again.');
      return false;
    } finally {
      setIsAddingDoubt(false);
    }
  };


  // Returns false on failure so the chat box can restore what was typed.
  // `echo: false` when the message is already on screen (a new doubt opens with its question shown).
  const handleSendMessage = async (userMessage, doubt = selectedDoubt, { echo = true } = {}) => {
    if (!userMessage || !doubt) return false;
    setIsLoading(true);
    if (echo) setChatMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);
    try {
      const response = await axios.post(`${apiUrl}/chat-with-doubt-clearance`, {
        doubtId: doubt._id,
        message: userMessage,
        userId: localStorage.getItem('email') || 'demo-user'
      });
      const aiResponse = { role: 'assistant', content: response.data.response, timestamp: new Date() };
      setChatMessages(prev => [...prev, aiResponse]);
      await loadUserDoubts();
      const updatedDoubts = await axios.get(`${apiUrl}/doubt-clearances/${localStorage.getItem('email') || 'demo-user'}`);
      const updatedDoubt = updatedDoubts.data.find(d => d._id === doubt._id);
      if (updatedDoubt) {
        setSelectedDoubt(updatedDoubt);
        const chatHistory = Array.isArray(updatedDoubt.chatHistory) ? updatedDoubt.chatHistory : [];
        const cleanedChatHistory = chatHistory.map(msg => ({ role: msg.role, content: msg.content }));
        setChatMessages(cleanedChatHistory);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Could not send your message. Please try again.', 'error');
      if (echo) setChatMessages(prev => prev.slice(0, -1));
      return false;
    } finally {
      setIsLoading(false);
    }
    return true;
  };

  const handleSummarize = async () => {
    if (!selectedDoubt) return;
    if (selectedDoubt.summary) {
      setSummary(selectedDoubt.summary);
      setActiveTab('summary');
      return;
    }
    setActiveTab('summary');
    setIsSummarizing(true);
    try {
      const response = await axios.post(`${apiUrl}/summarize-doubt-clearance`, {
        doubtId: selectedDoubt._id,
        userId: localStorage.getItem('email') || 'demo-user'
      });
      setSummary(response.data.summary);
      await loadUserDoubts();
    } catch (error) {
      console.error('Error summarizing doubt:', error);
      showToast('Error generating summary', 'error');
    } finally {
      setIsSummarizing(false);
    }
  };

  // "Quiz" opens the setup screen: previous marks on this doubt + quiz options.
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
      // The server reports which slot it stored the quiz in; the local count
      // can be stale if selectedDoubt was not refreshed after an earlier quiz.
      setCurrentQuizId(
        Number.isInteger(response.data.quizIndex)
          ? response.data.quizIndex
          : (selectedDoubt.quizzes ? selectedDoubt.quizzes.length : 0)
      );
      setQuizAnswers({});
      setQuizScore(null);
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
    setActiveTab('recommendations');
    setIsGettingRecommendations(true);
    try {
      const response = await axios.post(`${apiUrl}/get-youtube-recommendations`, {
        doubtId: selectedDoubt._id,
        userId: localStorage.getItem('email') || 'demo-user'
      });
      setYoutubeRecommendations(response.data.recommendations);
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

  const onTab = (id) => {
    if (id === 'chat') setActiveTab('chat');
    else if (id === 'summary') handleSummarize();
    else if (id === 'quiz') handleGenerateQuiz();
    else if (id === 'recommendations') {
      if (youtubeRecommendations.length) setActiveTab('recommendations');
      else handleGetRecommendations();
    }
  };

  const quizResult = quizScore ? { correct: quizScore.score, total: quizScore.totalQuestions } : null;
  const writing = showAddDoubtForm || !selectedDoubt;
  const messageCount = chatMessages.length;

  return (
    <>
      <Workspace
        side={(
          <SideList
            title="Your doubts"
            count={doubts.length}
            action={(
              <button
                type="button"
                onClick={() => { setShowAddDoubtForm(true); setAddDoubtError(null); }}
                aria-pressed={writing}
                className={`${writing ? btn.secondary : btn.primary} w-full`}
              >
                <Icon name="plus" />
                {writing ? 'Writing a new doubt…' : 'New doubt'}
              </button>
            )}
          >
            {doubts.length > 0 ? doubts.map((doubt) => (
              <ListItem
                key={doubt._id}
                active={selectedDoubt?._id === doubt._id && !showAddDoubtForm}
                title={doubt.title}
                meta={`${formatDate(doubt.createdAt)}${doubt.chatHistory?.length ? ` · ${doubt.chatHistory.length} messages` : ''}`}
                onSelect={() => { setSelectedDoubt(doubt); setShowAddDoubtForm(false); setActiveTab('chat'); }}
                onDelete={() => handleDeleteDoubt(doubt._id, doubt.title)}
              />
            )) : <ListEmpty icon="doubt" title="No doubts yet" text="Fill in the form to add your first one." />}
          </SideList>
        )}
      >
        {!writing ? (
          <>
            <ItemFrame
              icon="doubt"
              title={selectedDoubt.title}
              meta={<>
                Asked {formatDate(selectedDoubt.createdAt)}
                {messageCount > 0 && ` · ${messageCount} ${messageCount === 1 ? 'message' : 'messages'}`}
                {selectedDoubt.imageUrl && (
                  <a href={selectedDoubt.imageUrl} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 font-medium text-blue-600 hover:underline">
                    <Icon name="link" className="h-3 w-3" /> Attachment
                  </a>
                )}
              </>}
              tabs={(
                <TabBar
                  size="sm"
                  active={activeTab}
                  onChange={onTab}
                  tabs={[
                    { id: 'chat', label: 'Chat', icon: 'chat' },
                    { id: 'summary', label: 'Summarize', icon: 'summary', busy: isSummarizing },
                    { id: 'quiz', label: 'Quiz', icon: 'quiz', busy: isGeneratingQuiz },
                    { id: 'recommendations', label: 'Videos', icon: 'video', busy: isGettingRecommendations },
                  ]}
                />
              )}
            >
              {activeTab === 'chat' && (
                <ChatPanel
                  messages={chatMessages}
                  sending={isLoading}
                  onSend={handleSendMessage}
                  placeholder="Ask a follow-up question about this doubt…"
                  emptyTitle="Your question"
                  emptyText={selectedDoubt.description}
                  startPrompt={{ label: 'Get an answer', text: selectedDoubt.description }}
                />
              )}

              {activeTab === 'summary' && (
                <TabBody>
                  {isSummarizing ? (
                    <GeneratingState icon="summary" title="Summarizing your doubt" hint="Turning the conversation into a clear, structured summary with a diagram. This usually takes 10-20 seconds." />
                  ) : summary ? (
                    <SummaryView icon="summary" title="Summary" content={summary} />
                  ) : (
                    <EmptyState icon="summary" title="No summary yet" text="Summarize this doubt into a structured recap of the conversation." action={<button type="button" onClick={handleSummarize} className={btn.primary}>Summarize</button>} />
                  )}
                </TabBody>
              )}

              {activeTab === 'quiz' && (
                <TabBody>
                  {isGeneratingQuiz ? (
                    <GeneratingState icon="quiz" title="Building your quiz" hint="Writing questions from what was explained in this doubt. This usually takes 10-30 seconds." />
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
                      <QuizSetup
                        source="doubt"
                        itemId={selectedDoubt._id}
                        topic={selectedDoubt.title}
                        onStart={startQuiz}
                        starting={isGeneratingQuiz}
                        error={quizError}
                        blockedReason={Math.max(chatMessages.length, (selectedDoubt.chatHistory || []).length) < 4
                          ? 'Ask at least two questions in the chat first - the quiz is built from what was explained to you.'
                          : null}
                      />
                    </div>
                  )}
                </TabBody>
              )}

              {activeTab === 'recommendations' && (
                <TabBody>
                  {isGettingRecommendations ? (
                    <GeneratingState icon="video" title="Finding videos for you" hint="Searching YouTube for tutorials that match what you are stuck on." />
                  ) : youtubeRecommendations.length > 0 ? (
                    <div className="h-full overflow-y-auto p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm text-gray-500">{youtubeRecommendations.length} videos picked for this doubt</p>
                        <button type="button" onClick={handleGetRecommendations} className={btn.ghost}>Refresh</button>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {youtubeRecommendations.map((video, index) => (
                          <a key={index} href={video.url} target="_blank" rel="noopener noreferrer" className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md">
                            <div className="relative aspect-video bg-gray-100">
                              {video.thumbnail && <img src={video.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />}
                              {video.duration && video.duration !== 'Unknown' && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">{video.duration}</span>}
                            </div>
                            <div className="p-3">
                              <p className="line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-blue-700">{video.title}</p>
                              {video.description && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{video.description}</p>}
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <EmptyState icon="video" title="No videos yet" text="Get YouTube tutorials picked for this doubt." action={<button type="button" onClick={handleGetRecommendations} className={btn.primary}>Find videos</button>} />
                  )}
                </TabBody>
              )}
            </ItemFrame>
          </>
        ) : (
          <Panel fill>
            <div className="h-full overflow-y-auto">
              <NewDoubtForm
                onSubmit={handleAddDoubt}
                // Cancel only makes sense when there is a doubt to go back to.
                onCancel={selectedDoubt ? () => { setShowAddDoubtForm(false); setAddDoubtError(null); } : undefined}
                submitting={isAddingDoubt}
                error={addDoubtError}
                isFirstDoubt={doubts.length === 0}
              />
            </div>
          </Panel>
        )}
      </Workspace>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
};

export default DoubtClearanceInlineView;
