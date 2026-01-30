import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigationinner } from "../components/navigationinner";
import Sidebar from '../components/Sidebar';
import ChatbotButton from '../components/ChatbotButton';

const features = [
  {
    title: 'Video Library',
    description: 'Access curated educational videos with industry experts and tutorials.',
    icon: '🎥',
    route: '/youtube-videos',
    color: 'bg-red-600 hover:bg-red-700'
  },
  {
    title: 'Video Summarizer',
    description: 'Add YouTube videos and interact through chat, summaries, and quizzes.',
    icon: '📝',
    route: '/youtube-video-summarizer',
    color: 'bg-indigo-600 hover:bg-indigo-700'
  },
  {
    title: 'Teacher Guidance',
    description: 'Learn subjects with personalized guidance and structured paths.',
    icon: '👨‍🏫',
    route: '/teacher-guidance',
    color: 'bg-green-600 hover:bg-green-700'
  },
];

const Video = () => {
  const navigate = useNavigate();

  return (
    <>
      <Navigationinner title={"VIDEO SESSIONS"} hideLogo={false} hasSidebar={false} />
      <div className="flex bg-gray-50 min-h-screen pt-14">
        <div className="flex-1 p-8">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Video Sessions & Learning
            </h1>
            <p className="text-sm text-gray-600">
              Access videos and AI-powered tools for enhanced learning
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
            {features.map((feature, index) => (
              <div
                key={index}
                onClick={() => navigate(feature.route)}
                className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-lg 
                         transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center">
                    <span className="text-3xl mr-2">{feature.icon}</span>
                    <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {feature.title}
                    </h3>
                  </div>
                </div>

                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  {feature.description}
                </p>

                <button 
                  className={`w-full py-2 px-4 ${feature.color} text-white text-sm font-medium 
                           rounded-md transition-colors duration-200`}
                >
                  Explore
                </button>
              </div>
            ))}
          </div>

          <ChatbotButton />
        </div>
      </div>
    </>
  );
};

export default Video;
