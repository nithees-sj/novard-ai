import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigationinner } from "../components/navigationinner";
import Sidebar from '../components/Sidebar';
import ChatbotButton from '../components/ChatbotButton';
import RoadmapInlineView from '../components/RoadmapInlineView';
import SkillsInlineView from '../components/SkillsInlineView';
import ProjectsInlineView from '../components/ProjectsInlineView';
import ResumesInlineView from '../components/ResumesInlineView';

const careerTools = [
  {
    title: 'Smart Roadmap',
    description: 'Personalized AI paths to reach your dream role in record time.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    buttonColor: 'text-blue-600',
    id: 'roadmap',
    route: 'inline'
  },
  {
    title: 'Skill Gap Analysis',
    description: 'Identify and bridge technical gaps with targeted learning recommendations.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    buttonColor: 'text-purple-600',
    id: 'skills',
    route: 'inline'
  },
  {
    title: 'Project Portfolio',
    description: 'Build real-world AI projects to showcase your expertise to recruiters.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    buttonColor: 'text-green-600',
    id: 'projects',
    route: 'inline'
  },
  {
    title: 'AI Resume Builder',
    description: 'Optimized resumes that bypass ATS and highlight your AI skills.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    buttonColor: 'text-orange-600',
    id: 'resume',
    route: 'inline'
  },
];

const Career = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('landing'); // 'landing', 'roadmap', 'skills', 'projects', 'resume'

  return (
    <>
      <Navigationinner title={"CAREER"} hideLogo={true} hasSidebar={true} />
      <div className="flex bg-gray-50 min-h-screen pt-14">
        <Sidebar />
        <div className="ml-64 flex-1 p-8">

          {/* Breadcrumb */}
          <div className="flex items-center text-sm text-gray-500 mb-6">
            <span
              className="cursor-pointer hover:text-blue-600"
              onClick={() => navigate('/home')}
            >
              Dashboard
            </span>
            <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span
              className={`cursor-pointer hover:text-blue-600 ${activeView === 'landing' ? 'text-gray-900 font-medium' : ''}`}
              onClick={() => setActiveView('landing')}
            >
              Career Tools
            </span>
            {activeView === 'roadmap' && (
              <>
                <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-gray-900 font-medium">Smart Roadmap</span>
              </>
            )}
            {activeView === 'skills' && (
              <>
                <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-gray-900 font-medium">Skill Gap Analysis</span>
              </>
            )}
            {activeView === 'projects' && (
              <>
                <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-gray-900 font-medium">Project Portfolio</span>
              </>
            )}
            {activeView === 'resume' && (
              <>
                <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-gray-900 font-medium">AI Resume Builder</span>
              </>
            )}
          </div>

          {/* Landing View */}
          {activeView === 'landing' && (
            <>
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Career Development Tools
                </h1>
                <p className="text-gray-600">
                  Empower your professional journey with our AI-driven toolkit designed for modern tech careers.
                </p>
              </div>

              {/* Tools Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                {careerTools.map((tool, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      if (tool.route === 'inline') {
                        if (tool.id === 'roadmap') {
                          setActiveView('roadmap');
                        } else if (tool.id === 'skills') {
                          setActiveView('skills');
                        } else if (tool.id === 'projects') {
                          setActiveView('projects');
                        } else if (tool.id === 'resume') {
                          setActiveView('resume');
                        }
                      } else {
                        navigate(tool.route);
                      }
                    }}
                    className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-xl 
                         transition-all duration-300 cursor-pointer group"
                  >
                    {/* Icon */}
                    <div className={`w-14 h-14 ${tool.iconBg} rounded-xl flex items-center justify-center mb-4
                              group-hover:scale-110 transition-transform duration-200`}>
                      <span className={tool.iconColor}>{tool.icon}</span>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      {tool.title}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                      {tool.description}
                    </p>

                    {/* Button */}
                    <button className={`${tool.buttonColor} font-medium text-sm flex items-center 
                                   group-hover:gap-2 transition-all`}>
                      Get Started
                      <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Practice with AI Mentors Section */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-10 shadow-xl">
                <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
                  <div className="flex-1">
                    <div className="inline-block px-3 py-1 bg-blue-500/20 rounded-full text-xs font-semibold text-blue-300 mb-3">
                      🎯 NOW LIVE: MOCK INTERVIEWS
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-3">
                      Practice with AI Mentors
                    </h2>
                    <p className="text-gray-300 max-w-2xl">
                      Prepare for your next big interview with our industry-specific AI simulation tool.
                      Real-time feedback on your performance.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/mock-interview')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold 
                         flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl 
                         whitespace-nowrap"
                  >
                    <span>Start Mock Interview</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Roadmap Inline View */}
          {activeView === 'roadmap' && (
            <div>
              <button
                onClick={() => setActiveView('landing')}
                className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium">Back to Career Tools</span>
              </button>
              <RoadmapInlineView />
            </div>
          )}

          {/* Skills Inline View */}
          {activeView === 'skills' && (
            <div>
              <button
                onClick={() => setActiveView('landing')}
                className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium">Back to Career Tools</span>
              </button>
              <SkillsInlineView />
            </div>
          )}

          {/* Projects Inline View */}
          {activeView === 'projects' && (
            <div>
              <button
                onClick={() => setActiveView('landing')}
                className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium">Back to Career Tools</span>
              </button>
              <ProjectsInlineView />
            </div>
          )}

          {/* Resume Inline View */}
          {activeView === 'resume' && (
            <div>
              <button
                onClick={() => setActiveView('landing')}
                className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium">Back to Career Tools</span>
              </button>
              <ResumesInlineView />
            </div>
          )}

          <ChatbotButton />
        </div>
      </div>
    </>
  );
};

export default Career;
