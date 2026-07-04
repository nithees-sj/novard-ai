import React from "react";
import { useNavigate } from "react-router-dom";
import { Navigation } from "../components/navigation";
import { signInWithGoogle } from "../Firebase";

const Landing = () => {
  const navigate = useNavigate();

  const handleSignIn = async () => {
    try {
      const user = await signInWithGoogle();
      if (user) {
        navigate("/home");
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("Failed to log in. Please try again.");
    }
  };

  return (
    <div className="bg-white min-h-screen" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      {/* Navigation - Keep as is */}
      <Navigation />

      {/* Hero Section */}
      <section className="relative pt-28 pb-24 px-4 overflow-hidden" style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Hero Content */}
            <div className="space-y-7">
              <div className="inline-block">
                <span
                  className="text-xs font-bold tracking-widest uppercase flex items-center gap-2"
                  style={{
                    color: '#3b82f6',
                    background: '#eff6ff',
                    padding: '8px 18px',
                    borderRadius: '999px',
                    border: '1px solid #dbeafe',
                    letterSpacing: '0.08em',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                  </svg>
                  NEXT GEN AI LEARNING
                </span>
              </div>

              <h1
                className="font-extrabold leading-tight"
                style={{ fontSize: 'clamp(2.5rem, 4vw, 3.5rem)', color: '#111827', letterSpacing: '-0.02em' }}
              >
                Architect Your
                <br />
                <span style={{ color: '#3b82f6' }}>Future with AI</span>
              </h1>

              <p className="leading-relaxed" style={{ fontSize: '1.075rem', color: '#6b7280', maxWidth: '480px', lineHeight: 1.75 }}>
                Master the world's most transformative technologies with a
                personalized, data-driven learning path designed by industry
                experts and powered by neural intelligence.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap items-center gap-5 pt-2">
                <button
                  onClick={handleSignIn}
                  className="group"
                  style={{
                    padding: '14px 32px',
                    background: '#3b82f6',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    borderRadius: '999px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.45)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(59, 130, 246, 0.35)'; }}
                >
                  Get Started
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Right: Dashboard Cards - 2x2 Bento Grid */}
            <div className="relative">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.15fr 0.85fr',
                  gridTemplateRows: 'auto auto',
                  gap: '16px',
                }}
              >
                {/* Card 1: Skill Score */}
                <div
                  style={{
                    background: '#fff',
                    borderRadius: '16px',
                    padding: '24px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
                    border: '1px solid #f1f5f9',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '150px',
                  }}
                >
                  <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                    Skill Score
                  </p>
                  <p style={{ fontSize: '2.5rem', fontWeight: 800, color: '#111827', lineHeight: 1.1, marginBottom: '16px' }}>
                    1,250
                  </p>
                  {/* Progress bar */}
                  <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '75%', background: 'linear-gradient(90deg, #3b82f6, #2563eb)', borderRadius: '999px' }}></div>
                  </div>
                </div>

                {/* Card 2: Complete */}
                <div
                  style={{
                    background: '#fff',
                    borderRadius: '16px',
                    padding: '24px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
                    border: '1px solid #f1f5f9',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '150px',
                  }}
                >
                  <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                    Complete
                  </p>
                  <p style={{ fontSize: '2.2rem', fontWeight: 800, color: '#111827', lineHeight: 1.1, marginBottom: '12px' }}>
                    85%
                  </p>
                  {/* Bar chart icon */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '36px' }}>
                    {[50, 75, 60, 90, 70].map((h, i) => (
                      <div
                        key={i}
                        style={{
                          width: '6px',
                          height: `${h}%`,
                          background: i === 3 ? '#3b82f6' : '#c7d2fe',
                          borderRadius: '2px',
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Card 3: Daily Streak */}
                <div
                  style={{
                    background: '#fff',
                    borderRadius: '16px',
                    padding: '24px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
                    border: '1px solid #f1f5f9',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '140px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        background: '#f1f5f9',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#22c55e', background: '#f0fdf4', padding: '3px 8px', borderRadius: '999px' }}>
                      +12%
                    </span>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
                      Daily Streak
                    </p>
                    <p style={{ fontSize: '1.85rem', fontWeight: 800, color: '#111827', lineHeight: 1.1 }}>
                      12 Days
                    </p>
                  </div>
                </div>

                {/* Card 4: Analytics Dashboard */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    borderRadius: '16px',
                    padding: '24px',
                    boxShadow: '0 4px 20px rgba(59, 130, 246, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '140px',
                  }}
                >
                  <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                    Analytics Dashboard
                  </p>
                  <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
                    Alex Johnson
                  </p>
                  {/* Avatar circles */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd'].map((bg, i) => (
                      <div
                        key={i}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: bg,
                          border: '2px solid #2563eb',
                          marginLeft: i === 0 ? 0 : '-8px',
                        }}
                      />
                    ))}
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.2)',
                        border: '2px solid #2563eb',
                        marginLeft: '-8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        color: '#fff',
                      }}
                    >
                      +5
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Novard-AI Section - NEW */}
      <section className="py-20 px-4 bg-gray-50">
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
            <div className="bg-white rounded-xl p-8 shadow-sm hover:shadow-lg transition-shadow">
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
            <div className="bg-white rounded-xl p-8 shadow-sm hover:shadow-lg transition-shadow">
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
            <div className="bg-white rounded-xl p-8 shadow-sm hover:shadow-lg transition-shadow">
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
            <div className="bg-white rounded-xl p-8 shadow-sm hover:shadow-lg transition-shadow">
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
            <div className="bg-white rounded-xl p-8 shadow-sm hover:shadow-lg transition-shadow">
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
            <div className="bg-white rounded-xl p-8 shadow-sm hover:shadow-lg transition-shadow">
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
      <section className="py-20 px-4 bg-white">
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
            <div className="bg-white rounded-2xl p-8 border border-gray-100 hover:shadow-xl transition-shadow duration-300">
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

              <button className="text-blue-600 font-semibold text-sm hover:gap-2 flex items-center gap-1 transition-all group">
                Explore Paths
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* AI Mentor Forum  */}
            <div className="bg-white rounded-2xl p-8 border border-gray-100 hover:shadow-xl transition-shadow duration-300">
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

              <button className="text-cyan-600 font-semibold text-sm hover:gap-2 flex items-center gap-1 transition-all group">
                Join Discussion
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Video Summarizer */}
            <div className="bg-white rounded-2xl p-8 border border-gray-100 hover:shadow-xl transition-shadow duration-300">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-3">Video Summarizer</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                Turn hours of lectures into concise summaries instantly using advanced NLP code snippets instantly.
              </p>

              <button className="text-orange-600 font-semibold text-sm hover:gap-2 flex items-center gap-1 transition-all group">
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
      <footer className="bg-gray-900 text-gray-300 py-16 px-4">
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
              <p className="text-sm leading-relaxed text-gray-400">
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
          <div className="border-t border-gray-800 pt-8 flex flex-wrap justify-between items-center text-sm text-gray-500">
            <p>© 2024 Novard-AI Technologies Inc. Built for the future.</p>
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
