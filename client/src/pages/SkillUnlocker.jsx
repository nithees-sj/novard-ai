import React, { useState, useEffect, useCallback, useRef } from 'react';
import { readOpenParam, clearOpenParam } from '../lib/openParam';
import AppShell from '../components/layout/AppShell';
import Icon from '../components/ui/Icon';
import Button from '../components/ui/Button';
import cx from '../components/ui/cx';
import confirm from '../components/ui/confirm';
import Badge from '../components/ui/Badge';
import { Field, Input, Select, Textarea } from '../components/ui/Field';
import { api, errorMessage } from '../lib/api';
import logger from '../lib/logger';
import { currentEmail } from '../lib/session';
import QuizSetup from '../components/quiz/QuizSetup';
import { countCorrect } from '../lib/quiz';
import FeatureNotice from '../components/FeatureNotice';
import DayQuizDialog from '../components/skillplan/DayQuizDialog';


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
        className="stroke-accent"
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
  const [quizDay, setQuizDay] = useState(null); // the day whose quiz is open

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

  // A day is completed only by passing its quiz; the result comes back from the server.
  const handleDayQuizResult = (result) => {
    setCurrentPlan((plan) => (plan ? {
      ...plan,
      dailyPlan: plan.dailyPlan.map((d) => (d.day === result.day ? { ...d, ...result.dayState } : d)),
    } : plan));
    fetchPlans();
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
      <FeatureNotice tool="skillUnlocker" className="mb-4" />
      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-0 md:overflow-hidden md:rounded-xl md:bg-raised md:ring-1 md:ring-line-subtle">
        {/* The open plan, form or quiz */}
        <div className="order-last min-h-[28rem] min-w-0 flex-1 rounded-xl bg-raised ring-1 ring-line-subtle md:order-none md:min-h-0 md:overflow-y-auto md:rounded-none md:ring-0">
          <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8 sm:py-8">
            
            {/* Header */}
            <div className="mb-7">
              {currentView !== 'form' && currentPlan && <p className="text-small text-fg-subtle">Skill plan</p>}
              <h2 className="text-display font-semibold text-fg">
                {currentView === 'form' && 'New skill plan'}
                {currentView === 'planner' && currentPlan?.skillName}
                {currentView === 'quiz-config' && `Quiz: ${currentPlan?.skillName || ''}`}
                {currentView === 'quiz' && `Quiz: ${currentPlan?.skillName || ''}`}
              </h2>
              <p className="mt-1.5 max-w-2xl text-body text-fg-muted">
                {currentView === 'form' && 'Pick a skill and how long you have. You get a day-by-day plan with topics, resources and practice, then a quiz to check it stuck.'}
                {currentView === 'planner' && `${currentPlan?.duration || 0}-day plan · pass each day's quiz (${currentPlan?.passPercent ?? 50}% or more) to complete it`}
                {currentView === 'quiz-config' && 'Choose the difficulty and length of the quiz.'}
                {currentView === 'quiz' && 'Questions are drawn from the topics in this plan.'}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div role="alert" className="mb-6 flex items-start gap-2.5 rounded-lg bg-danger-soft px-4 py-3 text-body text-danger-fg">
                <Icon name="alert" className="mt-0.5 h-4 w-4" /> {error}
              </div>
            )}

            {/* FORM VIEW */}
            {currentView === 'form' && (
              <form onSubmit={handleGeneratePlan} className="max-w-3xl space-y-6">
                <Field id="plan-skill" label="Skill" required>
                  <Input
                    id="plan-skill"
                    name="skillName"
                    value={formData.skillName}
                    onChange={handleInputChange}
                    placeholder="e.g. Python, graphic design, public speaking"
                    required
                  />
                </Field>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field id="plan-duration" label="Length" required>
                    <Select id="plan-duration" name="duration" value={formData.duration} onChange={handleInputChange}>
                      <option value={10}>10 days · sprint</option>
                      <option value={15}>15 days · crash course</option>
                      <option value={20}>20 days · standard</option>
                      <option value={25}>25 days · in depth</option>
                      <option value={30}>30 days · mastery</option>
                    </Select>
                  </Field>
                  <Field id="plan-level" label="Starting level">
                    <Select id="plan-level" name="level" value={formData.level} onChange={handleInputChange}>
                      <option value="beginner">Beginner · from zero</option>
                      <option value="intermediate">Intermediate · refine what I know</option>
                    </Select>
                  </Field>
                  <Field id="plan-language" label="Language">
                    <Select id="plan-language" name="language" value={formData.language} onChange={handleInputChange}>
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="French">French</option>
                      <option value="Hindi">Hindi</option>
                      <option value="Tamil">Tamil</option>
                    </Select>
                  </Field>
                  <Field id="plan-style" label="Teaching style">
                    <Select id="plan-style" name="teachingStyle" value={formData.teachingStyle} onChange={handleInputChange}>
                      <option value="Standard">Standard · balanced</option>
                      <option value="Fast-paced">Fast-paced · crash course</option>
                      <option value="In-depth">Deep dive · theory first</option>
                      <option value="Practical">Hands-on · project based</option>
                    </Select>
                  </Field>
                </div>

                <Field id="plan-goal" label="Goal" required hint="What should you be able to do at the end?">
                  <Textarea
                    id="plan-goal"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={4}
                    placeholder="e.g. Build and deploy a small data dashboard on my own"
                    required
                  />
                </Field>

                <Field id="plan-topics" label="Topics to include" optional hint="Separate with commas.">
                  <Input
                    id="plan-topics"
                    name="focusAreas"
                    value={formData.focusAreas}
                    onChange={handleInputChange}
                    placeholder="e.g. pandas, numpy, visualisation"
                  />
                </Field>

                <Button type="submit" size="lg" loading={loading} loadingLabel="Writing your plan…">
                  Create my plan
                </Button>
              </form>
            )}

            {/* QUIZ CONFIGURATION VIEW */}
            {currentView === 'quiz-config' && currentPlan && (
              <div>
                <QuizSetup
                  source="plan"
                  itemId={currentPlan.planId || currentPlan._id}
                  topic={currentPlan.skillName}
                  onStart={handleGenerateQuiz}
                  starting={loading}
                  error={quizError}
                />
                <Button variant="ghost" className="mt-3" onClick={() => setCurrentView('planner')}>Cancel</Button>
              </div>
            )}

            {/* PLANNER VIEW */}
            {currentView === 'planner' && currentPlan && (() => {
              const pct = Math.round((completedDays.size / currentPlan.duration) * 100);
              return (
              <div className="animate-fade-in">
                {/* Progress and the next step */}
                <div className="flex flex-col gap-4 border-y border-line-subtle py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-body font-medium text-fg">Progress</span>
                      <span className="tabular text-small text-fg-subtle">{completedDays.size} of {currentPlan.duration} days · {pct}%</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-chart-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Plan progress">
                      <div className="h-1.5 rounded-full bg-accent transition-all duration-200" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <Button icon="quiz" onClick={handleShowQuizConfig} loading={loading} loadingLabel="Preparing quiz…">Take the quiz</Button>
                </div>

                {/* Day by day */}
                <ol className="divide-y divide-line-subtle">
                  {currentPlan.dailyPlan?.map((day) => {
                    const done = completedDays.has(day.day);
                    return (
                    <li key={day.day} className="flex gap-4 py-5 sm:gap-6">
                      <span className={cx('num w-8 shrink-0 pt-0.5 text-lead font-medium', done ? 'text-success-fg' : 'text-fg-subtle')}>
                        {String(day.day).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h3 className={cx('text-lead font-medium', done ? 'text-fg-muted' : 'text-fg')}>{day.topic}</h3>
                            {day.objective && <p className="mt-1 max-w-2xl text-body text-fg-muted">{day.objective}</p>}
                          </div>
                          <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                            {done ? (
                              <Badge tone="success" dot>Completed{day.bestScore !== null && day.bestScore !== undefined ? ` · ${day.bestScore}%` : ''}</Badge>
                            ) : (
                              <Button size="sm" variant="secondary" icon="quiz" onClick={() => setQuizDay(day)}>
                                {day.quizInProgress ? 'Continue the day quiz' : day.attempts ? 'Try the day quiz again' : 'Take the day quiz'}
                              </Button>
                            )}
                            <span className="num text-caption text-fg-subtle">
                              {done
                                ? `Passed${day.attempts > 1 ? ` on try ${day.attempts}` : ''}`
                                : day.lastScore !== null && day.lastScore !== undefined
                                  ? `Last try ${day.lastScore}% · pass mark ${currentPlan.passPercent ?? 50}%`
                                  : `5 questions · pass mark ${currentPlan.passPercent ?? 50}%`}
                            </span>
                          </div>
                        </div>

                        {day.youtubeVideo && (
                          <div className="mt-3 flex max-w-xl items-center gap-3 rounded-lg bg-sunken p-2 pr-3">
                            <a
                              href={day.youtubeVideo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => handleVideoClick(day.day)}
                              className="group flex min-w-0 flex-1 items-center gap-3 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                              aria-label={`Open recommended video: ${day.youtubeVideo.title}`}
                            >
                              <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded bg-line">
                                {day.youtubeVideo.thumbnailUrl && <img src={day.youtubeVideo.thumbnailUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
                                <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/25">
                                  <Icon name="play" className="h-5 w-5 text-white drop-shadow" />
                                </span>
                              </span>
                              <span className="min-w-0">
                                <span className="block text-caption text-fg-subtle">{videoInteracted.has(day.day) ? 'Watched' : 'Watch it, then pass the day quiz'}</span>
                                <span className="mt-0.5 block line-clamp-2 text-small font-medium text-fg group-hover:text-accent-fg">{day.youtubeVideo.title}</span>
                              </span>
                            </a>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleRefreshVideo(day.day); }}
                              disabled={refreshingVideo === day.day}
                              className="shrink-0 rounded p-1.5 text-fg-subtle transition-colors hover:bg-raised hover:text-fg disabled:opacity-50"
                              title="Suggest a different video"
                              aria-label="Get a new video recommendation"
                            >
                              <Icon name="refresh" className={cx('h-4 w-4', refreshingVideo === day.day && 'animate-spin')} />
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                    );
                  })}
                </ol>
              </div>
              );
            })()}

            {/* QUIZ VIEW */}
            {currentView === 'quiz' && quiz && (
              <div className="max-w-3xl">
                {!quizScore ? (
                  <>
                    <div className="flex items-center gap-3 border-y border-line-subtle py-3">
                      <span className="tabular text-small font-medium text-fg">
                        Question {Math.min(Object.keys(quizAnswers).length + 1, quiz.questions.length)} <span className="font-normal text-fg-subtle">of {quiz.questions.length}</span>
                      </span>
                      <div className="h-1 flex-1 rounded-full bg-chart-track">
                        <div className="h-1 rounded-full bg-accent transition-all duration-200" style={{ width: `${(Object.keys(quizAnswers).length / quiz.questions.length) * 100}%` }} />
                      </div>
                      {quiz.configuration && <Badge className="capitalize">{quiz.configuration.difficulty}</Badge>}
                    </div>

                    <div className="mt-8">
                      {quiz.questions.map((question, qIndex) => (
                        <div key={qIndex} className={Object.keys(quizAnswers).length === qIndex ? 'animate-fade-in' : 'hidden'}>
                          <h3 className="text-title font-semibold leading-snug text-fg">{question.question}</h3>
                          <div className="mt-6 space-y-2" role="radiogroup" aria-label={`Question ${qIndex + 1}`}>
                            {question.options.map((option, oIndex) => {
                              const on = quizAnswers[qIndex] === oIndex;
                              return (
                                <button
                                  key={oIndex}
                                  type="button"
                                  role="radio"
                                  aria-checked={on}
                                  onClick={() => handleQuizAnswer(qIndex, oIndex)}
                                  className={cx(
                                    'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-body ring-1 ring-inset transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus',
                                    on ? 'bg-accent-soft text-fg ring-accent' : 'text-fg-muted ring-line hover:bg-sunken hover:text-fg',
                                  )}
                                >
                                  <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded text-caption font-semibold', on ? 'bg-accent text-on-accent' : 'bg-sunken text-fg-subtle')}>
                                    {['A', 'B', 'C', 'D'][oIndex]}
                                  </span>
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 flex items-center justify-between gap-3 border-t border-line-subtle pt-4">
                      <span className="text-small text-fg-subtle">Choosing an answer moves to the next question.</span>
                      <Button onClick={handleSubmitQuiz} disabled={Object.keys(quizAnswers).length !== quiz.questions.length}>Submit quiz</Button>
                    </div>
                  </>
                ) : (
                  <div className="py-4">
                    <p className="text-small text-fg-subtle">Result</p>
                    <h3 className="mt-1 text-display font-semibold text-fg">
                      {quizScore.percentage >= 80 ? 'Strong result' : quizScore.percentage >= 60 ? 'Getting there' : 'Worth another go'}
                    </h3>
                    <p className="mt-1.5 text-body text-fg-muted">
                      {quiz.configuration
                        ? `${quiz.configuration.difficulty.charAt(0).toUpperCase() + quiz.configuration.difficulty.slice(1)} quiz after ${quiz.configuration.completedDays || completedDays.size} completed days.`
                        : 'How you did against this plan.'}
                    </p>

                    <div className="mt-6 grid max-w-md grid-cols-3 gap-px overflow-hidden rounded-lg bg-line-subtle ring-1 ring-line-subtle">
                      {[['Score', `${quizScore.percentage}%`], ['Correct', quizScore.correct], ['Questions', quizScore.total]].map(([label, value]) => (
                        <div key={label} className="bg-raised px-4 py-3">
                          <div className="text-small text-fg-muted">{label}</div>
                          <div className="num mt-0.5 text-title font-medium text-fg">{value}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 flex flex-wrap gap-2">
                      <Button onClick={() => setCurrentView('planner')}>Back to the plan</Button>
                      <Button variant="secondary" onClick={() => { setQuizError(null); setCurrentView('quiz-config'); }}>All marks · new quiz</Button>
                      <Button variant="ghost" icon="refresh" onClick={() => { setQuizScore(null); setQuizAnswers({}); }}>Retake</Button>
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
                          className={cx('group relative rounded-lg transition-colors duration-150', selected ? 'bg-accent-soft' : 'hover:bg-sunken')}
                        >
                            <button
                              type="button"
                              onClick={() => handleSelectPlan(plan)}
                              aria-current={selected ? 'true' : undefined}
                              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 pr-9 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                            >
                                <CircularProgress value={plan.progress} size={32} strokeWidth={3} />
                                <span className="min-w-0 flex-1">
                                    <span className={cx('block truncate text-body font-medium', selected ? 'text-accent-fg' : 'text-fg')}>
                                        {plan.skillName}
                                    </span>
                                    <span className={cx('mt-0.5 block text-caption', selected ? 'text-fg-muted' : 'text-fg-subtle')}>
                                        <span className="tabular">{plan.duration} days · {plan.progress}%</span>
                                        {plan.quizCompleted && <span className="text-success-fg"> · Quiz done</span>}
                                    </span>
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={(e) => handleDeletePlan(e, plan.planId || plan._id)}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-fg-subtle opacity-0 transition hover:bg-danger-soft hover:text-danger-fg focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
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
      {quizDay && currentPlan && (
        <DayQuizDialog key={quizDay.day} plan={currentPlan} day={quizDay} onClose={() => setQuizDay(null)} onResult={handleDayQuizResult} />
      )}
    </AppShell>
  );
};

export default SkillUnlocker;

