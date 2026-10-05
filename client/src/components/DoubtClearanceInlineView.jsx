import React, { useState, useEffect } from 'react';
import { api, errorMessage, LONG_AI_TIMEOUT_MS } from '../lib/api';
import logger from '../lib/logger';
import { currentEmail } from '../lib/session';
import { useReportProblem } from '../context/ReportContext';
import NewDoubtForm from './NewDoubtForm';
import {
  Workspace, ItemFrame, TabBody, TabBar, ChatPanel, GeneratingState, EmptyState, SummaryView,
  QuizRunner, LoadingPanel, SideList, ListItem, ListEmpty, Toast, Icon, btn, formatDate, useToastTimer } from './learning/LearningUI';
import confirm from './ui/confirm';
import QuizSetup from './quiz/QuizSetup';
import { countCorrect } from '../lib/quiz';
import { readOpenParam, clearOpenParam } from '../lib/openParam';



const DoubtClearanceInlineView = () => {
  const [openId] = useState(readOpenParam); // ?open=<id>, e.g. from the Novard Agent
  const [doubts, setDoubts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedDoubt, setSelectedDoubt] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizError, setQuizError] = useState(null);
  const [isGettingRecommendations, setIsGettingRecommendations] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [summary, setSummary] = useState('');
  // "Report a problem" on an AI answer, the summary or a quiz question.
  const openReport = useReportProblem();
  const reportSource = (itemType, extra) => ({ tool: 'doubts', itemType, itemId: selectedDoubt?._id, ...extra });
  const reportMessage = (m, i) => openReport({ area: 'doubts', source: reportSource('doubt_chat', { messageIndex: i, excerpt: m.content }) });
  const reportSummary = () => openReport({ area: 'doubts', source: reportSource('doubt_summary', { excerpt: summary }) });
  const reportQuestion = (q) => openReport({ area: 'quizzes', source: reportSource('doubt_quiz', { excerpt: q.question }) });
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [currentQuizId, setCurrentQuizId] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizScore, setQuizScore] = useState(null);
  const [youtubeRecommendations, setYoutubeRecommendations] = useState([]);
  const [showAddDoubtForm, setShowAddDoubtForm] = useState(false);
  const [toast, setToast] = useState(null);
  const [addDoubtError, setAddDoubtError] = useState(null);
  const [isAddingDoubt, setIsAddingDoubt] = useState(false);

  const showToast = useToastTimer(setToast);

  // Reloads the list and keeps the open doubt in step with it; returns the list.
  const loadUserDoubts = async () => {
    try {
      const response = await api.get(`/doubt-clearances/${encodeURIComponent(currentEmail())}`);
      const doubtsData = Array.isArray(response.data) ? response.data : [];
      setDoubts(doubtsData);
      const target = openId && doubtsData.find((item) => item._id === openId);
      if (target) {
        setSelectedDoubt(target);
        clearOpenParam();
      } else {
        setSelectedDoubt((current) => (current
          ? doubtsData.find((d) => d._id === current._id) || current
          : doubtsData[0] || null));
      }
      return doubtsData;
    } catch (error) {
      logger.error('Error loading doubts', error);
      showToast(errorMessage(error, 'Could not load your doubts.'), 'error');
      return [];
    } finally {
      setLoaded(true);
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
      const userId = currentEmail();
      const { data: created } = await api.post('/doubt-clearances', { description, imageUrl, userId });
      await loadUserDoubts();
      // Open the new doubt and put the question to the tutor straight away,
      // so the chat starts with the student's own words and an answer.
      setSelectedDoubt({ ...created, chatHistory: [{ role: 'user', content: description }] });
      setActiveTab('chat');
      setShowAddDoubtForm(false);
      handleSendMessage(description, created, { echo: false });
      return true;
    } catch (error) {
      logger.error('Error adding doubt', error);
      setAddDoubtError(errorMessage(error, 'Could not add the doubt. Please try again.'));
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
      const response = await api.post(`/chat-with-doubt-clearance`, {
        doubtId: doubt._id,
        message: userMessage,
        userId: currentEmail()
      });
      const aiResponse = { role: 'assistant', content: response.data.response, timestamp: new Date() };
      setChatMessages(prev => [...prev, aiResponse]);
      loadUserDoubts(); // refresh the list in the background - the result is already on screen
    } catch (error) {
      logger.error('Error sending message', error);
      showToast(errorMessage(error, 'Could not send your message. Please try again.'), 'error');
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
      const response = await api.post(`/summarize-doubt-clearance`, {
        doubtId: selectedDoubt._id,
        userId: currentEmail()
      }, { timeout: LONG_AI_TIMEOUT_MS });
      setSummary(response.data.summary);
      loadUserDoubts(); // refresh the list in the background - the result is already on screen
    } catch (error) {
      logger.error('Error summarizing doubt', error);
      showToast(errorMessage(error, 'Error generating summary'), 'error');
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
      const response = await api.post(`/generate-doubt-quiz`, {
        doubtId: selectedDoubt._id,
        userId: currentEmail(),
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
      loadUserDoubts(); // refresh the list in the background - the result is already on screen
    } catch (error) {
      logger.error('Error generating quiz', error);
      setQuizError(errorMessage(error, 'Could not generate the quiz. Please try again.'));
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleGetRecommendations = async () => {
    if (!selectedDoubt) return;
    setActiveTab('recommendations');
    setIsGettingRecommendations(true);
    try {
      const response = await api.post(`/get-youtube-recommendations`, {
        doubtId: selectedDoubt._id,
        userId: currentEmail()
      });
      setYoutubeRecommendations(response.data.recommendations);
      loadUserDoubts(); // refresh the list in the background - the result is already on screen
    } catch (error) {
      logger.error('Error getting recommendations', error);
      showToast(errorMessage(error, 'Error getting recommendations'), 'error');
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
      await api.post(`/save-doubt-quiz-results`, {
        doubtId: selectedDoubt._id,
        quizIndex: currentQuizId,
        score,
        userId: currentEmail()
      });
      await loadUserDoubts();
    } catch (error) {
      logger.error('Error saving quiz results', error);
      showToast(errorMessage(error, 'Your score could not be saved.'), 'error');
    }
  };

  const handleDeleteDoubt = async (doubtId, doubtTitle) => {
    if (!(await confirm({ title: 'Delete this doubt?', message: `“${doubtTitle}” and everything made from it (chat, summary, quizzes) will be removed.`, confirmLabel: 'Delete', danger: true }))) {
      return;
    }
    try {
      await api.delete(`/doubt-clearances/${doubtId}`, {
        data: { userId: currentEmail() }
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
      logger.error('Error deleting doubt', error);
      showToast(errorMessage(error, 'Error deleting doubt'), 'error');
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
  // The form opens by itself only once we know there is no doubt to show.
  const writing = showAddDoubtForm || (loaded && !selectedDoubt);
  const messageCount = chatMessages.length;

  return (
    <>
      <Workspace
        side={(
          <SideList
            loading={!loaded}
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
        {!writing && !selectedDoubt ? (
          <LoadingPanel label="Loading your doubts…" />
        ) : !writing ? (
          <>
            <ItemFrame
              icon="doubt"
              title={selectedDoubt.title}
              meta={<>
                Asked {formatDate(selectedDoubt.createdAt)}
                {messageCount > 0 && ` · ${messageCount} ${messageCount === 1 ? 'message' : 'messages'}`}
                {selectedDoubt.imageUrl && (
                  <a href={selectedDoubt.imageUrl} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 font-medium text-accent-fg hover:underline">
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
                  onReport={reportMessage}
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
                    <GeneratingState icon="summary" title="Summarizing your doubt" hint="Turning the conversation into a clear, structured summary with a diagram. Long conversations can take a minute or more." />
                  ) : summary ? (
                    <SummaryView icon="summary" title="Summary" content={summary} onReport={reportSummary} />
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
                      onReport={reportQuestion}
                      questions={currentQuiz}
                      answers={quizAnswers}
                      onAnswer={(qi, oi) => setQuizAnswers((prev) => ({ ...prev, [qi]: oi }))}
                      onSubmit={handleSubmitQuiz}
                      result={quizResult}
                      onRetry={handleGenerateQuiz}
                    />
                  ) : (
                    <div className="h-full overflow-y-auto px-6 py-8">
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
                        <p className="text-small text-fg-subtle">{youtubeRecommendations.length} videos picked for this doubt</p>
                        <button type="button" onClick={handleGetRecommendations} className={btn.ghost}><Icon name="refresh" /> Refresh</button>
                      </div>
                      <div className="grid gap-x-5 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
                        {youtubeRecommendations.map((video, index) => (
                          <a key={index} href={video.url} target="_blank" rel="noopener noreferrer" className="group block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                            <div className="relative aspect-video overflow-hidden rounded-lg bg-sunken ring-1 ring-line-subtle">
                              {video.thumbnail && (
                              <img
                                src={video.thumbnail}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                                // Older saved results point at maxresdefault.jpg, which many videos lack.
                                onError={(e) => {
                                  const img = e.currentTarget;
                                  if (/maxresdefault\.jpg$/.test(img.src)) img.src = img.src.replace('maxresdefault', 'hqdefault');
                                  else img.style.visibility = 'hidden';
                                }}
                              />
                            )}
                              {video.duration && video.duration !== 'Unknown' && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-micro font-medium text-white">{video.duration}</span>}
                            </div>
                            <div className="pt-2.5">
                              <p className="line-clamp-2 text-body font-medium text-fg group-hover:text-accent-fg">{video.title}</p>
                              {video.description && <p className="mt-1 line-clamp-2 text-small text-fg-subtle">{video.description}</p>}
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
          <NewDoubtForm
            onSubmit={handleAddDoubt}
            // Cancel only makes sense when there is a doubt to go back to.
            onCancel={selectedDoubt ? () => { setShowAddDoubtForm(false); setAddDoubtError(null); } : undefined}
            submitting={isAddingDoubt}
            error={addDoubtError}
            isFirstDoubt={doubts.length === 0}
          />
        )}
      </Workspace>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
};

export default DoubtClearanceInlineView;
