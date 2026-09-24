import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Navigationinner } from '../components/navigationinner';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../AuthContext';
import ProfileHeader from '../components/profile/ProfileHeader';
import TestPerformance from '../components/profile/TestPerformance';
import LearningPath from '../components/profile/LearningPath';
import { Donut, Heatmap, LineChart } from '../components/profile/charts';
import SkillProficiencyRadar from '../components/analytics/SkillProficiencyRadar';
import StrengthsWeaknesses from '../components/analytics/StrengthsWeaknesses';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;

const MIX_COLORS = {
  quiz: '#0284c7',
  question: '#38bdf8',
  planDay: '#16a34a',
  materialAdded: '#a855f7',
  forumPost: '#f59e0b',
  forumComment: '#fbbf24',
};

const formatMinutes = (m) => {
  const mins = Math.round(m || 0);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return mins % 60 ? `${h}h ${mins % 60}m` : `${h}h`;
};

const Stat = ({ label, value, sub, accent }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5 relative overflow-hidden">
    <span className={`absolute left-0 top-0 bottom-0 w-1 ${accent}`} aria-hidden="true" />
    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
    <p className="mt-2 text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
    <p className="mt-1 text-xs text-gray-500 truncate" title={typeof sub === 'string' ? sub : undefined}>{sub}</p>
  </div>
);

const SectionTitle = ({ title, subtitle }) => (
  <div className="flex items-end justify-between gap-4 pt-4">
    <div>
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
    </div>
  </div>
);

const Card = ({ title, subtitle, right, children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-gray-200 p-6 ${className}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
    <div className="mt-5">{children}</div>
  </div>
);

const LIBRARY = [
  { key: 'notes', label: 'Notes', icon: '📄' },
  { key: 'videos', label: 'Videos', icon: '🎬' },
  { key: 'doubts', label: 'Doubts', icon: '❓' },
  { key: 'plans', label: 'Skill plans', icon: '🗓️' },
  { key: 'roadmaps', label: 'Roadmaps', icon: '🗺️' },
  { key: 'coachChats', label: 'Coach chats', icon: '🧭' },
  { key: 'assistantChats', label: 'Assistant chats', icon: '💬' },
  { key: 'forumPosts', label: 'Forum posts', icon: '🗣️' },
];

/**
 * The student's profile: who they are at the top, then everything they have
 * done in the app, charted - tests, learning paths, study activity and
 * subject mastery. All figures come from /api/profile/:email/overview.
 */
const Profile = () => {
  const { user } = useAuth();
  const email = user?.email || localStorage.getItem('email');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await axios.get(`${apiUrl}/api/profile/${encodeURIComponent(email)}/overview`, {
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
    <>
      <Navigationinner title="PROFILE" hideLogo={true} />
      <div className="flex bg-gray-50 min-h-screen pt-14">
        <Sidebar />
        <main className="ml-64 flex-1 p-8 min-w-0">
          <div className="max-w-7xl mx-auto space-y-6">
            {loading && !data ? (
              <div className="flex flex-col items-center justify-center py-32 text-gray-500" role="status">
                <span className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-primary-600 animate-spin mb-4" aria-hidden="true" />
                Loading your profile…
              </div>
            ) : error && !data ? (
              <div className="bg-white rounded-xl border border-red-200 p-10 text-center">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Your profile could not be loaded</h2>
                <p className="text-sm text-gray-500 mb-5">{error}</p>
                <button type="button" onClick={load} className="px-5 py-2 text-sm font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700">Try again</button>
              </div>
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
                <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                  <Stat label="Skill score" value={<>{o.skillScore}<span className="text-sm font-medium text-gray-400"> / 1000</span></>} sub={`${scoreChange >= 0 ? '+' : ''}${scoreChange} in 12 weeks`} accent="bg-primary-600" />
                  <Stat label="Quiz accuracy" value={o.accuracy === null ? '—' : `${o.accuracy}%`} sub={`${o.correctAnswers} of ${o.questionsAnswered} correct`} accent="bg-green-500" />
                  <Stat label="Tests taken" value={o.testsTaken} sub={`${o.questionsAnswered} questions answered`} accent="bg-indigo-500" />
                  <Stat label="Study time" value={formatMinutes(o.studyMinutes)} sub={`${o.trackedMinutes > 0 ? 'Time in the app' : 'Estimated'} · ${o.activeDays} active ${o.activeDays === 1 ? 'day' : 'days'}`} accent="bg-purple-500" />
                  <Stat label="Study streak" value={`${o.streak.days} ${o.streak.days === 1 ? 'day' : 'days'}`} sub={o.streak.longest > o.streak.days ? `Best ${o.streak.longest} days · ${o.streak.message}` : o.streak.message} accent="bg-amber-500" />
                  <Stat label="Questions asked" value={o.questionsAsked} sub="Across every AI chat" accent="bg-sky-400" />
                </div>

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
                            <p className="text-sm font-bold text-gray-900 tabular-nums">{v}</p>
                            <p className="text-[10px] uppercase tracking-wide text-gray-400">{k}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  >
                    <LineChart points={trend} height={290} caption="Skill score by week" />
                  </Card>
                  <Card title="Where your time goes" subtitle="Estimated from each kind of activity">
                    {mixTotal === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-12">No activity recorded yet</p>
                    ) : (
                      <div className="flex flex-col items-center gap-5">
                        <Donut
                          segments={mix.map((m) => ({ label: m.label, value: m.minutes, color: MIX_COLORS[m.kind] || '#9ca3af' }))}
                          centerValue={formatMinutes(mixTotal)}
                          centerLabel="total"
                        />
                        <ul className="w-full space-y-2">
                          {mix.map((m) => (
                            <li key={m.kind} className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2 text-gray-700">
                                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: MIX_COLORS[m.kind] || '#9ca3af' }} aria-hidden="true" />
                                {m.label}
                              </span>
                              <span className="tabular-nums text-gray-500">{formatMinutes(m.minutes)} <span className="text-gray-900 font-semibold">{m.share}%</span></span>
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
                    <p className="text-sm text-gray-600">
                      <strong className="text-gray-900 tabular-nums">{data.activity.heatmap.activeDays}</strong> active {data.activity.heatmap.activeDays === 1 ? 'day' : 'days'}
                      {data.activity.heatmap.busiest && <> · busiest <strong className="text-gray-900">{new Date(`${data.activity.heatmap.busiest.date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</strong></>}
                    </p>
                  )}
                >
                  <Heatmap days={data.activity.heatmap.days} />
                </Card>

                <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 xl:grid-cols-8">
                  {LIBRARY.map((l) => (
                    <div key={l.key} className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center">
                      <p className="text-lg" aria-hidden="true">{l.icon}</p>
                      <p className="text-xl font-bold text-gray-900 tabular-nums">{data.activity.library[l.key]}</p>
                      <p className="text-[11px] text-gray-500">{l.label}</p>
                    </div>
                  ))}
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
        </main>
      </div>
    </>
  );
};

export default Profile;
