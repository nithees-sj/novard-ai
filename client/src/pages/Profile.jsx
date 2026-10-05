import React, { useCallback, useEffect, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import { api } from '../lib/api';
import { useAuth } from '../AuthContext';
import ProfileHeader from '../components/profile/ProfileHeader';
import TestPerformance from '../components/profile/TestPerformance';
import LearningPath from '../components/profile/LearningPath';
import { Donut, Heatmap, LineChart } from '../components/profile/charts';
import SkillProficiencyRadar from '../components/analytics/SkillProficiencyRadar';
import StrengthsWeaknesses from '../components/analytics/StrengthsWeaknesses';
import { currentEmail } from '../lib/session';
import { Card, SectionTitle, Stat } from '../components/profile/blocks';
import { ACTIVITY_COLORS, chart } from '../lib/statusColors';
import Icon from '../components/ui/Icon';
import { StatStrip } from '../components/ui/Stat';
import { ErrorState, Skeleton } from '../components/ui/States';

const formatMinutes = (m) => {
  const mins = Math.round(m || 0);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return mins % 60 ? `${h}h ${mins % 60}m` : `${h}h`;
};

const LIBRARY = [
  { key: 'notes', label: 'Notes', icon: 'summary' },
  { key: 'videos', label: 'Videos', icon: 'play' },
  { key: 'doubts', label: 'Doubts', icon: 'doubt' },
  { key: 'plans', label: 'Skill plans', icon: 'plan' },
  { key: 'roadmaps', label: 'Roadmaps', icon: 'roadmap' },
  { key: 'coachChats', label: 'Coach chats', icon: 'target' },
  { key: 'assistantChats', label: 'Agent chats', icon: 'bot' },
  { key: 'forumPosts', label: 'Forum posts', icon: 'forum' },
];

/**
 * The student's profile: who they are at the top, then everything they have
 * done in the app, charted - tests, learning paths, study activity and
 * subject mastery. All figures come from /api/profile/:email/overview.
 */
const Profile = () => {
  const { user } = useAuth();
  const email = user?.email || currentEmail();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get(`/api/profile/${encodeURIComponent(email)}/overview`, {
        params: { tzOffset: new Date().getTimezoneOffset() },
      });
      setData(res);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => { load(); }, [load]);

  const o = data?.overview;
  const mix = data?.activity?.mix || [];
  const mixTotal = mix.reduce((n, m) => n + m.minutes, 0);
  const trend = (data?.activity?.scoreTrend || []).map((p, i, all) => ({
    label: new Date(`${p.date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    value: p.value,
    sub: i === all.length - 1 ? `Now · ${p.value} / 1000` : `Week ending ${new Date(`${p.date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`,
  }));
  const scoreChange = trend.length > 1 ? trend[trend.length - 1].value - trend[0].value : 0;

  return (
    <AppShell page="profile">
          <div className="space-y-8">
            {loading && !data ? (
              <div role="status" aria-label="Loading your profile">
                <div className="flex items-center gap-4"><Skeleton className="h-16 w-16" rounded="rounded-full" /><div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-3.5 w-64" /></div></div>
                <Skeleton className="mt-10 h-24 w-full" rounded="rounded-xl" />
                <Skeleton className="mt-6 h-72 w-full" rounded="rounded-xl" />
              </div>
            ) : error && !data ? (
              <ErrorState title="Your profile could not be loaded" text={error} onRetry={load} />
            ) : data && (
              <>
                <ProfileHeader
                  account={data.account}
                  goal={data.goal}
                  fallbackPicture={user?.photoURL || user?.picture}
                  onSaved={(changes) => setData((d) => ({ ...d, account: { ...d.account, ...changes } }))}
                />

                {/* ── overview ───────────────────────────────── */}
                <SectionTitle title="Overview" subtitle="Your learning at a glance" />
                <StatStrip>
                  <Stat label="Skill score" value={<>{o.skillScore}<span className="text-small font-normal text-fg-subtle"> / 1000</span></>} sub={`${scoreChange >= 0 ? '+' : ''}${scoreChange} in 12 weeks`} accent="bg-accent" />
                  <Stat label="Quiz accuracy" value={o.accuracy === null ? '—' : `${o.accuracy}%`} sub={`${o.correctAnswers} of ${o.questionsAnswered} correct`} accent="bg-success" />
                  <Stat label="Tests taken" value={o.testsTaken} sub={`${o.questionsAnswered} questions answered`} accent="bg-indigo-500" />
                  <Stat label="Study time" value={formatMinutes(o.studyMinutes)} sub={`${o.trackedMinutes > 0 ? 'Time in the app' : 'Estimated'} · ${o.activeDays} active ${o.activeDays === 1 ? 'day' : 'days'}`} accent="bg-purple-500" />
                  <Stat label="Study streak" value={`${o.streak.days} ${o.streak.days === 1 ? 'day' : 'days'}`} sub={o.streak.longest > o.streak.days ? `Best ${o.streak.longest} days · ${o.streak.message}` : o.streak.message} accent="bg-warning" />
                  <Stat label="Questions asked" value={o.questionsAsked} sub="Across every AI chat" accent="bg-sky-400" />
                </StatStrip>

                {/* ── activity ───────────────────────────────── */}
                <SectionTitle title="Activity" subtitle="How your learning has built up over time" />
                <div className="grid gap-6 lg:grid-cols-3">
                  <Card
                    title="Skill score over time"
                    subtitle="Measured at the end of each week: mastery, progress, consistency and breadth"
                    className="lg:col-span-2"
                    right={(
                      <div className="flex gap-4 text-right">
                        {Object.entries(o.skillScoreBreakdown).map(([k, v]) => (
                          <div key={k}>
                            <p className="num text-body font-medium text-fg">{v}</p>
                            <p className="text-caption capitalize text-fg-subtle">{k}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  >
                    <LineChart points={trend} height={290} caption="Skill score by week" />
                  </Card>
                  <Card title="Where your time goes" subtitle="Estimated from each kind of activity">
                    {mixTotal === 0 ? (
                      <p className="text-sm text-fg-subtle text-center py-12">No activity recorded yet</p>
                    ) : (
                      <div className="flex flex-col items-center gap-5">
                        <Donut
                          segments={mix.map((m) => ({ label: m.label, value: m.minutes, color: ACTIVITY_COLORS[m.kind] || chart.muted }))}
                          centerValue={formatMinutes(mixTotal)}
                          centerLabel="total"
                        />
                        <ul className="w-full space-y-2">
                          {mix.map((m) => (
                            <li key={m.kind} className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2 text-fg-muted">
                                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: ACTIVITY_COLORS[m.kind] || chart.muted }} aria-hidden="true" />
                                {m.label}
                              </span>
                              <span className="tabular-nums text-fg-subtle">{formatMinutes(m.minutes)} <span className="text-fg font-semibold">{m.share}%</span></span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>
                </div>

                <Card
                  title="Study calendar"
                  subtitle={`Last ${data.activity.heatmap.weeks} weeks`}
                  right={(
                    <p className="text-sm text-fg-muted">
                      <strong className="text-fg tabular-nums">{data.activity.heatmap.activeDays}</strong> active {data.activity.heatmap.activeDays === 1 ? 'day' : 'days'}
                      {data.activity.heatmap.busiest && <> · busiest <strong className="text-fg">{new Date(`${data.activity.heatmap.busiest.date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</strong></>}
                    </p>
                  )}
                >
                  <Heatmap days={data.activity.heatmap.days} />
                </Card>

                <div>
                  <h3 className="mb-2 text-small font-medium text-fg-muted">What you have made</h3>
                  <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line-subtle ring-1 ring-line-subtle sm:grid-cols-4">
                    {LIBRARY.map((l) => (
                      <li key={l.key} className="flex items-center gap-3 bg-raised px-4 py-3">
                        <Icon name={l.icon} className="h-4 w-4 text-fg-subtle" />
                        <span className="min-w-0 flex-1 truncate text-body text-fg-muted">{l.label}</span>
                        <span className="num text-body font-medium text-fg">{data.activity.library[l.key]}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* ── tests ──────────────────────────────────── */}
                <SectionTitle title="Tests" subtitle="Every quiz you have submitted, from every section" />
                <TestPerformance tests={data.tests} />

                {/* ── learning path ──────────────────────────── */}
                <SectionTitle title="Learning path" subtitle="Your plans, roadmaps and skill-gap analyses" />
                <LearningPath path={data.learningPath} />

                {/* ── subject mastery ────────────────────────── */}
                <SectionTitle title="Subject mastery" subtitle="Accuracy by subject, and the topics you are strongest and weakest in" />
                <div className="grid gap-6 lg:grid-cols-2 pb-8">
                  <SkillProficiencyRadar skills={data.proficiency || []} />
                  <StrengthsWeaknesses data={data.strengthsWeaknesses} />
                </div>
              </>
            )}
          </div>
    </AppShell>
  );
};

export default Profile;
