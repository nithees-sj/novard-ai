import React, { useState, useEffect } from 'react';

const TeacherGuidanceInlineView = () => {
  const [courses, setCourses] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showVideoModal, setShowVideoModal] = useState(false);

  const categories = [
    { id: 'all', label: 'All Courses', color: 'bg-blue-600' },
    { id: 'programming', label: 'Programming', color: 'bg-blue-600' },
    { id: 'design', label: 'Design', color: 'bg-blue-600' },
    { id: 'marketing', label: 'Marketing', color: 'bg-blue-600' },
  ];

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_ENDPOINT}/api/courses`);
      if (response.ok) {
        const data = await response.json();
        setCourses(data);
      }
    } catch (error) {
      console.error('Error loading courses:', error);
      const savedCourses = localStorage.getItem('teacherCourses');
      if (savedCourses) {
        setCourses(JSON.parse(savedCourses));
      }
    }
  };

  const getDifficultyBadge = (level) => {
    const badges = {
      beginner: { label: 'BEGINNER', color: 'bg-green-100 text-green-700' },
      intermediate: { label: 'INTERMEDIATE', color: 'bg-yellow-100 text-yellow-700' },
      advanced: { label: 'ADVANCED', color: 'bg-red-100 text-red-700' },
    };
    return badges[level?.toLowerCase()] || badges.beginner;
  };

  const getCourseIcon = (category) => {
    const icons = {
      programming: '💻',
      design: '🎨',
      marketing: '📢',
      default: '📚',
    };
    return icons[category?.toLowerCase()] || icons.default;
  };

  const filteredCourses = courses.filter(course => {
    if (selectedCategory === 'all') return true;
    return course.category?.toLowerCase() === selectedCategory;
  });

  const handleCourseClick = (course) => {
    setSelectedCourse(course);
  };

  const handleVideoClick = (video) => {
    setSelectedVideo(video);
    setShowVideoModal(true);
  };

  if (selectedCourse) {
    return (
      <div className="h-[calc(100vh-200px)]">
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <button
            onClick={() => setSelectedCourse(null)}
            className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Back to Courses</span>
          </button>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedCourse.title}</h2>
          <p className="text-gray-600">{selectedCourse.description}</p>
        </div>

        {/* Videos Grid */}
        <div className="overflow-y-auto h-[calc(100%-200px)] scroll-smooth scrollbar-hide">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Course Videos</h3>
          {selectedCourse.videos && selectedCourse.videos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedCourse.videos.map((video, index) => (
                <div
                  key={video._id || video.id || index}
                  onClick={() => handleVideoClick(video)}
                  className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-3xl">📹</div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">{video.title}</h4>
                      <p className="text-xs text-gray-600 line-clamp-2">{video.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Video {index + 1}</span>
                    {video.quiz && video.quiz.questions && video.quiz.questions.length > 0 && (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">Quiz Available</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-600">No videos available for this course</p>
            </div>
          )}
        </div>

        {/* Video Modal */}
        {showVideoModal && selectedVideo && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">{selectedVideo.title}</h3>
                <button
                  onClick={() => setShowVideoModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="p-4">
                {selectedVideo.videoUrl && (
                  <div className="aspect-video mb-4">
                    <iframe
                      src={selectedVideo.videoUrl}
                      title={selectedVideo.title}
                      className="w-full h-full rounded-lg"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
                <p className="text-sm text-gray-700">{selectedVideo.description}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome back, Student! 👋
        </h2>
        <p className="text-gray-600">
          Explore the latest teacher guidance materials and structured course modules.
        </p>
      </div>

      {/* Filters and Sort */}
      <div className="flex items-center justify-between mb-6">
        {/* Category Tabs */}
        <div className="flex gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === category.id
                  ? `${category.color} text-white`
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="recent">Recently Updated</option>
            <option value="title">Title (A-Z)</option>
            <option value="videos">Most Videos</option>
          </select>
        </div>
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto h-[calc(100vh-500px)] scroll-smooth scrollbar-hide pr-2">
        {filteredCourses.length > 0 ? (
          <>
            {filteredCourses.map((course) => {
              const badge = getDifficultyBadge(course.difficulty || 'beginner');
              const icon = getCourseIcon(course.category);

              return (
                <div
                  key={course._id || course.id}
                  onClick={() => handleCourseClick(course)}
                  className="bg-white rounded-xl border border-gray-200 p-6 cursor-pointer hover:shadow-xl transition-all duration-300 group"
                >
                  {/* Icon and Badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center text-2xl">
                      {icon}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {course.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {course.description}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <span>👁️</span>
                      <span>{course.videos?.length || 0} Videos</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>📅</span>
                      <span>{new Date(course.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                    </div>
                  </div>

                  {/* Arrow Button */}
                  <div className="mt-4 flex justify-end">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div className="col-span-full flex items-center justify-center h-96">
            <div className="text-center">
              <div className="text-6xl mb-4">📚</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Courses Available</h3>
              <p className="text-sm text-gray-600">Courses will appear here when they're added</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherGuidanceInlineView;
