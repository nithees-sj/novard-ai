import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigationinner } from "../components/navigationinner";
import ChatbotButton from '../components/ChatbotButton';

const features = [
  {
    title: 'Career',
    description: 'Navigate your career with customized roadmaps and actionable strategies.',
    icon: '💼',
    route: '/career',
    gradient: 'from-blue-500 to-blue-600'
  },
  {
    title: 'Doubts',
    description: 'Get personalized doubt clearance and strengthen your understanding.',
    icon: '❓',
    route: '/doubts',
    gradient: 'from-purple-500 to-purple-600'
  },
  {
    title: 'AI Forum',
    description: 'Connect and learn from the community about career development.',
    icon: '💬',
    route: '/forum',
    gradient: 'from-green-500 to-green-600'
  },
  {
    title: 'Video Sessions',
    description: 'Access curated educational videos and AI-powered summaries.',
    icon: '🎥',
    route: '/video',
    gradient: 'from-orange-500 to-orange-600'
  },
];

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <>
      <Navigationinner title={"HOME"} />
      <div className="min-h-screen bg-gray-50">
        {/* Content Container */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Welcome Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Welcome to Your Learning Hub
            </h1>
            <p className="text-sm text-gray-600">
              Explore our comprehensive suite of tools designed for your success
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, index) => (
              <div
                key={index}
                onClick={() => navigate(feature.route)}
                className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-lg 
                         transition-all duration-200 cursor-pointer group"
              >
                {/* Icon & Title */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center">
                    <span className="text-3xl mr-2">{feature.icon}</span>
                    <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {feature.title}
                    </h3>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  {feature.description}
                </p>

                {/* Action Button */}
                <button 
                  className={`w-full py-2 px-4 bg-gradient-to-r ${feature.gradient} text-white 
                           text-sm font-medium rounded-md hover:shadow-md transition-all duration-200`}
                >
                  Explore
                </button>
              </div>
            ))}
          </div>

        </div>
        <ChatbotButton />
      </div>
    </>
  );
};

export default HomePage;
