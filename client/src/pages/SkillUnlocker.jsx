import React, { useState, useEffect, useCallback, useRef } from 'react';
import { readOpenParam, clearOpenParam } from '../lib/openParam';
import AppShell from '../components/layout/AppShell';
import Icon from '../components/ui/Icon';
import Button from '../components/ui/Button';
import cx from '../components/ui/cx';
import confirm from '../components/ui/confirm';
import { api, errorMessage } from '../lib/api';
import logger from '../lib/logger';
import { currentEmail } from '../lib/session';
import QuizSetup from '../components/quiz/QuizSetup';
import { countCorrect } from '../lib/quiz';
import FeatureNotice from '../components/FeatureNotice';


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
        className="stroke-chart-track"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        className="stroke-blue-600"
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
  // Opens on the create-plan form; 'form' | 'planner' | 'quiz-config' | 'quiz'
  const [currentView, setCurrentView] = useState('form');
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
  const [quizError, setQuizError] = useState(null);

  const userId = currentEmail();

  const fetchPlans = useCallback(async () => {
    try {
      const response = await api.get(`/api/skill-unlocker/plans/${encodeURIComponent(userId)}`);
      setPlans(response.data.plans || []);
    } catch (err) {
      logger.error('Error fetching plans', err);
      setError(errorMessage(err, 'Could not load your learning plans.'));
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

      const response = await api.post(`/api/skill-unlocker/generate-plan`, {
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
      logger.error('Error generating plan', err);
      setError(errorMessage(err, 'Failed to generate learning plan. Please try again.'));
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

  // Opened from the Novard Agent's "Open plan" link: select that plan once the list arrives.
  const openId = useRef(readOpenParam());
  useEffect(() => {
    if (!openId.current || !plans?.length) return;
    const target = plans.find((p) => String(p.planId || p._id) === openId.current);
    openId.current = null;
    clearOpenParam();
    if (target) handleSelectPlan(target);
  }, [plans]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeletePlan = async (e, planId) => {
    e.stopPropagation();
    if (await confirm({ title: 'Delete this skill plan?', message: 'Its days, progress and quiz results will be removed. This cannot be undone.', confirmLabel: 'Delete', danger: true })) {
      try {
        await api.delete(`/api/skill-unlocker/plans/${planId}`);
        if (currentPlan && (currentPlan.planId === planId || currentPlan._id === planId)) {
            setCurrentPlan(null);
            setCurrentView('form');
        }
        fetchPlans();
      } catch (err) {
        logger.error('Error deleting plan', err);
        setError(errorMessage(err, 'Could not delete the plan. Please try again.'));
      }
    }
  };

  const handleVideoClick = (dayNumber) => {
      setVideoInteracted(prev => new Set(prev).add(dayNumber));
  };

  const handleRefreshVideo = async (dayNumber) => {
    setRefreshingVideo(dayNumber);
    try {
        const response = await api.post(`/api/skill-unlocker/refresh-video`, {
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
        logger.error('Error refreshing video', err);
        setError(errorMessage(err, 'Failed to refresh video. Please try again.'));
    } finally {
        setRefreshingVideo(null);
    }
  };

  const handleDayComplete = async (dayNumber) => {
    // Only allow if interacted or already completed (to undo)
    if (!videoInteracted.has(dayNumber) && !completedDays.has(dayNumber)) return;

    const flip = (prev) => {
      const next = new Set(prev);
      if (next.has(dayNumber)) next.delete(dayNumber);
      else next.add(dayNumber);
      return next;
    };
    setCompletedDays(flip); // optimistic

    try {
        await api.post('/api/skill-unlocker/toggle-day-completion', {
            planId: currentPlan.planId || currentPlan._id,
            dayNumber,
        });
        fetchPlans();
    } catch (err) {
        logger.error('Error toggling day', err);
        setCompletedDays(flip); // put it back as it was
        setError(errorMessage(err, 'Could not update that day. Please try again.'));
    }
  };


  const handleShowQuizConfig = () => {
    // Check if at least one day is completed
    if (completedDays.size === 0) {
      setError('Please complete at least one day of learning before taking the quiz.');
      return;
    }
    setError(null);
    setQuizError(null);
    setCurrentView('quiz-config');
  };

  const handleGenerateQuiz = async (settings) => {
    setLoading(true);
    setQuizError(null);
    try {
      const response = await api.post(`/api/skill-unlocker/generate-quiz`, {
        planId: currentPlan.planId || currentPlan._id,
        skillName: currentPlan.skillName,
        userId,
        ...settings
      });
      setQuiz(response.data);
      setQuizAnswers({});
      setQuizScore(null);
      setCurrentView('quiz');
    } catch (err) {
      logger.error('Error generating quiz', err);
      setQuizError(errorMessage(err, 'Failed to generate quiz. Please try again.'));
    } finally {
      setLoading(false);
    }
  };


  const handleQuizAnswer = (questionIndex, answerIndex) => {
    setQuizAnswers(prev => ({ ...prev, [questionIndex]: answerIndex }));
  };

  const handleSubmitQuiz = async () => {
    const correct = countCorrect(quiz.questions, quizAnswers);

    const score = Math.round((correct / quiz.questions.length) * 100);
    setQuizScore({ percentage: score, correct, total: quiz.questions.length });

    try {
      await api.post(`/api/skill-unlocker/save-quiz-result`, {
        quizId: quiz.quizId,
        planId: currentPlan.planId || currentPlan._id,
        userId,
        score,
        totalQuestions: quiz.questions.length,
        questionCount: quiz.configuration?.questionCount || quiz.questions.length,
        difficulty: quiz.configuration?.difficulty || 'intermediate',
        style: quiz.configuration?.style,
        focus: quiz.configuration?.focus
      });
      fetchPlans();
    } catch (err) {
      logger.error('Error saving quiz result', err);
      setError(errorMessage(err, 'Your quiz score could not be saved.'));
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
    <AppShell
      page="plans"
      width="full"
      crumbs={[
        { label: 'Home', to: '/home' },
        currentView === 'form' ? { label: 'Skill Plans' } : { label: 'Skill Plans', onClick: handleAddNewSkill },
        ...(currentView !== 'form' && currentPlan?.skillName ? [{ label: currentPlan.skillName }] : []),
      ]}
      title={currentView !== 'form' && currentPlan?.skillName ? `${currentPlan.skillName} · Skill Plans` : 'Skill Plans'}
    >
      <FeatureNotice tool="skillUnlocker" />
      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-0 md:overflow-hidden md:rounded-xl md:bg-raised md:ring-1 md:ring-line-subtle">
        {/* The open plan, form or quiz */}
        <div className="order-last min-h-[28rem] min-w-0 flex-1 rounded-xl bg-raised ring-1 ring-line-subtle md:order-none md:min-h-0 md:overflow-y-auto md:rounded-none md:ring-0">
          <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8 sm:py-8">
            
            {/* Header */}
            {(
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

            {/* FORM VIEW */}
            {currentView === 'form' && (
              <div className="bg-surface rounded-xl shadow-sm border border-gray-100 p-8 max-w-3xl mx-auto">
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
                          className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-surface"
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
                          className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-surface"
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
                          className="w-full px-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-surface"
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
                          className="w-full px-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-surface"
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
                    className="w-full px-6 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-70 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
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
            {currentView === 'quiz-config' && currentPlan && (
              <div className="bg-surface rounded-xl shadow-sm border border-gray-100 p-8 max-w-3xl mx-auto">
                <QuizSetup
                  source="plan"
                  itemId={currentPlan.planId || currentPlan._id}
                  topic={currentPlan.skillName}
                  onStart={handleGenerateQuiz}
                  starting={loading}
                  error={quizError}
                />
                <button
                  onClick={() => setCurrentView('planner')}
                  className="mt-3 w-full max-w-3xl mx-auto block px-6 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* PLANNER VIEW */}
            {currentView === 'planner' && currentPlan && (
              <div className="animate-fade-in">
                {/* Progress Stats */}
                <div className="bg-surface rounded-xl shadow-sm border border-gray-100 p-6 mb-8 flex items-center justify-between">
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
                      className={`relative overflow-hidden bg-surface rounded-xl p-5 border transition-all hover:shadow-md ${
                        completedDays.has(day.day) 
                          ? 'border-green-200 bg-green-50/30' 
                          : 'border-gray-200'
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
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                                  <span>Recommended Video</span>
                                </h4>
                                
                                <div className="relative rounded-lg overflow-hidden bg-slate-900 aspect-video shadow-sm hover:shadow-md transition-shadow">
                                    {/* Thumbnail or Placeholder */}
                                    {day.youtubeVideo.thumbnailUrl ? (
                                        <img 
                                            src={day.youtubeVideo.thumbnailUrl} 
                                            alt={day.youtubeVideo.title}
                                            className="absolute inset-0 w-full h-full object-cover"
                                        />
                                    ) : (
                                        <>
                                            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 opacity-90"></div>
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
                                            className="p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                                            title="Get new recommendation"
                                            aria-label="Get a new video recommendation"
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
                                      aria-label={`Open recommended video: ${day.youtubeVideo.title}`}
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => handleDayComplete(day.day)}
                            disabled={!videoInteracted.has(day.day) && !completedDays.has(day.day)}
                            className={`w-full py-2.5 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${
                            completedDays.has(day.day)
                                ? 'bg-surface border-2 border-gray-200 text-gray-500 hover:border-gray-300'
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
                        className="bg-blue-600 text-white px-8 py-4 rounded-full font-bold shadow-lg hover:bg-blue-700 hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-70 disabled:transform-none"
                    >
                    {loading ? 'Preparing Quiz...' : '🧠 Take Skill Assessment Quiz'}
                    </button>
                </div>
              </div>
            )}

            {/* QUIZ VIEW */}
            {currentView === 'quiz' && quiz && (
              <div className="bg-surface rounded-xl shadow-sm border border-gray-100 p-8 max-w-3xl mx-auto">
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
                          {Object.keys(quizAnswers).length + 1} <span className="text-gray-500 font-normal">/ {quiz.questions.length}</span>
                        </span>
                        <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                           Quiz Phase
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-blue-600 h-full transition-all duration-500 ease-out"
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
                                    ? 'bg-blue-50 border-blue-600 text-blue-900'
                                    : 'bg-surface border-gray-100 text-gray-700 hover:border-blue-200 hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                                         quizAnswers[qIndex] === oIndex ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-gray-400 group-hover:border-blue-300'
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
                        className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                        onClick={() => { setQuizError(null); setCurrentView('quiz-config'); }}
                        className="px-6 py-2.5 bg-surface border border-blue-200 text-blue-700 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        All marks · New quiz
                      </button>
                      <button
                        onClick={() => setCurrentView('planner')}
                        className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
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

        {/* Your plans - the left pane */}
        <aside className="order-first flex max-h-[24rem] shrink-0 flex-col overflow-hidden rounded-xl bg-raised ring-1 ring-line-subtle md:max-h-none md:w-72 md:rounded-none md:border-r md:border-line-subtle md:bg-canvas/60 md:ring-0" aria-label="Your skill plans">
            <div className="px-4 pb-3 pt-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-body font-semibold text-fg">Your plans</h3>
                  {plans.length > 0 && <span className="tabular text-caption text-fg-subtle">{plans.length}</span>}
                </div>
                <Button
                  onClick={handleAddNewSkill}
                  aria-pressed={currentView === 'form'}
                  variant={currentView === 'form' ? 'secondary' : 'primary'}
                  icon={currentView === 'form' ? undefined : 'plus'}
                  block
                  disabled={currentView === 'form'}
                >
                  {currentView === 'form' ? 'Creating a new plan…' : 'New skill plan'}
                </Button>
            </div>

            <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
                {plans.length === 0 ? (
                    <div className="px-3 py-8 text-center">
                        <p className="text-body font-medium text-fg">No plans yet</p>
                        <p className="mt-0.5 text-small text-fg-muted">Fill in the form to create your first one.</p>
                    </div>
                ) : (
                    plans.map((plan) => {
                        const selected = !!(currentPlan && (currentPlan.planId === plan.planId || currentPlan.planId === plan._id || currentPlan._id === plan.planId || currentPlan._id === plan._id));
                        return (
                        <div
                          key={plan.planId || plan._id}
                          role="button"
                          tabIndex={0}
                          aria-current={selected ? 'true' : undefined}
                          onClick={() => handleSelectPlan(plan)}
                          onKeyDown={(e) => {
                            if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              handleSelectPlan(plan);
                            }
                          }}
                          className={cx(
                            'group relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                            selected ? 'bg-accent-soft' : 'hover:bg-sunken',
                          )}
                        >
                            <CircularProgress value={plan.progress} size={32} strokeWidth={3} />
                            <div className="min-w-0 flex-1">
                                <h3 className={cx('truncate text-body font-medium', selected ? 'text-accent-fg' : 'text-fg')}>
                                    {plan.skillName}
                                </h3>
                                <p className="mt-0.5 text-caption text-fg-subtle">
                                    <span className="tabular">{plan.duration} days · {plan.progress}%</span>
                                    {plan.quizCompleted && <span className="text-success-fg"> · Quiz done</span>}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={(e) => handleDeletePlan(e, plan.planId || plan._id)}
                                className="shrink-0 rounded p-1 text-fg-subtle opacity-0 transition hover:bg-danger-soft hover:text-danger-fg focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
                                title="Delete plan"
                                aria-label={`Delete the ${plan.skillName} plan`}
                            >
                                <Icon name="trash" className="h-4 w-4" />
                            </button>
                        </div>
                        );
                    })
                )}
            </div>
        </aside>
      </div>
    </AppShell>
  );
};

export default SkillUnlocker;

