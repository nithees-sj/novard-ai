import React, { useState, useRef, useEffect } from 'react';
import { Navigationinner } from "../components/navigationinner";
import ChatbotButton from '../components/ChatbotButton';
import axios from 'axios';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;

const Notes = () => {
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
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
  const [toast, setToast] = useState(null);
  const [showQuizConfirm, setShowQuizConfirm] = useState(false);
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
      const userId = localStorage.getItem('userId') || 'temp-user-id';
      const response = await axios.get(`${apiUrl}/notes/${userId}`);
      const notesData = Array.isArray(response.data) ? response.data : [];
      setNotes(notesData);
      if (notesData.length > 0 && !selectedNote) {
        setSelectedNote(notesData[0]);
        setActiveTab('chat');
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
    formData.append('userId', localStorage.getItem('userId') || 'temp-user-id');
    try {
      setIsLoading(true);
      const response = await axios.post(`${apiUrl}/upload-notes`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await loadUserNotes();
      setSelectedNote(response.data);
      setActiveTab('chat');
      showToast('PDF uploaded successfully!', 'success');
    } catch (error) {
      console.error('Error uploading notes:', error);
      showToast('Error uploading notes. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedNote) return;
    const userMessage = { role: 'user', content: newMessage };
    const updatedMessages = [...chatMessages, userMessage];
    setChatMessages(updatedMessages);
    setNewMessage('');
    setIsLoading(true);
    try {
      const response = await axios.post(`${apiUrl}/chat-with-notes`, {
        noteId: selectedNote._id,
        message: newMessage,
        chatHistory: chatMessages
      });
      const botMessage = { role: 'assistant', content: response.data.response };
      const finalMessages = [...updatedMessages, botMessage];
      setChatMessages(finalMessages);
      await loadUserNotes();
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Error sending message. Please try again.');
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

  const handleGenerateQuiz = async () => {
    if (!selectedNote) return;
    setShowQuizConfirm(true);
  };

  const confirmGenerateQuiz = async () => {
    if (!selectedNote) return;
    try {
      setIsGeneratingQuiz(true);
      setActiveTab('quiz');
      setShowQuizConfirm(false);
      const response = await axios.post(`${apiUrl}/generate-quiz`, {
        noteId: selectedNote._id
      });
      setCurrentQuiz(response.data.quiz);
      setCurrentQuizId(response.data.quizId);
      setQuizAnswers({});
      setQuizScore(null);
      await loadUserNotes();
      showToast('Quiz generated successfully!', 'success');
    } catch (error) {
      console.error('Error generating quiz:', error);
      showToast('Error generating quiz. Please try again.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleQuizAnswer = (questionIndex, answer) => {
    setQuizAnswers(prev => ({ ...prev, [questionIndex]: answer }));
  };

  const handleSubmitQuiz = async () => {
    if (!currentQuiz || !currentQuizId) return;
    let correctAnswers = 0;
    currentQuiz.forEach((question, index) => {
      if (quizAnswers[index] === question.correctAnswer) {
        correctAnswers++;
      }
    });
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
    setActiveTab('chat');
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
        setActiveTab('chat');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      showToast('Error deleting note. Please try again.');
    }
  };

  const selectQuiz = (quiz) => {
    setCurrentQuiz(quiz.questions);
    setCurrentQuizId(quiz.quizId);
    setQuizAnswers(quiz.userAnswers || {});
    setQuizScore(quiz.score || null);
  };

  return (
    <>
      <Navigationinner title={"NOTES"} />
      <div className="flex min-h-screen bg-gray-50">
        {/* Main Content */}
        <div className="flex-1 p-6">
          {selectedNote ? (
            <>
              {/* Header */}
              <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900 truncate">{selectedNote.title}</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab('chat')}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'chat'
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      💬 Chat
                    </button>
                    <button
                      onClick={handleSummarize}
                      disabled={isLoading}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'summarizer'
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      📝 Summarize
                    </button>
                    <button
                      onClick={handleGenerateQuiz}
                      disabled={isLoading}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'quiz'
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      🧠 Quiz
                    </button>
                  </div>
                </div>
              </div>

              {/* Chat Tab */}
              {activeTab === 'chat' && (
                <div className="bg-white rounded-lg shadow-md h-[calc(100vh-240px)] flex flex-col">
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {Array.isArray(chatMessages) && chatMessages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] px-4 py-3 rounded-lg text-sm ${message.role === 'user'
                              ? 'bg-gray-900 text-white'
                              : 'bg-gray-100 text-gray-900 border border-gray-200'
                            }`}
                        >
                          <div className="whitespace-pre-wrap break-words">
                            {message.content}
                          </div>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 px-4 py-3 rounded-lg text-sm text-gray-600">
                          Thinking...
                        </div>
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
                        placeholder="Ask a question about your notes..."
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
                        rows="2"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={isLoading || !newMessage.trim()}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary Tab */}
              {activeTab === 'summarizer' && (
                <div className="bg-white rounded-lg shadow-md p-6 h-[calc(100vh-240px)] overflow-y-auto">
                  {isSummarizing ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="text-4xl mb-4">📝</div>
                        <p className="text-sm text-gray-600">Generating summary...</p>
                      </div>
                    </div>
                  ) : summary ? (
                      <div className="prose max-w-none text-sm">
                        {summary}
                    </div>
                  ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <div className="text-4xl mb-4">📝</div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Summary Yet</h3>
                            <p className="text-sm text-gray-600">Click "Summarize" to generate a summary of this note.</p>
                          </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quiz Tab */}
              {activeTab === 'quiz' && (
                <div className="bg-white rounded-lg shadow-md p-6 h-[calc(100vh-240px)] overflow-y-auto">
                  {isGeneratingQuiz ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="text-4xl mb-4">🧠</div>
                        <p className="text-sm text-gray-600">Generating quiz...</p>
                      </div>
                    </div>
                  ) : currentQuiz ? (
                    <>
                      {quizScore ? (
                        <div className="text-center p-8 bg-blue-50 rounded-lg">
                          <div className="text-5xl mb-4">🎯</div>
                          <h3 className="text-2xl font-bold text-gray-900 mb-2">Quiz Complete!</h3>
                          <p className="text-4xl font-bold text-blue-600 mb-4">{quizScore.percentage}%</p>
                          <p className="text-sm text-gray-600 mb-6">
                            You got {quizScore.correct} out of {quizScore.total} questions correct
                          </p>
                          <button
                              onClick={() => {
                                setQuizScore(null);
                                setQuizAnswers({});
                                setCurrentQuiz(null);
                              }}
                              className="px-6 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800"
                            >
                              Try Another Quiz
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
                                      onClick={() => handleQuizAnswer(qIndex, oIndex)}
                                      className={`w-full text-left px-3 py-2 text-sm rounded-md border transition-colors ${quizAnswers[qIndex] === oIndex
                                          ? 'bg-gray-900 text-white border-gray-900'
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
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="text-4xl mb-4">🧠</div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Quiz Yet</h3>
                          <p className="text-sm text-gray-600">Click "Quiz" to generate questions.</p>
                          </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
              <div className="flex items-center justify-center h-[calc(100vh-160px)]">
                <div className="text-center">
                  <div className="text-6xl mb-4">📚</div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Notes</h2>
                  <p className="text-sm text-gray-600">Upload a PDF to start chatting, generate summaries, or create quizzes.</p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">📚 My Notes</h3>
            {sidebarTab === 'notes' && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center text-xl font-bold"
              >
                +
              </button>
            )}
          </div>

          {/* Sidebar Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSidebarTab('notes')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${sidebarTab === 'notes'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              📄 Notes
            </button>
            <button
              onClick={() => setSidebarTab('quizzes')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${sidebarTab === 'quizzes'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              🧠 Quizzes
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Notes List */}
          {sidebarTab === 'notes' && (
            Array.isArray(notes) && notes.length > 0 ? (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note._id || note.id}
                    onClick={() => handleNoteSelect(note)}
                    className={`relative p-3 rounded-lg cursor-pointer transition-all border ${selectedNote?._id === note._id || selectedNote?.id === note.id
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-gray-50 text-gray-900 border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNote(note._id || note.id, note.title);
                      }}
                      className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-red-600 hover:bg-red-50 rounded"
                    >
                      🗑️
                    </button>
                    <div className="font-semibold text-sm mb-1 pr-8 truncate">{note.title}</div>
                    <div className="text-xs opacity-75 mb-2">
                      📅 {new Date(note.uploadedAt).toLocaleDateString()}
                    </div>
                    {note.summary && (
                      <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded inline-block">
                        ✅ Summary
                      </div>
                    )}
                    {note.quizzes && note.quizzes.length > 0 && (
                      <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded inline-block ml-1">
                        🧠 {note.quizzes.length} Quiz{note.quizzes.length > 1 ? 'zes' : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📄</div>
                <p className="text-sm font-semibold text-gray-900 mb-1">No notes yet</p>
                <p className="text-xs text-gray-600">Click + to add your first PDF</p>
              </div>
              )
          )}

          {/* Quizzes List */}
          {sidebarTab === 'quizzes' && (
            selectedNote && selectedNote.quizzes && selectedNote.quizzes.length > 0 ? (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">
                  📚 {selectedNote.title}
                </h4>
                {selectedNote.quizzes.map((quiz, index) => (
                  <div
                    key={quiz.quizId}
                    onClick={() => {
                      selectQuiz(quiz);
                      setActiveTab('quiz');
                    }}
                    className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 border border-gray-200"
                  >
                    <div className="font-semibold text-sm text-gray-900 mb-1">
                      Quiz #{index + 1}
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      📅 {new Date(quiz.createdAt).toLocaleDateString()}
                    </div>
                    {quiz.score && (
                      <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded inline-block">
                        🎯 Score: {quiz.score.percentage}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🧠</div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">
                    {selectedNote ? 'No quizzes yet' : 'Select a note'}
                  </p>
                  <p className="text-xs text-gray-600">
                    {selectedNote ? 'Generate a quiz to see it here' : 'Choose a note from the Notes tab'}
                  </p>
                </div>
              )
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

      {/* Quiz Confirmation */}
      {showQuizConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="text-4xl mb-4">🧠</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Generate Quiz?</h3>
              <p className="text-sm text-gray-600 mb-6">
                Do you want to create a quiz based on "{selectedNote?.title}"?
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

      <ChatbotButton />
    </>
  );
};

export default Notes;
