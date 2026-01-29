import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigationinner } from "../components/navigationinner";
import ChatbotButton from '../components/ChatbotButton';

const features = [
  {
    title: 'Roadmap',
    description: 'Get a customized career roadmap with milestones and actionable strategies.',
    icon: '🗺️',
    route: '/roadmap',
    color: 'blue'
  },
  {
    title: 'Skills Required',
    description: 'Discover essential skills needed to improve your qualifications.',
    icon: '💪',
    route: '/skills-required',
    color: 'green'
  },
  {
    title: 'Project Ideas',
    description: 'Find project ideas that align with your career ambitions.',
    icon: '💡',
    route: '/project-ideas',
    color: 'yellow'
  },
  {
    title: 'Resume Builder',
    description: 'Create professional resumes that stand out in the job market.',
    icon: '📄',
    route: '/resume-build',
    color: 'purple'
  },
  {
    title: 'Skill Unlocker',
    description: 'Master any skill with personalized day-wise learning plans.',
    icon: '🔓',
    route: '/skill-unlocker',
    color: 'indigo'
  },
];

const Career = () => {
  const navigate = useNavigate();

  return (
    <>
      <Navigationinner title={"CAREER"} />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Career Development Tools
            </h1>
            <p className="text-sm text-gray-600">
              Build your career with our comprehensive resources
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
                  className={`w-full py-2 px-4 bg-${feature.color}-600 hover:bg-${feature.color}-700 
                           text-white text-sm font-medium rounded-md transition-colors duration-200`}
                >
                  Get Started
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

export default Career;
