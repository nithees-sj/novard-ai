import React from "react";
import { Navigation } from "../components/navigation";
import { useAuth } from "../AuthContext";

// The hero's illustrative dashboard cards.
const bentoCard = 'flex flex-col justify-between rounded-2xl border border-gray-100 bg-surface p-6 shadow-soft dark:border-gray-200';
const bentoLabel = 'mb-1.5 text-[0.7rem] font-bold uppercase tracking-[0.08em]';

const Landing = () => {
  const { signIn, signingIn, authError } = useAuth();
  const handleSignIn = () => signIn();

  return (
    <div className="bg-surface min-h-screen">
      <Navigation />

      {/* Hero Section */}
      <section className="relative pt-28 pb-24 px-4 overflow-hidden bg-gradient-to-b from-gray-50 to-surface">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Hero Content */}
            <div className="space-y-7">
              <div className="inline-block">
                <span className="flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-[18px] py-2 text-xs font-bold uppercase tracking-[0.08em] text-blue-600">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                  </svg>
                  NEXT GEN AI LEARNING
                </span>
              </div>

              <h1 className="text-[clamp(2.5rem,4vw,3.5rem)] font-extrabold leading-tight tracking-[-0.02em] text-gray-900">
                Architect Your
                <br />
                <span className="text-blue-500 dark:text-blue-400">Future with AI</span>
              </h1>

              <p className="max-w-[480px] text-[1.075rem] leading-[1.75] text-gray-500">
                Master the world's most transformative technologies with a
                personalized, data-driven learning path designed by industry
                experts and powered by neural intelligence.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap items-center gap-5 pt-2">
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={signingIn}
                  aria-busy={signingIn}
                  className="group flex items-center gap-2 rounded-full bg-blue-600 px-8 py-3.5 text-[0.95rem] font-semibold text-white shadow-lg shadow-blue-600/30 transition-all duration-200 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:opacity-70"
                >
                  {signingIn ? 'Signing in…' : 'Get Started'}
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
              {authError && (
                <p role="alert" className="text-sm font-medium text-red-600">{authError}</p>
              )}
            </div>

            {/* Right: Dashboard Cards - 2x2 Bento Grid (an illustration, not data) */}
            <div className="relative" aria-hidden="true">
              <div className="grid grid-cols-[1.15fr_0.85fr] gap-4">
                {/* Card 1: Skill Score */}
                <div className={`${bentoCard} min-h-[150px]`}>
                  <p className={`${bentoLabel} text-blue-500 dark:text-blue-400`}>Skill Score</p>
                  <p className="mb-4 text-[2.5rem] font-extrabold leading-[1.1] text-gray-900">1,250</p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-blue-500 to-blue-600" />
                  </div>
                </div>

                {/* Card 2: Complete */}
                <div className={`${bentoCard} min-h-[150px]`}>
                  <p className={`${bentoLabel} text-gray-500`}>Complete</p>
                  <p className="mb-3 text-[2.2rem] font-extrabold leading-[1.1] text-gray-900">85%</p>
                  <div className="flex h-9 items-end gap-1">
                    {[50, 75, 60, 90, 70].map((h, i) => (
                      <div key={i} className={`w-1.5 rounded-sm ${i === 3 ? 'bg-blue-500' : 'bg-indigo-200'}`} style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>

                {/* Card 3: Daily Streak */}
                <div className={`${bentoCard} min-h-[140px]`}>
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                    </div>
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-[0.7rem] font-semibold text-green-600">+12%</span>
                  </div>
                  <div>
                    <p className={`${bentoLabel} mb-0.5 text-gray-500`}>Daily Streak</p>
                    <p className="text-[1.85rem] font-extrabold leading-[1.1] text-gray-900">12 Days</p>
                  </div>
                </div>

                {/* Card 4: Analytics Dashboard */}
                <div className="flex min-h-[140px] flex-col justify-between rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 shadow-lg shadow-blue-500/25">
                  <p className={`${bentoLabel} text-white/75`}>Analytics Dashboard</p>
                  <p className="mb-3 text-xl font-bold text-white">Alex Johnson</p>
                  <div className="flex items-center">
                    {['bg-blue-800', 'bg-blue-500', 'bg-blue-400', 'bg-blue-300'].map((bg, i) => (
                      <div key={bg} className={`h-7 w-7 rounded-full border-2 border-blue-600 ${bg} ${i ? '-ml-2' : ''}`} />
                    ))}
                    <div className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-blue-600 bg-white/20 text-[0.6rem] font-bold text-white">
                      +5
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Novard-AI */}
      <section id="about" className="scroll-mt-16 py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why Choose Novard-AI?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Experience a revolutionary approach to learning that adapts to your unique needs and accelerates your career growth.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Benefit 1 */}
            <div className="bg-surface rounded-xl p-8 border border-gray-100 shadow-sm hover:shadow-lg transition-shadow dark:border-gray-200">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">AI-Powered Personalization</h3>
              <p className="text-gray-600 leading-relaxed">
                Our neural intelligence adapts to your learning style, skill level, and goals to create a truly personalized curriculum.
              </p>
            </div>

            {/* Benefit 2 */}
            <div className="bg-surface rounded-xl p-8 border border-gray-100 shadow-sm hover:shadow-lg transition-shadow dark:border-gray-200">
              <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Industry-Recognized Skills</h3>
              <p className="text-gray-600 leading-relaxed">
                Learn cutting-edge technologies that top companies are actively hiring for, backed by real-world projects.
              </p>
            </div>

            {/* Benefit 3 */}
            <div className="bg-surface rounded-xl p-8 border border-gray-100 shadow-sm hover:shadow-lg transition-shadow dark:border-gray-200">
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Learn at Your Pace</h3>
              <p className="text-gray-600 leading-relaxed">
                Flexible learning paths that fit your schedule, with 24/7 access to resources and AI mentorship support.
              </p>
            </div>

            {/* Benefit 4 */}
            <div className="bg-surface rounded-xl p-8 border border-gray-100 shadow-sm hover:shadow-lg transition-shadow dark:border-gray-200">
              <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Smart Career Guidance</h3>
              <p className="text-gray-600 leading-relaxed">
                AI-driven career roadmaps that align your learning with market demands and job opportunities.
              </p>
            </div>

            {/* Benefit 5 */}
            <div className="bg-surface rounded-xl p-8 border border-gray-100 shadow-sm hover:shadow-lg transition-shadow dark:border-gray-200">
              <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Collaborative Community</h3>
              <p className="text-gray-600 leading-relaxed">
                Connect with peers, share knowledge, and get instant help from our AI mentor forum available 24/7.
              </p>
            </div>

            {/* Benefit 6 */}
            <div className="bg-surface rounded-xl p-8 border border-gray-100 shadow-sm hover:shadow-lg transition-shadow dark:border-gray-200">
              <div className="w-14 h-14 bg-pink-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Track Your Progress</h3>
              <p className="text-gray-600 leading-relaxed">
                Advanced analytics dashboard to monitor your growth, identify strengths, and celebrate milestones.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Advanced Learning Ecosystem */}
      <section id="features" className="scroll-mt-16 py-20 px-4 bg-surface">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Advanced Learning Ecosystem
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Everything you need to master modern software development and artificial intelligence
              in one cohesive platform.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-8">
            {/* Career Roadmap */}
            <div className="bg-surface rounded-2xl p-8 border border-gray-200 hover:shadow-xl hover:border-blue-200 transition-all duration-300">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                </svg>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-3">Career Roadmap</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                Our AI analyzes your skills and aspirations to create a hyper-personalized path to your dream job.
              </p>

              <button type="button" onClick={handleSignIn} className="text-blue-600 font-semibold text-sm hover:gap-2 flex items-center gap-1 transition-all group">
                Explore Paths
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* AI Mentor Forum  */}
            <div className="bg-surface rounded-2xl p-8 border border-gray-200 hover:shadow-xl hover:border-blue-200 transition-all duration-300">
              <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-cyan-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                  <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                </svg>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-3">AI Mentor Forum</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                Get smart, technical answers from our fine-tuned AI mentors available 24/7 to debug and explain concepts.
              </p>

              <button type="button" onClick={handleSignIn} className="text-cyan-600 font-semibold text-sm hover:gap-2 flex items-center gap-1 transition-all group">
                Join Discussion
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Video Summarizer */}
            <div className="bg-surface rounded-2xl p-8 border border-gray-200 hover:shadow-xl hover:border-blue-200 transition-all duration-300">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-3">Video Summarizer</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                Turn hours of lectures into concise summaries instantly using advanced NLP code snippets instantly.
              </p>

              <button type="button" onClick={handleSignIn} className="text-orange-600 font-semibold text-sm hover:gap-2 flex items-center gap-1 transition-all group">
                Try It Now
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-slate-900 text-slate-300 py-16 px-4 dark:border-t dark:border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            {/* Company Info */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">N</span>
                </div>
                <span className="text-white font-bold text-xl">Novard-AI</span>
              </div>
              <p className="text-sm leading-relaxed text-slate-400">
                The world's first AI-powered learning platform designed for the next generation of software engineers and architects.
              </p>
            </div>

            {/* Product Links */}
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><button type="button" className="hover:text-white transition-colors">Features</button></li>
                <li><button type="button" className="hover:text-white transition-colors">Roadmap</button></li>
                <li><button type="button" className="hover:text-white transition-colors">Pricing</button></li>
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><button type="button" className="hover:text-white transition-colors">About Us</button></li>
                <li><button type="button" className="hover:text-white transition-colors">Careers</button></li>
                <li><button type="button" className="hover:text-white transition-colors">Contact</button></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-slate-800 pt-8 flex flex-wrap justify-between items-center text-sm text-slate-400">
            <p>© {new Date().getFullYear()} Novard-AI Technologies Inc. Built for the future.</p>
            <div className="flex gap-6">
              <button type="button" className="hover:text-white transition-colors">Privacy Policy</button>
              <button type="button" className="hover:text-white transition-colors">Terms of Service</button>
              <button type="button" className="hover:text-white transition-colors">Security</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
