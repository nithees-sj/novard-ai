import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigationinner } from "../components/navigationinner";
import Sidebar from '../components/Sidebar';
import VideoLibraryInlineView from '../components/VideoLibraryInlineView';
import VideoSummarizerInlineView from '../components/VideoSummarizerInlineView';
import TeacherGuidanceInlineView from '../components/TeacherGuidanceInlineView';

const Video = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('landing'); // 'landing', 'videoLibrary', 'videoSummarizer', 'teacherGuidance'

  const features = [
    {
      id: 'library',
      title: 'Video Library',
      description: 'Access curated educational videos with industry experts and tutorials.',
      icon: (
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
        </svg>
      ),
      bgColor: 'bg-blue-100',
      iconColor: 'text-blue-600',
      route: 'inline' // Changed to trigger inline view
    },
    {
      id: 'summarizer',
      title: 'Video Summarizer',
      description: 'Add YouTube videos and interact through chat, summaries, and quizzes.',
      icon: (
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
          <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
        </svg>
      ),
      bgColor: 'bg-purple-100',
      iconColor: 'text-purple-600',
      route: 'inline' // Changed to trigger inline view
    },
    {
      id: 'guidance',
      title: 'Teacher Guidance',
      description: 'Learn subjects with personalized guidance and structured learning paths.',
      icon: (
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0z" />
        </svg>
      ),
      bgColor: 'bg-green-100',
      iconColor: 'text-green-600',
      route: 'inline'
    }
  ];

  return (
    <>
      <Navigationinner title={"VIDEO SESSIONS"} hideLogo={true} hasSidebar={true} />
      <div className="flex bg-gray-50 min-h-screen pt-14">
        <Sidebar />
        <div className="ml-64 flex-1 p-8">

          {/* Breadcrumb */}
          <div className="flex items-center text-sm text-gray-500 mb-6">
            <span className="hover:text-blue-600 cursor-pointer" onClick={() => navigate('/home')}>
              Dashboard
            </span>
            <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span
              className={`cursor-pointer hover:text-blue-600 ${activeView === 'landing' ? 'text-gray-900 font-medium' : ''}`}
              onClick={() => setActiveView('landing')}
            >
              Video Sessions
            </span>
            {activeView === 'videoLibrary' && (
              <>
                <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-gray-900 font-medium">Video Library</span>
              </>
            )}
            {activeView === 'videoSummarizer' && (
              <>
                <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-gray-900 font-medium">Video Summarizer</span>
              </>
            )}
            {activeView === 'teacherGuidance' && (
              <>
                <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-gray-900 font-medium">Teacher Guidance</span>
              </>
            )}
          </div>

          {/* Landing View */}
          {activeView === 'landing' && (
            <>
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Video Sessions & Learning
                </h1>
                <p className="text-gray-600">
                  Access videos and AI-powered tools for enhanced learning.
                </p>
              </div>

              {/* Feature Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                {features.map((feature) => (
                  <div
                    key={feature.id}
                    className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-xl 
                             transition-all duration-300 cursor-pointer group hover:-translate-y-1"
                    onClick={() => {
                      if (feature.route === 'inline') {
                        if (feature.id === 'library') {
                          setActiveView('videoLibrary');
                        } else if (feature.id === 'summarizer') {
                          setActiveView('videoSummarizer');
                        } else if (feature.id === 'guidance') {
                          setActiveView('teacherGuidance');
                        }
                      } else {
                        navigate(feature.route);
                      }
                    }}
                  >
                    {/* Icon */}
                    <div className={`w-16 h-16 ${feature.bgColor} rounded-lg flex items-center justify-center mb-4 
                                  group-hover:scale-110 transition-transform duration-300`}>
                      <div className={feature.iconColor}>
                        {feature.icon}
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      {feature.title}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-gray-600 leading-relaxed mb-5">
                      {feature.description}
                    </p>

                    {/* Explore Button */}
                    <button className="w-full py-3 px-4 bg-blue-600 text-white text-sm font-semibold rounded-lg 
                                     hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center gap-2">
                      Explore
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Promotional Banner */}
              <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-10 relative overflow-hidden max-w-4xl">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full opacity-10 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500 rounded-full opacity-10 blur-3xl"></div>

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between">
                  <div className="flex-1 mb-6 md:mb-0">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 bg-opacity-20 
                                  border border-blue-500 rounded-full text-blue-400 text-xs font-semibold mb-4">
                      <span className="text-lg">🎬</span>
                      NEW VIDEO TUTORIALS AVAILABLE
                    </div>

                    {/* Heading */}
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                      Master New Skills with Video
                    </h2>

                    {/* Description */}
                    <p className="text-gray-300 text-base max-w-2xl">
                      Our video library is constantly updated with new masterclasses from top-tier industry professionals.
                    </p>
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => setActiveView('videoLibrary')}
                    className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg 
                             hover:bg-blue-700 transition-all duration-200 flex items-center gap-3 
                             shadow-xl hover:shadow-2xl hover:scale-105"
                  >
                    Watch Now
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Video Library Inline View */}
          {activeView === 'videoLibrary' && (
            <div>
              {/* Back Button */}
              <button
                onClick={() => setActiveView('landing')}
                className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium">Back to Video Sessions</span>
              </button>

              <VideoLibraryInlineView />
            </div>
          )}

          {/* Video Summarizer Inline View */}
          {activeView === 'videoSummarizer' && (
            <div>
              {/* Back Button */}
              <button
                onClick={() => setActiveView('landing')}
                className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium">Back to Video Sessions</span>
              </button>

              <VideoSummarizerInlineView />
            </div>
          )}

          {/* Teacher Guidance Inline View */}
          {activeView === 'teacherGuidance' && (
            <div>
              {/* Back Button */}
              <button
                onClick={() => setActiveView('landing')}
                className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium">Back to Video Sessions</span>
              </button>

              <TeacherGuidanceInlineView />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Video;
