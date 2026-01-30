import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigationinner } from "../components/navigationinner";
import Sidebar from '../components/Sidebar';
import ChatbotButton from '../components/ChatbotButton';

const features = [
  {
    title: 'Doubts',
    description: 'Instant AI-powered clearance for all your tech queries.',
    icon: '❓',
    route: '/doubts',
    buttonText: 'Get Help',
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    buttonColor: 'bg-purple-600 hover:bg-purple-700'
  },
  {
    title: 'AI Forum',
    description: 'Connect with experts and peers in the global AI network.',
    icon: '💬',
    route: '/forum',
    buttonText: 'Join Discussion',
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    buttonColor: 'bg-green-600 hover:bg-green-700'
  },
  {
    title: 'Video Sessions',
    description: 'Curated masterclasses with automated AI transcriptions.',
    icon: '🎥',
    route: '/video',
    buttonText: 'Watch Now',
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    buttonColor: 'bg-orange-600 hover:bg-orange-700'
  },
];

const HomePage = () => {
  const navigate = useNavigate();
  const userName = localStorage.getItem('name') || 'User';

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
                Ready to continue your AI journey?
              </p>
            </div>

            {/* My Learning Hub Section */}
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">My Learning Hub</h2>
              <p className="text-sm text-gray-600 mb-6">
                Your personalized workspace for mastering Artificial Intelligence. Access your tools, community, and roadmaps.
              </p>

              {/* Features Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg 
                             transition-all duration-200 cursor-pointer group"
                    onClick={() => navigate(feature.route)}
                  >
                    {/* Icon */}
                    <div className={`w-12 h-12 ${feature.iconBg} rounded-lg flex items-center justify-center mb-4
                                  group-hover:scale-110 transition-transform duration-200`}>
                      <span className={`text-2xl ${feature.iconColor}`}>{feature.icon}</span>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {feature.title}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-gray-600 leading-relaxed mb-4">
                      {feature.description}
                    </p>

                    {/* Action Button */}
                    <button 
                      className={`w-full py-2.5 px-4 ${feature.buttonColor} text-white text-sm font-medium 
                               rounded-lg transition-all duration-200 shadow-sm hover:shadow-md`}
                    >
                      {feature.buttonText} →
                    </button>
                  </div>
                ))}
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
          </div>
          <ChatbotButton />
        </div>
      </div>
    </>
  );
};

export default HomePage;

