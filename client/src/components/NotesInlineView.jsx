import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
  Workspace, Panel, ItemFrame, TabBody, TabBar, ChatPanel, GeneratingState, EmptyState, SummaryView,
  QuizRunner, SideList, ListItem, ListEmpty, Badge, Toast, Icon, Spinner, btn, formatDate,
} from './learning/LearningUI';
import QuizSetup from './quiz/QuizSetup';
import { countCorrect } from '../lib/quiz';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;


const NotesInlineView = () => {
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [activeTab, setActiveTab] = useState('read');
  const [summary, setSummary] = useState('');
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [currentQuizId, setCurrentQuizId] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizScore, setQuizScore] = useState(null);
  const [toast, setToast] = useState(null);
  const [quizError, setQuizError] = useState(null);
  const [sidebarTab, setSidebarTab] = useState('notes');
  const fileInputRef = useRef(null);

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    loadUserNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedNote) {
      loadNoteData(selectedNote);
    }
  }, [selectedNote]);

  const loadUserNotes = async () => {
    try {
      const userId = localStorage.getItem('email') || 'temp-user-id';
      const response = await axios.get(`${apiUrl}/notes/${userId}`);
      const notesData = Array.isArray(response.data) ? response.data : [];
      setNotes(notesData);
      if (notesData.length > 0 && !selectedNote) {
        setSelectedNote(notesData[0]);
        setActiveTab('read');
        setTimeout(() => loadNoteData(notesData[0]), 0);
      }
    } catch (error) {
      console.error('Error loading notes:', error);
      setNotes([]);
    }
  };

  const loadNoteData = (note) => {
    if (!note) return;
    setSummary(note.summary || '');
    const chatHistory = Array.isArray(note.chatHistory) ? note.chatHistory : [];
    const cleanedChatHistory = chatHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    setChatMessages(cleanedChatHistory);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      showToast('Please select a PDF file', 'error');
      return;
    }
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast('File size must be less than 2MB', 'error');
      return;
    }
    const existingNote = notes.find(note => note.title === file.name);
    if (existingNote) {
      showToast(`A note with the name "${file.name}" already exists.`, 'error');
      return;
    }
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('title', file.name);
    formData.append('userId', localStorage.getItem('email') || 'temp-user-id');
    try {
      setIsUploading(true);
      const response = await axios.post(`${apiUrl}/upload-notes`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await loadUserNotes();
      setSelectedNote(response.data);
      setActiveTab('read');
      showToast('PDF uploaded successfully!', 'success');
    } catch (error) {
      console.error('Error uploading notes:', error);
      showToast('Error uploading notes. Please try again.', 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Returns false on failure so the chat box can restore what was typed.
  const handleSendMessage = async (messageText) => {
    if (!messageText || !selectedNote) return false;
    const userMessage = { role: 'user', content: messageText };
    const updatedMessages = [...chatMessages, userMessage];
    setChatMessages(updatedMessages);
    setIsLoading(true);
    try {
      const response = await axios.post(`${apiUrl}/chat-with-notes`, {
        noteId: selectedNote._id,
        message: messageText,
        chatHistory: chatMessages
      });
      if (!response.data?.response) throw new Error('Invalid response from server');
      setChatMessages([...updatedMessages, { role: 'assistant', content: response.data.response }]);
      await loadUserNotes();
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Could not send your message. Please try again.');
      setChatMessages(chatMessages);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!selectedNote) return;
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
      await loadUserNotes();
    } catch (error) {
      console.error('Error generating summary:', error);
      showToast('Error generating summary. Please try again.');
    } finally {
      setIsSummarizing(false);
    }
  };

  // "Quiz" opens the setup screen: previous marks on this note + quiz options.
  const handleGenerateQuiz = () => {
    if (!selectedNote) return;
    setActiveTab('quiz');
    setCurrentQuiz(null);
    setQuizScore(null);
    setQuizAnswers({});
    setQuizError(null);
  };

  const confirmGenerateQuiz = async (settings) => {
    if (!selectedNote) return;
    try {
      setIsGeneratingQuiz(true);
      setQuizError(null);
      const response = await axios.post(`${apiUrl}/generate-quiz`, {
        noteId: selectedNote._id,
        ...settings
      });
      setCurrentQuiz(response.data.quiz);
      setCurrentQuizId(response.data.quizId);
      setQuizAnswers({});
      setQuizScore(null);
      await loadUserNotes();
    } catch (error) {
      console.error('Error generating quiz:', error);
      setQuizError(error.response?.data?.error || 'Could not generate the quiz. Please try again.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleQuizAnswer = (questionIndex, answer) => {
    setQuizAnswers(prev => ({ ...prev, [questionIndex]: answer }));
  };

  const handleSubmitQuiz = async () => {
    if (!currentQuiz || !currentQuizId) return;
    // Tolerates old quizzes that stored the answer as a letter; comparing the
    // chosen index against "C" with === made every Notes quiz score 0%.
    const correctAnswers = countCorrect(currentQuiz, quizAnswers);
    const score = Math.round((correctAnswers / currentQuiz.length) * 100);
    const scoreData = {
      correct: correctAnswers,
      total: currentQuiz.length,
      percentage: score
    };
    setQuizScore(scoreData);
    try {
      await axios.post(`${apiUrl}/save-quiz-results`, {
        noteId: selectedNote._id,
        quizId: currentQuizId,
        userAnswers: quizAnswers,
        score: scoreData
      });
      await loadUserNotes();
    } catch (error) {
      console.error('Error saving quiz results:', error);
    }
  };

  const handleNoteSelect = (note) => {
    setActiveTab('read');
    setQuizScore(null);
    setQuizAnswers({});
    setCurrentQuiz(null);
    setSelectedNote(note);
    setTimeout(() => loadNoteData(note), 0);
  };

  const handleDeleteNote = async (noteId, noteTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${noteTitle}"?`)) {
      return;
    }
    try {
      await axios.delete(`${apiUrl}/notes/${noteId}`);
      showToast('Note deleted successfully!', 'success');
      await loadUserNotes();
      if (selectedNote && (selectedNote._id === noteId || selectedNote.id === noteId)) {
        setSelectedNote(null);
        setActiveTab('read');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      showToast('Error deleting note. Please try again.');
    }
  };

  const selectQuiz = (quiz) => {
    setCurrentQuiz(quiz.questions);
    setCurrentQuizId(quiz.quizId);
    setQuizAnswers(Object.fromEntries(Object.entries(quiz.userAnswers || {}).map(([k, v]) => [k, Number(v)])));
    setQuizScore(quiz.score || null);
  };

  const onTab = (id) => {
    if (id === 'read') setActiveTab('read');
    else if (id === 'summarizer') handleSummarize();
    else if (id === 'quiz') handleGenerateQuiz();
  };
  const quizResult = quizScore ? { correct: quizScore.correct, total: quizScore.total } : null;
  const isActive = (note) => selectedNote?._id === note._id || (selectedNote?.id && selectedNote.id === note.id);

  return (
    <>
      <input type="file" ref={fileInputRef} accept=".pdf" onChange={handleFileUpload} className="hidden" />
      <Workspace
        side={(
          <SideList
            title={sidebarTab === 'notes' ? 'Your notes' : 'Quizzes'}
            count={sidebarTab === 'notes' ? notes.length : (selectedNote?.quizzes?.length || 0)}
            action={(
              <div className="space-y-3">
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className={`${btn.primary} w-full`}>
                  {isUploading ? <><Spinner /> Uploading and reading PDF…</> : <><Icon name="upload" /> Upload a PDF</>}
                </button>
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1" role="tablist">
                  {[['notes', 'Notes'], ['quizzes', 'Quizzes']].map(([id, label]) => (
                    <button key={id} type="button" role="tab" aria-selected={sidebarTab === id} onClick={() => setSidebarTab(id)}
                      className={`rounded-md py-1.5 text-sm font-medium transition ${sidebarTab === id ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-600 hover:text-gray-900'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          >
            {sidebarTab === 'notes' ? (
              notes.length > 0 ? notes.map((note) => (
                <ListItem
                  key={note._id || note.id}
                  active={isActive(note)}
                  title={note.title}
                  meta={formatDate(note.uploadedAt)}
                  badges={<>
                    {note.summary && <Badge tone="green">Summary</Badge>}
                    {note.quizzes?.length > 0 && <Badge tone="blue">{note.quizzes.length} {note.quizzes.length === 1 ? 'quiz' : 'quizzes'}</Badge>}
                  </>}
                  onSelect={() => handleNoteSelect(note)}
                  onDelete={() => handleDeleteNote(note._id || note.id, note.title)}
                />
              )) : <ListEmpty icon="book" title="No notes yet" text="Upload a PDF (up to 2 MB) to get started." />
            ) : selectedNote?.quizzes?.length > 0 ? (
              selectedNote.quizzes.map((quiz, index) => (
                <ListItem
                  key={quiz.quizId || index}
                  active={currentQuizId === quiz.quizId && activeTab === 'quiz'}
                  title={`Quiz ${index + 1}`}
                  subtitle={selectedNote.title}
                  meta={formatDate(quiz.createdAt)}
                  badges={quiz.score?.total
                    ? <Badge tone={quiz.score.percentage >= 70 ? 'green' : 'amber'}>{quiz.score.percentage}%</Badge>
                    : <Badge>Not taken</Badge>}
                  onSelect={() => { selectQuiz(quiz); setActiveTab('quiz'); }}
                />
              ))
            ) : (
              <ListEmpty icon="quiz" title={selectedNote ? 'No quizzes yet' : 'Select a note'} text={selectedNote ? 'Open the Quiz tab to create one.' : 'Choose a note from the Notes tab.'} />
            )}
          </SideList>
        )}
      >
        {selectedNote ? (
          <>
            <ItemFrame
              icon="book"
              title={selectedNote.title}
              meta={`PDF notes · uploaded ${formatDate(selectedNote.uploadedAt)}`}
              tabs={(
                <TabBar
                  size="sm"
                  active={activeTab}
                  onChange={onTab}
                  tabs={[
                    { id: 'read', label: 'Chat', icon: 'chat' },
                    { id: 'summarizer', label: 'Summary', icon: 'summary', busy: isSummarizing },
                    { id: 'quiz', label: 'Quiz', icon: 'quiz', busy: isGeneratingQuiz },
                  ]}
                />
              )}
            >
              {activeTab === 'read' && (
                <ChatPanel
                  messages={chatMessages}
                  sending={isLoading}
                  onSend={handleSendMessage}
                  placeholder="Ask a question about your notes…"
                  emptyTitle="Chat with your notes"
                  emptyText="Ask anything about this PDF - the answers come from its content."
                  suggestions={['Summarise the main topics', 'Explain the hardest concept simply', 'What might come up in an exam?']}
                />
              )}

              {activeTab === 'summarizer' && (
                <TabBody>
                  {isSummarizing ? (
                    <GeneratingState icon="summary" title="Summarising your notes" hint="Reading the PDF and writing a structured summary with a diagram. Longer notes can take up to 30 seconds." />
                  ) : summary ? (
                    <SummaryView icon="summary" title="Summary" content={summary} />
                  ) : (
                    <EmptyState icon="summary" title="No summary yet" text="Generate a structured summary of this note." action={<button type="button" onClick={handleSummarize} className={btn.primary}>Generate summary</button>} />
                  )}
                </TabBody>
              )}

              {activeTab === 'quiz' && (
                <TabBody>
                  {isGeneratingQuiz ? (
                    <GeneratingState icon="quiz" title="Building your quiz" hint="Writing questions from across your notes. This usually takes 10-30 seconds." />
                  ) : currentQuiz ? (
                    <QuizRunner
                      questions={currentQuiz}
                      answers={quizAnswers}
                      onAnswer={handleQuizAnswer}
                      onSubmit={handleSubmitQuiz}
                      result={quizResult}
                      onRetry={handleGenerateQuiz}
                    />
                  ) : (
                    <div className="h-full overflow-y-auto p-6">
                      <QuizSetup source="notes" itemId={selectedNote._id} topic={selectedNote.title} onStart={confirmGenerateQuiz} starting={isGeneratingQuiz} error={quizError} />
                    </div>
                  )}
                </TabBody>
              )}
            </ItemFrame>
          </>
        ) : (
          <Panel fill>
            <EmptyState icon="book" title="Welcome to Notes & Quiz" text="Upload a PDF to chat with it, get a summary and test yourself with a quiz."
              action={<button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className={btn.primary}>{isUploading ? <><Spinner /> Uploading…</> : <><Icon name="upload" /> Upload your first PDF</>}</button>} />
          </Panel>
        )}
      </Workspace>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
};

export default NotesInlineView;
