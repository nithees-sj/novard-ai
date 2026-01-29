import React, { useState, useEffect, useCallback } from 'react';
import { Navigationinner } from "../components/navigationinner";
import ChatbotButton from '../components/ChatbotButton';
import axios from 'axios';
import { MdDeleteOutline, MdAdd } from "react-icons/md";

const apiUrl = process.env.REACT_APP_API_ENDPOINT;

const CircularProgress = ({ value, size = 40, strokeWidth = 4 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#e5e7eb"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#2563eb"
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
};

const SkillUnlocker = () => {
  const [plans, setPlans] = useState([]);
  const [currentView, setCurrentView] = useState('welcome'); // 'welcome', 'form', 'planner', 'quiz', 'quiz-config'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshingVideo, setRefreshingVideo] = useState(null); // dayNumber being refreshed
  
  // Track video interactions
  const [videoInteracted, setVideoInteracted] = useState(new Set());

  // Form state
  const [formData, setFormData] = useState({
    skillName: '',
    duration: 10,
    description: '',
    level: 'beginner',
    focusAreas: '',
    language: 'English',
    teachingStyle: 'Standard'
  });

  // Current Plan state
  const [currentPlan, setCurrentPlan] = useState(null);
  const [completedDays, setCompletedDays] = useState(new Set());

  // Quiz state
  const [quiz, setQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizScore, setQuizScore] = useState(null);
  const [quizConfig, setQuizConfig] = useState({
    questionCount: 10,
    difficulty: 'intermediate'
  });
  const [customQuestionCount, setCustomQuestionCount] = useState('');

  const userId = localStorage.getItem('userId') || 'demo-user';

  const fetchPlans = useCallback(async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/skill-unlocker/plans/${userId}`);
      setPlans(response.data.plans);
    } catch (err) {
      console.error('Error fetching plans:', err);
    }
  }, [userId]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Sync completion/interaction state when currentPlan changes
  useEffect(() => {
    if (currentPlan) {
      // Re-initialize completed days
      const completed = new Set();
      if (currentPlan.dailyPlan) {
        currentPlan.dailyPlan.forEach(day => {
          if (day.completed) completed.add(day.day);
        });
      }
      setCompletedDays(completed);
      
      // Reset interaction tracking when switching plans
      // (Assuming persistency of "watched" isn't strictly required by backend yet, 
      // but UI logic requires interaction valid per session or per day if already completed)
      // If a day is already completed, we consider it "interacted" implicitly for UI consistency
      const interacted = new Set();
      if (currentPlan.dailyPlan) {
        currentPlan.dailyPlan.forEach(day => {
          if (day.completed) interacted.add(day.day);
        });
      }
      setVideoInteracted(interacted);
    }
  }, [currentPlan]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGeneratePlan = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const preferences = {
        level: formData.level,
        focusAreas: formData.focusAreas.split(',').map(area => area.trim()).filter(Boolean),
        language: formData.language,
        teachingStyle: formData.teachingStyle
      };

      const response = await axios.post(`${apiUrl}/api/skill-unlocker/generate-plan`, {
        skillName: formData.skillName,
        duration: parseInt(formData.duration),
        description: formData.description,
        preferences,
        userId
      });

      const newPlan = response.data;
      setCurrentPlan(newPlan);
      setCurrentView('planner');
      fetchPlans();

      setFormData({
        skillName: '',
        duration: 10,
        description: '',
        level: 'beginner',
        focusAreas: '',
        language: 'English',
        teachingStyle: 'Standard'
      });

    } catch (err) {
      console.error('Error generating plan:', err);
      setError(err.response?.data?.error || 'Failed to generate learning plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planSummary) => {
      setCurrentPlan(planSummary);
      setQuiz(null);
      setQuizAnswers({});
      setQuizScore(null);
       if (planSummary.quizScore) {
          setQuizScore({ percentage: planSummary.quizScore });
      }
      setCurrentView('planner');
  };

  const handleDeletePlan = async (e, planId) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this skill plan? This cannot be undone.')) {
      try {
        await axios.delete(`${apiUrl}/api/skill-unlocker/plans/${planId}`);
        if (currentPlan && (currentPlan.planId === planId || currentPlan._id === planId)) {
            setCurrentPlan(null);
            setCurrentView('form');
        }
        fetchPlans();
      } catch (err) {
        console.error('Error deleting plan:', err);
      }
    }
  };

  const handleVideoClick = (dayNumber) => {
      setVideoInteracted(prev => new Set(prev).add(dayNumber));
  };

  const handleRefreshVideo = async (dayNumber) => {
    setRefreshingVideo(dayNumber);
    try {
        const response = await axios.post(`${apiUrl}/api/skill-unlocker/refresh-video`, {
            planId: currentPlan.planId || currentPlan._id,
            dayNumber
        });
        
        // Update local state with new video
        setCurrentPlan(prev => ({
            ...prev,
            dailyPlan: prev.dailyPlan.map(day => 
                day.day === dayNumber ? { ...day, youtubeVideo: response.data.youtubeVideo } : day
            )
        }));
        
    } catch (err) {
        console.error('Error refreshing video:', err);
        alert('Failed to refresh video. Please try again.');
    } finally {
        setRefreshingVideo(null);
    }
  };

  const handleDayComplete = async (dayNumber) => {
    // Only allow if interacted or already completed (to undo)
    if (!videoInteracted.has(dayNumber) && !completedDays.has(dayNumber)) return;

    // Optimistic update
    setCompletedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dayNumber)) {
        newSet.delete(dayNumber);
      } else {
        newSet.add(dayNumber);
      }
      return newSet;
    });

    try {
        await axios.post(`${apiUrl}/api/skill-unlocker/toggle-day-completion`, {
            planId: currentPlan.planId || currentPlan._id, 
            dayNumber,
            userId
        });
        fetchPlans(); 
    } catch (err) {
        console.error('Error toggling day:', err);
    }
  };


  const handleShowQuizConfig = () => {
    // Check if at least one day is completed
    if (completedDays.size === 0) {
      setError('Please complete at least one day of learning before taking the quiz.');
      return;
    }
    setError(null);
    setCurrentView('quiz-config');
  };

  const handleGenerateQuiz = async () => {
    setLoading(true);
    setError(null);

    try {
      const finalQuestionCount = quizConfig.questionCount === 'custom' 
        ? parseInt(customQuestionCount) || 10
        : quizConfig.questionCount;

      const response = await axios.post(`${apiUrl}/api/skill-unlocker/generate-quiz`, {
        planId: currentPlan.planId || currentPlan._id,
        skillName: currentPlan.skillName,
        userId,
        questionCount: finalQuestionCount,
        difficulty: quizConfig.difficulty
      });

      setQuiz(response.data);
      setCurrentView('quiz');
    } catch (err) {
      console.error('Error generating quiz:', err);
      setError(err.response?.data?.error || 'Failed to generate quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuizAnswer = (questionIndex, answerIndex) => {
    setQuizAnswers(prev => ({ ...prev, [questionIndex]: answerIndex }));
  };

  const handleSubmitQuiz = async () => {
    let correct = 0;
    quiz.questions.forEach((question, index) => {
      if (quizAnswers[index] === question.correctAnswer) {
        correct++;
      }
    });

    const score = Math.round((correct / quiz.questions.length) * 100);
    setQuizScore({ percentage: score, correct, total: quiz.questions.length });

    try {
      await axios.post(`${apiUrl}/api/skill-unlocker/save-quiz-result`, {
        quizId: quiz.quizId,
        planId: currentPlan.planId || currentPlan._id,
        userId,
        score,
        totalQuestions: quiz.questions.length,
        questionCount: quiz.configuration?.questionCount || quiz.questions.length,
        difficulty: quiz.configuration?.difficulty || 'intermediate'
      });
      fetchPlans();
    } catch (err) {
      console.error('Error saving quiz result:', err);
    }
  };

  const handleAddNewSkill = () => {
    setCurrentView('form');
    setCurrentPlan(null);
    setCompletedDays(new Set());
    setQuiz(null);
    setQuizAnswers({});
    setQuizScore(null);
     setFormData({
      skillName: '',
      duration: 10,
      description: '',
      level: 'beginner',
      focusAreas: '',
      language: 'English',
      teachingStyle: 'Standard'
    });
  };

  return (
    <>
      <Navigationinner title={"SKILL UNLOCKER"} />
      <div className="flex h-[calc(100vh-64px)] bg-gray-50">
        
        {/* Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10">
            <div className="p-5 border-b border-gray-100">
                <button 
                  onClick={handleAddNewSkill}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-semibold transition-colors shadow-sm"
                >
                    <MdAdd size={20} />
                    <span>Add New Skill</span>
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {plans.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <p className="text-sm">No skills yet.</p>
                        <p className="text-xs mt-1">Add one to get started!</p>
                    </div>
                ) : (
                    plans.map((plan) => (
                        <div 
                          key={plan.planId || plan._id}
                          onClick={() => handleSelectPlan(plan)}
                          className={`group relative p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
                              (currentPlan && (currentPlan.planId === plan.planId || currentPlan.planId === plan._id || currentPlan._id === plan.planId || currentPlan._id === plan._id))
                              ? 'bg-blue-50/50 border-blue-200 shadow-sm border-l-4 border-l-blue-600' 
                              : 'bg-white border-gray-100 hover:border-gray-200 border-l-4 border-l-transparent'
                          }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <h3 className={`font-semibold text-sm truncate pr-2 ${
                                         (currentPlan && (currentPlan.planId === plan.planId || currentPlan.planId === plan._id || currentPlan._id === plan.planId || currentPlan._id === plan._id))
                                         ? 'text-blue-800'
                                         : 'text-gray-800'
                                    }`}>
                                        {plan.skillName}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                            {plan.duration} days
                                        </span>
                                        {plan.quizCompleted && (
                                            <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full border border-yellow-100">
                                                ★ Quiz Done
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                     <CircularProgress value={plan.progress} size={36} strokeWidth={3} />
                                     <span className="text-[10px] font-medium text-gray-500">{plan.progress}%</span>
                                </div>
                            </div>
                            
                            <button
                                onClick={(e) => handleDeletePlan(e, plan.planId || plan._id)}
                                className="absolute -top-2 -right-2 bg-white text-gray-400 hover:text-red-500 p-1.5 rounded-full shadow-sm border border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete Plan"
                            >
                                <MdDeleteOutline size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-5xl mx-auto">
            
            {/* Header */}
            {currentView !== 'welcome' && (
                <div className="mb-8 pl-1">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    {currentView === 'form' && 'Create New Skill Plan'}
                    {currentView === 'planner' && currentPlan?.skillName}
                    {currentView === 'quiz-config' && 'Configure Your Quiz'}
                    {currentView === 'quiz' && 'Skill Assessment Quiz'}
                </h2>
                <p className="text-gray-600">
                    {currentView === 'form' && 'Define your learning goals and let AI structure your journey.'}
                    {currentView === 'planner' && `${currentPlan?.duration || 0}-day personalized learning journey`}
                    {currentView === 'quiz-config' && 'Customize your assessment experience'}
                    {currentView === 'quiz' && 'Test your understanding of the concepts learned'}
                </p>
                </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm flex items-center gap-2">
                 <span>❌</span> {error}
              </div>
            )}

            {/* WELCOME VIEW */}
            {currentView === 'welcome' && plans.length === 0 && (
                <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                        <span className="text-4xl">🚀</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Skill Unlocker</h2>
                    <p className="text-gray-500 max-w-md mb-8">
                        Start your journey by adding a skill you want to master. We'll create a personalized day-by-day plan for you.
                    </p>
                    <button 
                        onClick={() => setCurrentView('form')}
                        className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
                    >
                        Create Your First Plan
                    </button>
                </div>
            )}
             
             {/* WELCOME VIEW (With existing plans) */}
            {currentView === 'welcome' && plans.length > 0 && (
                <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">Welcome Back!</h2>
                    <p className="text-gray-500 max-w-md mb-8">
                        Select a skill from the sidebar to continue learning or create a new one.
                    </p>
                     <div className="w-64 h-64 bg-gray-100 rounded-full flex items-center justify-center opacity-50">
                        <span className="text-6xl grayscale">📚</span>
                    </div>
                </div>
            )}


            {/* FORM VIEW */}
            {currentView === 'form' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-3xl mx-auto">
                <form onSubmit={handleGeneratePlan} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Skill Name *
                    </label>
                    <input
                      type="text"
                      name="skillName"
                      value={formData.skillName}
                      onChange={handleInputChange}
                      placeholder="e.g., Python, Graphic Design, Public Speaking"
                      className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Duration *
                        </label>
                        <select
                          name="duration"
                          value={formData.duration}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                        >
                          <option value={10}>10 Days (Sprint)</option>
                          <option value={15}>15 Days (Crash Course)</option>
                          <option value={20}>20 Days (Standard)</option>
                          <option value={25}>25 Days (In-depth)</option>
                          <option value={30}>30 Days (Mastery)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Level
                        </label>
                        <select
                          name="level"
                          value={formData.level}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                        >
                          <option value="beginner">Beginner (Start from zero)</option>
                          <option value="intermediate">Intermediate (Refine skills)</option>
                        </select>
                      </div>
                  </div>

                  {/* PREFERENCES */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-2">
                          Preferred Language
                        </label>
                        <select
                          name="language"
                          value={formData.language}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                        >
                          <option value="English">English</option>
                          <option value="Spanish">Spanish</option>
                          <option value="French">French</option>
                          <option value="Hindi">Hindi</option>
                          <option value="Tamil">Tamil</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-2">
                          Teaching Style
                        </label>
                        <select
                          name="teachingStyle"
                          value={formData.teachingStyle}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                        >
                          <option value="Standard">Standard (Balanced)</option>
                          <option value="Fast-paced">Fast-paced / Crash Course</option>
                          <option value="In-depth">Deep Dive / Theoretical</option>
                          <option value="Practical">Hands-on / Project Based</option>
                        </select>
                      </div>
                  </div>


                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Goal & Focus *
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="What exactly do you want to achieve?"
                      className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[120px] resize-vertical"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Specific Topics (Optional)
                    </label>
                    <input
                      type="text"
                      name="focusAreas"
                      value={formData.focusAreas}
                      onChange={handleInputChange}
                      placeholder="e.g., pandas, numpy, visualization"
                      className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                  >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                            Designing your curriculum...
                        </span>
                    ) : '🚀 Generate Learning Plan'}
                  </button>
                </form>
              </div>
            )}

            {/* QUIZ CONFIGURATION VIEW */}
            {currentView === 'quiz-config' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-2xl mx-auto">
                <div className="space-y-8">
                  {/* Question Count Section */}
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-4">
                      Number of Questions
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {[5, 10, 15].map(count => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setQuizConfig(prev => ({ ...prev, questionCount: count }))}
                          className={`p-4 rounded-xl border-2 transition-all text-left ${
                            quizConfig.questionCount === count
                              ? 'border-indigo-600 bg-indigo-50 shadow-sm'
                              : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              quizConfig.questionCount === count
                                ? 'border-indigo-600 bg-indigo-600'
                                : 'border-gray-300'
                            }`}>
                              {quizConfig.questionCount === count && (
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              )}
                            </div>
                            <span className="font-semibold text-gray-900">{count} Questions</span>
                          </div>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setQuizConfig(prev => ({ ...prev, questionCount: 'custom' }))}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                          quizConfig.questionCount === 'custom'
                            ? 'border-indigo-600 bg-indigo-50 shadow-sm'
                            : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            quizConfig.questionCount === 'custom'
                              ? 'border-indigo-600 bg-indigo-600'
                              : 'border-gray-300'
                          }`}>
                            {quizConfig.questionCount === 'custom' && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                          <span className="font-semibold text-gray-900">Custom</span>
                        </div>
                      </button>
                    </div>
                    
                    {quizConfig.questionCount === 'custom' && (
                      <div className="mt-3">
                        <input
                          type="number"
                          min="5"
                          max="20"
                          value={customQuestionCount}
                          onChange={(e) => setCustomQuestionCount(e.target.value)}
                          placeholder="Enter number (5-20)"
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Difficulty Level Section */}
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-4">
                      Difficulty Level
                    </label>
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setQuizConfig(prev => ({ ...prev, difficulty: 'beginner' }))}
                        className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                          quizConfig.difficulty === 'beginner'
                            ? 'border-green-500 bg-green-50 shadow-sm'
                            : 'border-gray-200 hover:border-green-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                            quizConfig.difficulty === 'beginner'
                              ? 'border-green-500 bg-green-500'
                              : 'border-gray-300'
                          }`}>
                            {quizConfig.difficulty === 'beginner' && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-gray-900 mb-1">Beginner</div>
                            <div className="text-sm text-gray-600">Definitions, basic concepts, and concept recognition</div>
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQuizConfig(prev => ({ ...prev, difficulty: 'intermediate' }))}
                        className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                          quizConfig.difficulty === 'intermediate'
                            ? 'border-blue-500 bg-blue-50 shadow-sm'
                            : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                            quizConfig.difficulty === 'intermediate'
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-gray-300'
                          }`}>
                            {quizConfig.difficulty === 'intermediate' && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-gray-900 mb-1">Intermediate</div>
                            <div className="text-sm text-gray-600">Application, comparisons, and simple problem-solving</div>
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQuizConfig(prev => ({ ...prev, difficulty: 'advanced' }))}
                        className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                          quizConfig.difficulty === 'advanced'
                            ? 'border-purple-500 bg-purple-50 shadow-sm'
                            : 'border-gray-200 hover:border-purple-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                            quizConfig.difficulty === 'advanced'
                              ? 'border-purple-500 bg-purple-500'
                              : 'border-gray-300'
                          }`}>
                            {quizConfig.difficulty === 'advanced' && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-gray-900 mb-1">Advanced</div>
                            <div className="text-sm text-gray-600">Scenario-based, reasoning, and practical decision questions</div>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Progress Info */}
                  {currentPlan && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-indigo-700">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm font-medium">
                          Quiz will only cover the {completedDays.size} day{completedDays.size !== 1 ? 's' : ''} you've completed
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-4 pt-4">
                    <button
                      onClick={() => setCurrentView('planner')}
                      className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGenerateQuiz}
                      disabled={loading || (quizConfig.questionCount === 'custom' && (!customQuestionCount || customQuestionCount < 5 || customQuestionCount > 20))}
                      className="flex-1 px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                          Generating...
                        </span>
                      ) : '🚀 Generate Quiz'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PLANNER VIEW */}
            {currentView === 'planner' && currentPlan && (
              <div className="animate-fade-in">
                {/* Progress Stats */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8 flex items-center justify-between">
                   <div>
                       <h3 className="text-lg font-bold text-gray-900">Your Progress</h3>
                       <p className="text-gray-500 text-sm mt-1">{completedDays.size} of {currentPlan.duration} days completed</p>
                   </div>
                   <div className="flex items-center gap-4">
                       <CircularProgress value={Math.round((completedDays.size / currentPlan.duration) * 100)} size={60} strokeWidth={5} />
                       <div className="text-3xl font-bold text-blue-600">
                           {Math.round((completedDays.size / currentPlan.duration) * 100)}%
                       </div>
                   </div>
                </div>

                {/* Day Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
                  {currentPlan.dailyPlan?.map((day) => (
                    <div
                      key={day.day}
                      className={`relative overflow-hidden bg-white rounded-xl p-5 border transition-all hover:shadow-md ${
                        completedDays.has(day.day) 
                          ? 'border-green-200 bg-green-50/30' 
                          : 'border-gray-100'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                             completedDays.has(day.day) ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                          Day {day.day}
                        </span>
                         {completedDays.has(day.day) && (
                             <div className="bg-green-500 text-white rounded-full p-1">
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                     <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                 </svg>
                             </div>
                        )}
                      </div>

                      <h3 className={`font-bold text-gray-900 mb-2 line-clamp-2 min-h-[48px] ${completedDays.has(day.day) ? 'opacity-80' : ''}`}>
                        {day.topic}
                      </h3>

                      <p className="text-sm text-gray-600 mb-4 line-clamp-3 leading-relaxed min-h-[60px]">
                        {day.objective}
                      </p>

                      <div className="mt-auto">
                        {day.youtubeVideo && (
                            <div className="mb-4 group relative">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                                  <span>Recommended Video</span>
                                </h4>
                                
                                <div className="relative rounded-lg overflow-hidden bg-gray-900 aspect-video shadow-sm hover:shadow-md transition-shadow">
                                    {/* Thumbnail or Placeholder */}
                                    {day.youtubeVideo.thumbnailUrl ? (
                                        <img 
                                            src={day.youtubeVideo.thumbnailUrl} 
                                            alt={day.youtubeVideo.title}
                                            className="absolute inset-0 w-full h-full object-cover"
                                        />
                                    ) : (
                                        <>
                                            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 opacity-90"></div>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                               <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                                    <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent ml-1"></div>
                                               </div>
                                            </div>
                                        </>
                                    )}
                                    
                                    {/* Video Info Overlay */}
                                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                                        <p className="text-white text-xs font-medium line-clamp-2 leading-snug">
                                            {day.youtubeVideo.title}
                                        </p>
                                    </div>

                                    {/* Actions Overlay */}
                                    <div className="absolute top-2 right-2 flex gap-2 z-10">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRefreshVideo(day.day);
                                            }}
                                            disabled={refreshingVideo === day.day}
                                            className="p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-colors disabled:opacity-50"
                                            title="Get new recommendation"
                                        >
                                            <span className={`block ${refreshingVideo === day.day ? 'animate-spin' : ''}`}>↻</span>
                                        </button>
                                    </div>

                                    {/* Click Handler Overlay */}
                                    <a 
                                        href={day.youtubeVideo.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        onClick={() => handleVideoClick(day.day)}
                                        className="absolute inset-0 z-0"
                                    ></a>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => handleDayComplete(day.day)}
                            disabled={!videoInteracted.has(day.day) && !completedDays.has(day.day)}
                            className={`w-full py-2.5 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${
                            completedDays.has(day.day)
                                ? 'bg-white border-2 border-gray-200 text-gray-500 hover:border-gray-300'
                                : videoInteracted.has(day.day)
                                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                            title={!videoInteracted.has(day.day) && !completedDays.has(day.day) ? "Please interact with the video to complete" : ""}
                        >
                            {completedDays.has(day.day) ? 'Undo Complete' : 'Mark Complete'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Exam Button */}
                <div className="sticky bottom-6 flex justify-end">
                    <button
                        onClick={handleShowQuizConfig}
                        disabled={loading}
                        className="bg-indigo-600 text-white px-8 py-4 rounded-full font-bold shadow-lg hover:bg-indigo-700 hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-70 disabled:transform-none"
                    >
                    {loading ? 'Preparing Quiz...' : '🧠 Take Skill Assessment Quiz'}
                    </button>
                </div>
              </div>
            )}

            {/* QUIZ VIEW */}
            {currentView === 'quiz' && quiz && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-3xl mx-auto">
                {!quizScore ? (
                  <>
                    {/* Quiz Configuration Badge */}
                    {quiz.configuration && (
                      <div className="mb-6 flex items-center justify-center gap-3">
                        <span className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide ${
                          quiz.configuration.difficulty === 'beginner' ? 'bg-green-100 text-green-700' :
                          quiz.configuration.difficulty === 'intermediate' ? 'bg-blue-100 text-blue-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {quiz.configuration.difficulty}
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="px-4 py-2 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                          {quiz.configuration.questionCount} Questions
                        </span>
                      </div>
                    )}

                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-lg font-bold text-gray-900">
                          {Object.keys(quizAnswers).length + 1} <span className="text-gray-400 font-normal">/ {quiz.questions.length}</span>
                        </span>
                        <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                           Quiz Phase
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full transition-all duration-500 ease-out"
                          style={{ width: `${(Object.keys(quizAnswers).length / quiz.questions.length) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-8">
                      {quiz.questions.map((question, qIndex) => (
                        <div key={qIndex} className={`transition-opacity duration-300 ${Object.keys(quizAnswers).length === qIndex ? 'opacity-100' : 'hidden'}`}>
                          <h3 className="text-xl font-bold text-gray-900 mb-6 leading-relaxed">
                            {question.question}
                          </h3>
                          <div className="space-y-3">
                            {question.options.map((option, oIndex) => (
                              <button
                                key={oIndex}
                                onClick={() => handleQuizAnswer(qIndex, oIndex)}
                                className={`w-full text-left px-6 py-4 rounded-xl border-2 transition-all duration-200 group ${
                                  quizAnswers[qIndex] === oIndex
                                    ? 'bg-indigo-50 border-indigo-600 text-indigo-900'
                                    : 'bg-white border-gray-100 text-gray-700 hover:border-indigo-200 hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                                         quizAnswers[qIndex] === oIndex ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 text-gray-400 group-hover:border-indigo-300'
                                    }`}>
                                        {['A','B','C','D'][oIndex]}
                                    </div>
                                    <span className="font-medium">{option}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-sm text-gray-500">Select an answer to proceed</span>
                        <button
                        onClick={handleSubmitQuiz}
                        disabled={Object.keys(quizAnswers).length !== quiz.questions.length}
                        className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                        Submit Quiz
                        </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <div className="inline-block p-6 rounded-full bg-gradient-to-br from-yellow-100 to-orange-100 mb-6 shadow-sm">
                        <span className="text-6xl filter drop-shadow-sm">
                            {quizScore.percentage >= 80 ? '🏆' : quizScore.percentage >= 60 ? '👏' : '📚'}
                        </span>
                    </div>
                    
                    <h3 className="text-3xl font-bold text-gray-900 mb-2">Quiz Completed!</h3>
                    <p className="text-gray-500 mb-8">Here is how you performed against your learning plan.</p>

                    {/* Quiz Configuration Info */}
                    {quiz.configuration && (
                      <div className="flex items-center justify-center gap-3 mb-6">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          quiz.configuration.difficulty === 'beginner' ? 'bg-green-100 text-green-700' :
                          quiz.configuration.difficulty === 'intermediate' ? 'bg-blue-100 text-blue-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {quiz.configuration.difficulty.charAt(0).toUpperCase() + quiz.configuration.difficulty.slice(1)}
                        </span>
                        <span className="text-gray-400 text-sm">•</span>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                          {quiz.configuration.completedDays || completedDays.size} days completed
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mb-10">
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="text-2xl font-bold text-gray-900">{quizScore.percentage}%</div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide">Score</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4">
                            <div className="text-2xl font-bold text-green-700">{quizScore.correct}</div>
                            <div className="text-xs text-green-600 uppercase tracking-wide">Correct</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-4">
                            <div className="text-2xl font-bold text-blue-700">{quizScore.total}</div>
                            <div className="text-xs text-blue-600 uppercase tracking-wide">Total</div>
                        </div>
                    </div>
                    
                    
                    <div className="flex gap-4 justify-center">
                      <button
                        onClick={() => {
                          setQuizScore(null);
                          setQuizAnswers({});
                        }}
                        className="px-6 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Retake Quiz
                      </button>
                      <button
                        onClick={() => setCurrentView('planner')}
                        className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        Back to Learning Plan
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
      <ChatbotButton />
    </>
  );
};

export default SkillUnlocker;

