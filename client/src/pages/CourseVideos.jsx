import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Navigationinner } from "../components/navigationinner";

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
        const foundCourse = courses.find(c => c.id === parseInt(courseId));
        if (foundCourse) {
          setCourse(foundCourse);
          setVideos(foundCourse.videos || []);
        } else {
          navigate('/teacher-dashboard');
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
        }
      } catch (error) {
        console.error('Error saving video:', error);
        const videoWithId = { ...video, id: Date.now() };
        const updatedVideos = [...videos, videoWithId];
        setVideos(updatedVideos);
        
        const savedCourses = JSON.parse(localStorage.getItem('teacherCourses') || '[]');
        const updatedCourses = savedCourses.map(c =>
          c.id === parseInt(courseId) ? { ...c, videos: updatedVideos } : c
        );
        localStorage.setItem('teacherCourses', JSON.stringify(updatedCourses));
        
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
    if (driveLink.includes('drive.google.com/file/d/')) {
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
        loadCourse();
      } else {
        const error = await response.json();
        alert(`Failed to generate quiz: ${error.error}`);
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
        <Navigationinner title={"COURSE VIDEOS"} />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-4">Course not found</h2>
            <button 
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              onClick={() => navigate('/teacher-dashboard')}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navigationinner title={`${course.title}`} />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">{course.title} - Videos</h1>
            <div className="flex gap-2">
              <button 
                className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700"
                onClick={() => navigate('/teacher-dashboard')}
              >
                ← Back
              </button>
              <button 
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
                onClick={() => setShowAddVideo(!showAddVideo)}
              >
                {showAddVideo ? 'Cancel' : 'Add Video'}
              </button>
            </div>
          </div>

          {/* Add Video Form */}
          {showAddVideo && (
            <div className="bg-white p-5 rounded-lg shadow-md mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Add New Video</h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Video Title</label>
                  <input
                    type="text"
                    value={newVideo.title}
                    onChange={(e) => setNewVideo({ ...newVideo, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="Enter video title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={newVideo.description}
                    onChange={(e) => setNewVideo({ ...newVideo, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    rows="3"
                    placeholder="Enter video description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content Summary</label>
                  <textarea
                    value={newVideo.contentSummary}
                    onChange={(e) => setNewVideo({ ...newVideo, contentSummary: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    rows="3"
                    placeholder="Summary for quiz generation"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Google Drive Link</label>
                  <input
                    type="url"
                    value={newVideo.driveLink}
                    onChange={(e) => setNewVideo({ ...newVideo, driveLink: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="Paste Google Drive link"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailUpload}
                    className="w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-md text-sm"
                  />
                </div>

                {newVideo.thumbnail && (
                  <img src={newVideo.thumbnail} alt="Preview" className="w-40 h-24 object-cover rounded-md" />
                )}

                <button 
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
                  onClick={handleAddVideo}
                >
                  Add Video
                </button>
              </div>
            </div>
          )}

          {/* Videos Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video) => (
              <div key={video.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                {video.thumbnail ? (
                  <img src={video.thumbnail} alt={video.title} className="w-full h-36 object-cover" />
                ) : (
                  <div className="w-full h-36 bg-gray-200 flex items-center justify-center text-gray-500">
                    🎥 No Thumbnail
                  </div>
                )}
                <div className="p-4">
                  <h3 className="text-base font-bold text-gray-900 mb-2">{video.title}</h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{video.description}</p>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700"
                      onClick={() => window.open(convertDriveLink(video.driveLink), '_blank')}
                    >
                      Play
                    </button>
                    <button 
                      className="flex-1 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700"
                      onClick={() => generateQuiz(video._id || video.id, video.title, video.description, video.contentSummary)}
                      disabled={generatingQuiz[video._id || video.id]}
                    >
                      {generatingQuiz[video._id || video.id] ? 'Generating...' : 'Quiz'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {videos.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No videos added yet</p>
              <p className="text-sm">Click "Add Video" to get started</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CourseVideos;
