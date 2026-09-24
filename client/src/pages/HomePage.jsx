import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigationinner } from "../components/navigationinner";
import Sidebar from '../components/Sidebar';
import ChatbotButton from '../components/ChatbotButton';
import AnalyticsCard from '../components/analytics/AnalyticsCard';
import SkillProficiencyRadar from '../components/analytics/SkillProficiencyRadar';
import StrengthsWeaknesses from '../components/analytics/StrengthsWeaknesses';
import WeeklyActivityChart from '../components/analytics/WeeklyActivityChart';
import { USAGE_EVENT } from '../hooks/useStudyTimeTracker';

const HomePage = () => {
  const navigate = useNavigate();
  const userName = localStorage.getItem('name') || 'Student';
  const userEmail = localStorage.getItem('email');

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const inFlight = useRef(false);

  // Previously a failed request silently rendered hard-coded numbers (a skill
  // score of 850, a 3-day streak, 92% in "Generative AI Concepts") - showing a
  // student performance they never achieved. Errors are now shown as errors.
  const loadAnalytics = useCallback(async ({ background = false } = {}) => {
    if (!userEmail || inFlight.current) return;
    inFlight.current = true;
    if (background) setRefreshing(true);
    try {
      // getTimezoneOffset lets the server bucket days in the student's local
      // time, so streaks and "today" match the student's calendar.
      const tzOffset = new Date().getTimezoneOffset();
      const response = await fetch(
        `${process.env.REACT_APP_API_ENDPOINT}/api/analytics/${encodeURIComponent(userEmail)}?tzOffset=${tzOffset}`
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      setAnalytics(data);
      setError(null);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError(err.message || 'Could not load your analytics');
    } finally {
      inFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [userEmail]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Keep the dashboard current: refetch when the student comes back to this
  // tab (e.g. after finishing a quiz elsewhere), keeping the old numbers on
  // screen while the new ones load.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadAnalytics({ background: true });
    };
    // ...and each time the study-time tracker saves another minute, so today's bar grows while you work.
    const onUsage = () => loadAnalytics({ background: true });
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener(USAGE_EVENT, onUsage);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener(USAGE_EVENT, onUsage);
    };
  }, [loadAnalytics]);

  const score = analytics?.skillScore;
  const quiz = analytics?.quizPerformance;
  const completion = analytics?.courseCompletion;
  const streak = analytics?.studyStreak;
  const breakdown = score?.breakdown;
  const streakTrend = { active: 'Active today', 'at-risk': 'At risk', inactive: '' }[streak?.status] || '';
  const updatedAt = analytics?.generatedAt
    ? new Date(analytics.generatedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <>
      <Navigationinner title={"HOME"} hideLogo={true} />
      <div className="flex bg-gray-50 min-h-screen pt-14">
        <Sidebar />

        {/* Main Content */}
        <div className="ml-64 flex-1">
          <div className="p-8">
            {/* Welcome Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome back, {userName}! 👋
              </h1>
              <p className="text-gray-600">
                Track your learning progress and skill development
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <div className="w-10 h-10 mx-auto mb-4 rounded-full border-4 border-gray-200 border-t-primary-600 animate-spin" />
                  <p className="text-gray-600">Loading your analytics...</p>
                </div>
              </div>
            ) : error && !analytics ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center max-w-md">
                  <div className="text-5xl mb-4">📊</div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Your analytics could not be loaded</h2>
                  <p className="text-sm text-gray-600 mb-6">{error}</p>
                  <button
                    type="button"
                    onClick={() => { setLoading(true); loadAnalytics(); }}
                    className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Analytics Overview Section */}
                <div className={`mb-8 transition-opacity ${refreshing ? 'opacity-60' : ''}`}>
                  <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 mb-1">Analytics Overview</h2>
                      <p className="text-sm text-gray-600">
                        Calculated from your quizzes, learning plans and study activity.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {error && <span className="text-red-600">Refresh failed · showing last loaded data</span>}
                      {updatedAt && <span>Updated {updatedAt}</span>}
                      <button
                        type="button"
                        onClick={() => loadAnalytics({ background: true })}
                        disabled={refreshing}
                        className="px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
                      >
                        {refreshing ? 'Refreshing…' : 'Refresh'}
                      </button>
                    </div>
                  </div>

                  {!analytics?.hasActivity && (
                    <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-900">
                      No learning activity yet. Upload notes, add a video, ask a doubt or start a learning plan -
                      then take a quiz, and these numbers will start reflecting your progress.
                    </div>
                  )}

                  {/* Metrics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
                    <AnalyticsCard
                      title="SKILL SCORE"
                      value={score?.formattedValue || '0'}
                      subtitle="out of 1,000"
                      icon="⚡"
                      trend={score?.trend}
                      trendDirection={score?.trendDirection}
                      trendLabel={score?.trendLabel}
                      detail={breakdown && `Mastery ${breakdown.mastery} · Progress ${breakdown.progress} · Consistency ${breakdown.consistency} · Breadth ${breakdown.breadth}`}
                      iconBg="bg-blue-50"
                      iconColor="text-blue-600"
                    />
                    <AnalyticsCard
                      title="QUIZ ACCURACY"
                      value={quiz?.accuracy === null || quiz?.accuracy === undefined ? '—' : `${quiz.accuracy}%`}
                      subtitle={quiz?.questionsAnswered
                        ? `${quiz.correctAnswers}/${quiz.questionsAnswered} correct`
                        : 'No quizzes taken yet'}
                      icon="🎯"
                      detail={quiz?.quizzesTaken ? `${quiz.quizzesTaken} ${quiz.quizzesTaken === 1 ? 'quiz' : 'quizzes'} taken · recent results weigh more` : undefined}
                      iconBg="bg-purple-50"
                      iconColor="text-purple-600"
                    />
                    <AnalyticsCard
                      title="COURSE COMPLETION"
                      value={completion?.formattedPercentage || '0%'}
                      subtitle={completion?.summary || 'No learning plans yet'}
                      icon="✓"
                      detail={completion?.totalDays ? `${completion.completedDays} of ${completion.totalDays} plan days completed` : undefined}
                      iconBg="bg-green-50"
                      iconColor="text-green-600"
                    />
                    <AnalyticsCard
                      title="STUDY STREAK"
                      value={`${streak?.days || 0} ${streak?.days === 1 ? 'day' : 'days'}`}
                      subtitle={streak?.message || 'Study today to start a streak'}
                      icon="🔥"
                      trend={streakTrend}
                      trendColor={streak?.status === 'at-risk' ? 'text-amber-600' : 'text-orange-600'}
                      detail={streak?.longest ? `Best streak: ${streak.longest} ${streak.longest === 1 ? 'day' : 'days'}` : undefined}
                      iconBg="bg-orange-50"
                      iconColor="text-orange-600"
                    />
                  </div>

                  {/* Weekly Learning Hours */}
                  <div className="mb-8">
                    <WeeklyActivityChart weekly={analytics?.weeklyActivity} />
                  </div>

                  {/* Skill Proficiency & Strengths */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                    <SkillProficiencyRadar skills={analytics?.skillProficiency || []} />
                    <StrengthsWeaknesses data={analytics?.strengthsWeaknesses} />
                  </div>
                </div>

                  {/* Adaptive Learning Paths Section */}
                  <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-8 text-white shadow-xl">
                    <div className="flex flex-col lg:flex-row items-center justify-between">
                      <div className="flex-1 mb-6 lg:mb-0">
                        <div className="inline-block px-3 py-1 bg-blue-500/20 rounded-full text-xs font-semibold text-blue-300 mb-3">
                          🚀 NEW MODEL RELEASED
                        </div>
                        <h2 className="text-3xl font-bold mb-3">Adaptive Learning Paths</h2>
                        <p className="text-gray-300 text-base max-w-2xl">
                          Our latest AI engine analyzes your specific learning style and progress to build a dynamic roadmap tailored just for you.
                        </p>
                      </div>
                      <button
                        onClick={() => navigate('/skill-unlocker')}
                        className="bg-white text-gray-900 px-6 py-3 rounded-lg font-semibold 
                             hover:bg-gray-100 transition-all duration-200 shadow-lg hover:shadow-xl
                             flex items-center space-x-2 whitespace-nowrap"
                      >
                        <span>Start Personalized Path</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </button>
                    </div>
                  </div>
              </>
            )}
          </div>
          <ChatbotButton />
        </div>
      </div>
    </>
  );
};

export default HomePage;
