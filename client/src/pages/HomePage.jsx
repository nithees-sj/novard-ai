import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigationinner } from "../components/navigationinner";
import Sidebar from '../components/Sidebar';
import ChatbotButton from '../components/ChatbotButton';
import AnalyticsCard from '../components/analytics/AnalyticsCard';
import WeeklyLearningChart from '../components/analytics/WeeklyLearningChart';
import SkillProficiencyRadar from '../components/analytics/SkillProficiencyRadar';
import StrengthsWeaknesses from '../components/analytics/StrengthsWeaknesses';

const HomePage = () => {
  const navigate = useNavigate();
  const userName = localStorage.getItem('name') || 'Student';
  const userEmail = localStorage.getItem('email');

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      // Use email as userId
      const response = await fetch(`${process.env.REACT_APP_API_ENDPOINT}/api/analytics/${userEmail}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      // Set default mock data for fallback
      setAnalytics({
        skillScore: { value: 850, trend: '+2%', formattedValue: '850' },
        courseCompletion: { percentage: 65, active: 2, total: 3, formattedPercentage: '65%' },
        studyStreak: { days: 3, message: 'Keep it up!', status: 'active' },
        weeklyHours: [
          { day: 'Mon', hours: 4.5 },
          { day: 'Tue', hours: 7.2 },
          { day: 'Wed', hours: 5.8 },
          { day: 'Thu', hours: 8.5 },
          { day: 'Fri', hours: 9.2 },
          { day: 'Sat', hours: 3.1 },
          { day: 'Sun', hours: 4.7 }
        ],
        skillProficiency: [
          { name: 'AI & ML', score: 82 },
          { name: 'WEB DEV', score: 75 },
          { name: 'DEVOPS', score: 62 },
          { name: 'DATA SCI', score: 71 },
          { name: 'MOBILE', score: 58 }
        ],
        strengthsWeaknesses: [
          { name: 'Generative AI Concepts', percentage: 92, level: 'Expert', formattedPercentage: '92%' },
          { name: 'React & Frontend', percentage: 78, level: 'Advanced', formattedPercentage: '78%' },
          { name: 'Python Scripting', percentage: 65, level: 'Intermediate', formattedPercentage: '65%' }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

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
                  <div className="text-5xl mb-4">📊</div>
                  <p className="text-gray-600">Loading your analytics...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Analytics Overview Section */}
                <div className="mb-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Analytics Overview</h2>
                  <p className="text-sm text-gray-600 mb-6">
                      Detailed performance tracking and skill development metrics.
                    </p>

                    {/* Metrics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                      <AnalyticsCard
                        title="SKILL SCORE"
                        value={analytics?.skillScore?.formattedValue || '0'}
                        subtitle={`Based on your activities`}
                        icon="⚡"
                        trend={analytics?.skillScore?.trend}
                        trendColor="text-green-600"
                        iconBg="bg-blue-50"
                        iconColor="text-blue-600"
                      />
                      <AnalyticsCard
                        title="COURSE COMPLETION"
                        value={analytics?.courseCompletion?.formattedPercentage || '0%'}
                        subtitle={`${analytics?.courseCompletion?.active || 0}/${analytics?.courseCompletion?.total || 0} Active`}
                        icon="✓"
                        iconBg="bg-green-50"
                        iconColor="text-green-600"
                      />
                      <AnalyticsCard
                        title="STUDY STREAK"
                        value={`${analytics?.studyStreak?.days || 0} days`}
                        subtitle={analytics?.studyStreak?.message || 'Start learning!'}
                        icon="🔥"
                        trend={analytics?.studyStreak?.status === 'active' ? 'Active' : ''}
                        trendColor="text-orange-600"
                        iconBg="bg-orange-50"
                        iconColor="text-orange-600"
                      />
                    </div>

                    {/* Weekly Learning Hours */}
                    <div className="mb-8">
                      <WeeklyLearningChart data={analytics?.weeklyHours || []} />
                  </div>

                    {/* Skill Proficiency & Strengths */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <SkillProficiencyRadar skills={analytics?.skillProficiency || []} />
                      <StrengthsWeaknesses strengths={analytics?.strengthsWeaknesses || []} />
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
