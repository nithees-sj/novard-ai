import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigationinner } from "../components/navigationinner";
import Sidebar from '../components/Sidebar';
import ChatbotButton from '../components/ChatbotButton';

const features = [
  {
    title: 'Notes & Quiz',
    description: 'Access comprehensive notes, practice Q&A sessions, and test your knowledge.',
    icon: '📚',
    route: '/notes',
    color: 'bg-blue-600 hover:bg-blue-700'
  },
  {
    title: 'Doubt Clearance',
    description: 'Get personalized doubt clearance and quiz-based learning support.',
    icon: '❓',
    route: '/doubt-clearance',
    color: 'bg-purple-600 hover:bg-purple-700'
  },
];

const Doubts = () => {
  const navigate = useNavigate();

  return (
    <>
      <Navigationinner title={"DOUBTS"} hideLogo={false} hasSidebar={false} />
      <div className="flex bg-gray-50 min-h-screen pt-14">
        <div className="flex-1 p-8">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Doubts & Learning
            </h1>
            <p className="text-sm text-gray-600">
              Clear your doubts and enhance your knowledge
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
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
                  Start Learning
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

export default Doubts;
