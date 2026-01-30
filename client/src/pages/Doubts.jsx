import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigationinner } from "../components/navigationinner";
import Sidebar from '../components/Sidebar';
import ChatbotButton from '../components/ChatbotButton';
import NotesInlineView from '../components/NotesInlineView';
import DoubtClearanceInlineView from '../components/DoubtClearanceInlineView';

const learningModules = [
  {
    title: 'Notes & Quiz',
    description: 'Access comprehensive notes, practice Q&A sessions, and test your knowledge with interactive quizzes.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    buttonColor: 'bg-blue-600 hover:bg-blue-700',
    route: '/notes'
  },
  {
    title: 'Doubt Clearance',
    description: 'Get personalized doubt clearance and quiz-based learning support from our AI-driven system.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    buttonColor: 'bg-blue-600 hover:bg-blue-700',
    route: '/doubt-clearance'
  },
];

const Doubts = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('landing'); // 'landing', 'notes', 'doubtClearance'

  return (
    <>
      <Navigationinner title={"DOUBTS & LEARNING"} hideLogo={true} hasSidebar={true} />
      <div className="flex bg-gray-50 min-h-screen pt-14">
        <Sidebar />
        <div className="ml-64 flex-1 p-8">

          {/* Breadcrumb */}
          <div className="flex items-center text-sm text-gray-500 mb-6">
            <span
              onClick={() => setActiveView('landing')}
              className={`cursor-pointer hover:text-blue-600 ${activeView === 'landing' ? 'text-gray-900 font-medium' : ''}`}
            >
              Dashboard
            </span>
            <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span
              onClick={() => setActiveView('landing')}
              className={`cursor-pointer hover:text-blue-600 ${activeView === 'landing' ? 'text-gray-900 font-medium' : ''}`}
            >
              Doubts & Learning
            </span>
            {activeView === 'notes' && (
              <>
                <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-gray-900 font-medium">Notes & Quiz</span>
              </>
            )}
            {activeView === 'doubtClearance' && (
              <>
                <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-gray-900 font-medium">Doubt Clearance</span>
              </>
            )}
          </div>

          {/* Landing View */}
          {activeView === 'landing' && (
            <>
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Doubts & Learning
                </h1>
                <p className="text-gray-600">
                  Clear your doubts and enhance your knowledge with our specialized learning modules.
                </p>
              </div>

              {/* Learning Modules Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mb-10">
                {learningModules.map((module, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      if (module.route === '/notes') {
                        setActiveView('notes');
                      } else if (module.route === '/doubt-clearance') {
                        setActiveView('doubtClearance');
                      } else {
                        navigate(module.route);
                      }
                    }}
                    className="bg-white rounded-2xl border border-gray-100 p-8 hover:shadow-xl 
                             transition-all duration-300 cursor-pointer group"
                  >
                    {/* Icon */}
                    <div className={`w-14 h-14 ${module.iconBg} rounded-xl flex items-center justify-center mb-5
                                  group-hover:scale-110 transition-transform duration-200`}>
                      <span className={module.iconColor}>{module.icon}</span>
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      {module.title}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                      {module.description}
                    </p>

                    {/* Button */}
                    <button className={`w-full ${module.buttonColor} text-white px-6 py-3 
                                       rounded-lg font-semibold transition-all duration-200 
                                       flex items-center justify-center gap-2 shadow-md hover:shadow-lg`}>
                      Start Learning
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Expand Your Expertise Section */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-10 shadow-xl max-w-4xl">
                <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
                  <div className="flex-1">
                    <div className="inline-block px-3 py-1 bg-blue-500/20 rounded-full text-xs font-semibold text-blue-300 mb-3">
                      📚 NEW CONTENT AVAILABLE
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-3">
                      Expand Your Expertise
                    </h2>
                    <p className="text-gray-300 max-w-2xl">
                      Our AI models have been updated with the latest industry documentation and interview patterns.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/explore-topics')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-lg font-semibold 
                             flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl 
                             whitespace-nowrap"
                  >
                    <span>Explore New Topics</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Notes Inline View */}
          {activeView === 'notes' && (
            <div>
              {/* Back Button */}
              <button
                onClick={() => setActiveView('landing')}
                className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium">Back to Doubts & Learning</span>
              </button>

              <NotesInlineView />
            </div>
          )}

          {/* Doubt Clearance Inline View */}
          {activeView === 'doubtClearance' && (
            <div>
              {/* Back Button */}
              <button
                onClick={() => setActiveView('landing')}
                className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium">Back to Doubts & Learning</span>
              </button>

              <DoubtClearanceInlineView />
            </div>
          )}

          <ChatbotButton />
        </div>
      </div>
    </>
  );
};

export default Doubts;
