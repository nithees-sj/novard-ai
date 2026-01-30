import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Navigationinner } from "../components/navigationinner";
import Sidebar from '../components/Sidebar';

const CourseVideos = () => {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [videos, setVideos] = useState([]);
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [newVideo, setNewVideo] = useState({
    title: '',
    description: '',
    driveLink: '',
    thumbnail: null,
    contentSummary: ''
  });
  const [generatingQuiz, setGeneratingQuiz] = useState({});

  const loadCourse = useCallback(async () => {
    try {
      if (!courseId || courseId === 'undefined') {
        console.error('Invalid course ID');
        navigate('/teacher-dashboard');
        return;
      }
      
      const response = await fetch(`${process.env.REACT_APP_API_ENDPOINT}/api/courses/${courseId}`);
      if (response.ok) {
        const courseData = await response.json();
        setCourse(courseData);
        setVideos(courseData.videos || []);
      } else {
        console.error('Course not found');
        navigate('/teacher-dashboard');
      }
    } catch (error) {
      console.error('Error loading course:', error);
      const savedCourses = localStorage.getItem('teacherCourses');
      if (savedCourses) {
        const courses = JSON.parse(savedCourses);
        const foundCourse = courses.find(c => c.id === parseInt(courseId) || c._id === courseId);
        if (foundCourse) {
          setCourse(foundCourse);
          setVideos(foundCourse.videos || []);
        } else {
          // Try loose comparison for ID match
          const looseMatch = courses.find(c => String(c.id) === String(courseId) || String(c._id) === String(courseId));
          if (looseMatch) {
            setCourse(looseMatch);
            setVideos(looseMatch.videos || []);
          } else {
            navigate('/teacher-dashboard');
          }
        }
      } else {
        navigate('/teacher-dashboard');
      }
    }
  }, [courseId, navigate]);

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('teacherLoggedIn');
    if (!isLoggedIn) {
      navigate('/teacher-login');
      return;
    }
    loadCourse();
  }, [loadCourse, navigate]);

  const handleAddVideo = async () => {
    if (newVideo.title && newVideo.driveLink) {
      const video = {
        title: newVideo.title,
        description: newVideo.description,
        driveLink: newVideo.driveLink,
        thumbnail: newVideo.thumbnail,
        contentSummary: newVideo.contentSummary,
        createdAt: new Date().toISOString()
      };
      
      try {
        const response = await fetch(`${process.env.REACT_APP_API_ENDPOINT}/api/courses/${courseId}/videos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(video)
        });
        
        if (response.ok) {
          const savedVideo = await response.json();
          setVideos([...videos, savedVideo]);
          setNewVideo({ title: '', description: '', driveLink: '', thumbnail: null, contentSummary: '' });
          setShowAddVideo(false);
        } else {
          // Fallback if API fails but we want to simulate success locally
          throw new Error('API reported failure, falling back to local');
        }
      } catch (error) {
        console.error('Error saving video:', error);

        // Optimistic update for local storage fallback
        const videoWithId = { ...video, id: Date.now(), _id: String(Date.now()) };
        const updatedVideos = [...videos, videoWithId];
        setVideos(updatedVideos);
        
        // Update local storage courses
        const savedCourses = JSON.parse(localStorage.getItem('teacherCourses') || '[]');
        const updatedCoursesList = savedCourses.map(c => {
          if (String(c.id) === String(courseId) || String(c._id) === String(courseId)) {
            return { ...c, videos: updatedVideos };
          }
          return c;
        });
        localStorage.setItem('teacherCourses', JSON.stringify(updatedCoursesList));
        
        setNewVideo({ title: '', description: '', driveLink: '', thumbnail: null, contentSummary: '' });
        setShowAddVideo(false);
      }
    }
  };

  const handleThumbnailUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setNewVideo({ ...newVideo, thumbnail: e.target.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const convertDriveLink = (driveLink) => {
    if (driveLink && driveLink.includes('drive.google.com/file/d/')) {
      const fileId = driveLink.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1];
      if (fileId) {
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }
    }
    return driveLink;
  };

  const generateQuiz = async (videoId, videoTitle, videoDescription, videoContentSummary) => {
    setGeneratingQuiz(prev => ({ ...prev, [videoId]: true }));

    try {
      const response = await fetch(`${process.env.REACT_APP_API_ENDPOINT}/api/courses/${courseId}/videos/${videoId}/generate-quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoTitle,
          videoDescription,
          videoContentSummary
        })
      });

      if (response.ok) {
        await response.json();
        alert('Quiz generated successfully!');
        loadCourse(); // Reload to update UI if needed
      } else {
        const error = await response.json();
        alert(`Failed to generate quiz: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error generating quiz:', error);
      alert('Failed to generate quiz. Please try again.');
    } finally {
      setGeneratingQuiz(prev => ({ ...prev, [videoId]: false }));
    }
  };

  if (!course) {
    return (
      <>
        <Navigationinner title={"COURSE VIDEOS"} hideLogo={true} hasSidebar={true} />
        <div className="flex bg-gray-50 min-h-screen pt-14">
          <Sidebar />
          <div className="ml-64 flex-1 p-8 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-gray-700">Loading course details...</h2>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navigationinner title={"COURSE VIDEOS"} hideLogo={true} hasSidebar={true} />
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
            <span className="hover:text-blue-600 cursor-pointer" onClick={() => navigate('/teacher-dashboard')}>
              Teacher Dashboard
            </span>
            <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-900 font-medium truncate max-w-[200px]">{course.title}</span>
          </div>

          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{course.title}</h1>
              <p className="text-gray-600 text-sm">Manage videos and quizzes for this course</p>
            </div>
            <div className="flex gap-3">
              <button 
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
                onClick={() => navigate('/teacher-dashboard')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Dashboard
              </button>
              <button 
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 shadow-sm"
                onClick={() => setShowAddVideo(!showAddVideo)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {showAddVideo ? 'Cancel' : 'Add New Video'}
              </button>
            </div>
          </div>

          {/* Add Video Form */}
          {showAddVideo && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6 mb-8 animate-fade-in relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
              <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm">
                  📹
                </span>
                Add New Video Module
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Video Title</label>
                    <input
                      type="text"
                      value={newVideo.title}
                      onChange={(e) => setNewVideo({ ...newVideo, title: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow"
                      placeholder="e.g. Introduction to Variables"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Google Drive Link</label>
                    <input
                      type="url"
                      value={newVideo.driveLink}
                      onChange={(e) => setNewVideo({ ...newVideo, driveLink: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow"
                      placeholder="https://drive.google.com/Mxk..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Thumbnail Image</label>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleThumbnailUpload}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                    <textarea
                      value={newVideo.description}
                      onChange={(e) => setNewVideo({ ...newVideo, description: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow resize-none"
                      rows="3"
                      placeholder="Briefly describe what this video covers..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Content Summary
                      <span className="ml-2 text-xs font-normal text-gray-500">(Required for AI Quiz Generation)</span>
                    </label>
                    <textarea
                      value={newVideo.contentSummary}
                      onChange={(e) => setNewVideo({ ...newVideo, contentSummary: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow resize-none"
                      rows="3"
                      placeholder="Paste transcript or detailed summary here..."
                    />
                  </div>
                </div>
              </div>

              {newVideo.thumbnail && (
                <div className="mt-4 p-2 border border-dashed border-gray-300 rounded-lg inline-block">
                  <span className="text-xs text-gray-500 block mb-1">Thumbnail Preview:</span>
                  <img src={newVideo.thumbnail} alt="Thumbnail Preview" className="h-24 w-auto object-cover rounded shadow-sm" />
                </div>
              )}

              <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                  onClick={() => setShowAddVideo(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-md hover:shadow-lg transform active:scale-95 duration-150"
                  onClick={handleAddVideo}
                >
                  Save Video Module
                </button>
              </div>
            </div>
          )}

          {/* Videos Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
            {videos.length > 0 ? (
              videos.map((video, index) => (
                <div
                  key={video.id || video._id || index}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 group flex flex-col h-full"
                >
                  {/* Thumbnail Area */}
                  <div className="relative aspect-video bg-gray-100 group overflow-hidden">
                    {video.thumbnail ? (
                      <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col items-center justify-center text-gray-400">
                        <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs uppercase tracking-wider font-medium">No Thumbnail</span>
                      </div>
                    )}

                    {/* Overlay Play Button */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
                      <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-300">
                        <svg className="w-5 h-5 text-blue-600 ml-1" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-1" title={video.title}>{video.title}</h3>
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[40px]">{video.description || 'No description provided.'}</p>
                    </div>

                    <div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 mt-auto">
                    <button 
                        className="px-3 py-2 bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                      onClick={() => window.open(convertDriveLink(video.driveLink), '_blank')}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Watch Video
                    </button>
                    <button 
                        className={`px-3 py-2 text-white text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm
                         ${generatingQuiz[video._id || video.id]
                            ? 'bg-purple-400 cursor-wait'
                            : 'bg-purple-600 hover:bg-purple-700 hover:scale-[1.02]'}`}
                      onClick={() => generateQuiz(video._id || video.id, video.title, video.description, video.contentSummary)}
                      disabled={generatingQuiz[video._id || video.id]}
                    >
                        {generatingQuiz[video._id || video.id] ? (
                          <>
                            <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            Generate Quiz
                          </>
                        )}
                    </button>
                  </div>
                </div>
              </div>
              ))) : (
              null
            )}

            {/* Empty State / Add First Video Placeholder */}
            {videos.length === 0 && (
              <div className="col-span-full py-16 flex flex-col items-center justify-center text-center bg-white rounded-xl border border-dashed border-gray-300">
                <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4 text-3xl shadow-sm">
                  🎬
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No videos added yet</h3>
                <p className="text-gray-500 max-w-sm mb-6">Start by adding your first video lecture to this course. You can include a summary to auto-generate quizzes.</p>
                <button
                  onClick={() => setShowAddVideo(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add First Video
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CourseVideos;
