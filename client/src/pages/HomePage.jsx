import React, { useState, useEffect, useCallback, useRef } from 'react';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import AnalyticsCard from '../components/analytics/AnalyticsCard';
import NextExamCard from '../components/exams/NextExamCard';
import SkillProficiencyRadar from '../components/analytics/SkillProficiencyRadar';
import StrengthsWeaknesses from '../components/analytics/StrengthsWeaknesses';
import WeeklyActivityChart from '../components/analytics/WeeklyActivityChart';
import { USAGE_EVENT } from '../hooks/useStudyTimeTracker';
import { apiJson } from '../lib/api';
import { currentEmail, currentName } from '../lib/session';
import logger from '../lib/logger';
import { AiLimitBanner, DashboardBanner } from '../components/FeatureNotice';
import { PageHeader, SectionHeader } from '../components/ui/Headers';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { ErrorState, Skeleton } from '../components/ui/States';

const HomePage = () => {
  const navigate = useNavigate();
  const userName = currentName() || 'Student';
  const userEmail = currentEmail();

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
      const data = await apiJson(`/api/analytics/${encodeURIComponent(userEmail)}?tzOffset=${tzOffset}`);
      setAnalytics(data);
      setError(null);
    } catch (err) {
      logger.error('Error loading analytics', err);
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

  const firstName = userName.split(' ')[0];
  const shortcuts = [
    { label: 'Study your notes', text: 'Upload a PDF, chat with it, take a quiz', icon: 'summary', to: '/doubts?tool=notes' },
    { label: 'Clear a doubt', text: 'Explain what you are stuck on', icon: 'doubt', to: '/doubts?tool=doubts' },
    { label: 'Start a skill plan', text: 'A day-by-day plan for one skill', icon: 'plan', to: '/skill-unlocker' },
    { label: 'Summarize a video', text: 'Paste a YouTube link', icon: 'play', to: '/video?tool=summarizer' },
  ];

  return (
    <AppShell page="home">
      <DashboardBanner />
      <AiLimitBanner />
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Your progress, worked out from your quizzes, skill plans and time spent studying."
        actions={!loading && analytics && (
          <div className="flex items-center gap-3 text-small text-fg-subtle">
            {error && <span className="text-danger-fg">Refresh failed · showing earlier numbers</span>}
            {updatedAt && <span className="hidden sm:inline">Updated {updatedAt}</span>}
            <Button variant="secondary" size="sm" icon="refresh" loading={refreshing} loadingLabel="Refreshing…" onClick={() => loadAnalytics({ background: true })}>
              Refresh
            </Button>
          </div>
        )}
      />

      {loading ? (
        <div role="status" aria-label="Loading your progress">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line-subtle ring-1 ring-line-subtle lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-3 bg-raised px-5 py-4"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-7 w-20" /><Skeleton className="h-3 w-32" /></div>
            ))}
          </div>
          <Skeleton className="mt-10 h-64 w-full" rounded="rounded-xl" />
        </div>
      ) : error && !analytics ? (
        <ErrorState
          title="Your progress could not be loaded"
          text={error}
          onRetry={() => { setLoading(true); loadAnalytics(); }}
        />
      ) : (
        <div className={`animate-view-in transition-opacity duration-200 ${refreshing ? 'opacity-60' : ''}`}>
          {!analytics?.hasActivity && (
            <p className="mb-4 text-body text-fg-muted">
              Nothing to measure yet. Study something below, then take a quiz on it, and these numbers start to move.
            </p>
          )}

          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-line-subtle ring-1 ring-line-subtle sm:grid-cols-2 lg:grid-cols-4">
            <AnalyticsCard
              title="Skill score"
              value={score?.formattedValue || '0'}
              subtitle="of 1,000"
              trend={score?.trend}
              trendDirection={score?.trendDirection}
              trendLabel={score?.trendLabel}
              detail={breakdown && `Mastery ${breakdown.mastery} · Progress ${breakdown.progress} · Consistency ${breakdown.consistency} · Breadth ${breakdown.breadth}`}
            />
            <AnalyticsCard
              title="Quiz accuracy"
              value={quiz?.accuracy === null || quiz?.accuracy === undefined ? '—' : `${quiz.accuracy}%`}
              subtitle={quiz?.questionsAnswered ? `${quiz.correctAnswers} of ${quiz.questionsAnswered} correct` : 'No quizzes yet'}
              detail={quiz?.quizzesTaken ? `${quiz.quizzesTaken} ${quiz.quizzesTaken === 1 ? 'quiz' : 'quizzes'} · recent results weigh more` : undefined}
            />
            <AnalyticsCard
              title="Plan completion"
              value={completion?.formattedPercentage || '0%'}
              subtitle={completion?.summary || 'No skill plans yet'}
              detail={completion?.totalDays ? `${completion.completedDays} of ${completion.totalDays} plan days done` : undefined}
            />
            <AnalyticsCard
              title="Study streak"
              value={`${streak?.days || 0} ${streak?.days === 1 ? 'day' : 'days'}`}
              subtitle={streak?.message || 'Study today to start one'}
              trend={streakTrend}
              trendTone={streak?.status === 'at-risk' ? 'warning' : undefined}
              detail={streak?.longest ? `Longest: ${streak.longest} ${streak.longest === 1 ? 'day' : 'days'}` : undefined}
            />
          </div>

          <NextExamCard />

          <section className="mt-10" aria-labelledby="home-start">
            <SectionHeader as="h2" title={<span id="home-start">Start something</span>} />
            <ul className="grid gap-px overflow-hidden rounded-xl bg-line-subtle ring-1 ring-line-subtle sm:grid-cols-2 lg:grid-cols-4">
              {shortcuts.map((a) => (
                <li key={a.label} className="bg-raised">
                  <button
                    type="button"
                    onClick={() => navigate(a.to)}
                    className="group flex h-full w-full items-center gap-3.5 px-4 py-4 text-left transition-colors duration-150 hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft/70 text-accent-fg">
                      <Icon name={a.icon} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-medium text-fg">{a.label}</span>
                      <span className="mt-0.5 block text-small text-fg-subtle">{a.text}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <WeeklyActivityChart weekly={analytics?.weeklyActivity} />
          </section>

          <section className="mt-6 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
            <SkillProficiencyRadar skills={analytics?.skillProficiency || []} />
            <StrengthsWeaknesses data={analytics?.strengthsWeaknesses} />
          </section>
        </div>
      )}
    </AppShell>
  );
};

export default HomePage;
