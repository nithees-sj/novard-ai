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
    <div className="bg-gradient-to-b from-blue-50 via-white to-gray-50 min-h-screen">
      {/* Navigation - Keep as is */}
      <Navigation />

      {/* Hero Section - More spacing from navbar */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Hero Content */}
            <div className="space-y-6">
              <div className="inline-block">
                <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-4 py-2 rounded-full border border-blue-200">
                  🎯 NEXT GEN AI LEARNING
                </span>
              </div>

              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                Architect Your{" "}
                <br />
                <span className="text-blue-600">Future with AI</span>
              </h1>

              <p className="text-lg text-gray-600 leading-relaxed max-w-xl">
                Master the world's most transformative technologies with a
                personalized, data-driven learning path designed by industry
                experts and powered by neural intelligence.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-4 pt-4">
                <button
                  onClick={handleSignIn}
                  className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg 
                           hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl 
                           flex items-center gap-2 group"
                >
                  Get Started
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>

              </div>
            </div>

            {/* Right: Analytics Dashboard Preview */}
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 transform hover:scale-105 transition-transform duration-300">
                {/* Dashboard Header */}
                <div className="mb-6">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">ANALYTICS DASHBOARD</p>
                  <h3 className="text-xl font-bold text-gray-900">Alex Johnson</h3>
                  <div className="flex gap-2 mt-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 uppercase mb-1">Skill Score</p>
                    <p className="text-2xl font-bold text-gray-900">1,250</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 uppercase mb-1">Complete</p>
                    <p className="text-2xl font-bold text-gray-900">85%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 uppercase mb-1">Streak</p>
                    <p className="text-2xl font-bold text-gray-900">12</p>
                  </div>
                </div>

                {/* Chart */}
                <div className="flex items-end justify-between h-32 gap-3 mb-6">
                  {[60, 85, 75, 95, 80].map((height, idx) => (
                    <div key={idx} className="flex-1 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg"
                      style={{ height: `${height}%` }}></div>
                  ))}
                </div>

                {/* Hexagon Icon */}
                <div className="flex justify-center">
                  <div className="w-20 h-20 relative">
                    <svg viewBox="0 0 100 100" className="text-blue-200">
                      <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill="currentColor" stroke="#2563eb" strokeWidth="2" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics Section - Glowing Containers */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-6">
            {/* Stat 1 */}
            <div className="bg-white rounded-xl p-8 text-center border-2 border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-blue-400"
              style={{ boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)' }}>
              <div className="text-4xl font-bold text-blue-600 mb-2">10K+</div>
              <div className="text-gray-600 font-medium">Active Learners</div>
            </div>

            {/* Stat 2 */}
            <div className="bg-white rounded-xl p-8 text-center border-2 border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-blue-400"
              style={{ boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)' }}>
              <div className="text-4xl font-bold text-blue-600 mb-2">500+</div>
              <div className="text-gray-600 font-medium">AI-Curated Courses</div>
            </div>

            {/* Stat 3 */}
            <div className="bg-white rounded-xl p-8 text-center border-2 border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-blue-400"
              style={{ boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)' }}>
              <div className="text-4xl font-bold text-blue-600 mb-2">95%</div>
              <div className="text-gray-600 font-medium">Success Rate</div>
            </div>

            {/* Stat 4 */}
            <div className="bg-white rounded-xl p-8 text-center border-2 border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-blue-400"
              style={{ boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)' }}>
              <div className="text-4xl font-bold text-blue-600 mb-2">24/7</div>
              <div className="text-gray-600 font-medium">AI Mentorship</div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section className="py-16 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-center text-sm text-gray-500 uppercase tracking-wider mb-8">
            TRUSTED BY ENGINEERING TEAMS AT
          </p>

          <div className="flex flex-wrap justify-center items-center gap-12 opacity-60">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
              <span className="text-gray-600 font-semibold">TechCore</span>
            </div>

            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h5a1 1 0 000-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3z" />
              </svg>
              <span className="text-gray-600 font-semibold">NebulaSystems</span>
            </div>

            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-600 font-semibold">BlockGraph</span>
            </div>

            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3h.5a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-.5a1.5 1.5 0 00-3 0v.5a1 1 0 01-1 1H6a1 1 0 01-1-1v-3a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3H4a1 1 0 001-1V6a1 1 0 011-1h3a1 1 0 001-1v-.5z" />
              </svg>
              <span className="text-gray-600 font-semibold">Infinia</span>
            </div>

            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-600 font-semibold">Silico</span>
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
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Roadmap</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gray-800 pt-8 flex flex-wrap justify-between items-center text-sm text-gray-500">
            <p>© 2024 Novard-AI Technologies Inc. Built for the future.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Security</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
