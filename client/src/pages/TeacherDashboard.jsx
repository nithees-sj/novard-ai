import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigationinner } from "../components/navigationinner";
import Sidebar from '../components/Sidebar';

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newCourse, setNewCourse] = useState({
    title: '',
    description: '',
    category: 'programming',
    difficulty: 'beginner',
    image: null
  });

  useEffect(() => {
    // Check if teacher is logged in
    const isLoggedIn = localStorage.getItem('teacherLoggedIn');
    if (!isLoggedIn) {
      navigate('/teacher-login');
    }
    
    // Load existing courses from global storage
    loadCourses();
  }, [navigate]);

  const loadCourses = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_ENDPOINT}/api/courses`);
      if (response.ok) {
        const data = await response.json();
        setCourses(data);
      }
    } catch (error) {
      console.error('Error loading courses:', error);
      // Fallback to localStorage if API fails
      const savedCourses = localStorage.getItem('teacherCourses');
      if (savedCourses) {
        setCourses(JSON.parse(savedCourses));
      }
    }
  };

  const handleAddCourse = async () => {
    if (newCourse.title && newCourse.description) {
      const course = {
        title: newCourse.title,
        description: newCourse.description,
        category: newCourse.category,
        difficulty: newCourse.difficulty,
        image: newCourse.image,
        videos: [],
        createdAt: new Date().toISOString(),
        teacherEmail: localStorage.getItem('teacherEmail')
      };
      
      try {
        const response = await fetch(`${process.env.REACT_APP_API_ENDPOINT}/api/courses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(course)
        });
        
        if (response.ok) {
          const savedCourse = await response.json();
          setCourses([...courses, savedCourse]);
          setNewCourse({ title: '', description: '', category: 'programming', difficulty: 'beginner', image: null });
          setShowAddCourse(false);
        } else {
          console.error('Failed to save course');
        }
      } catch (error) {
        console.error('Error saving course:', error);
        // Fallback to localStorage
        const courseWithId = { ...course, id: Date.now() };
        const updatedCourses = [...courses, courseWithId];
        setCourses(updatedCourses);
        localStorage.setItem('teacherCourses', JSON.stringify(updatedCourses));
        setNewCourse({ title: '', description: '', category: 'programming', difficulty: 'beginner', image: null });
        setShowAddCourse(false);
      }
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setNewCourse({ ...newCourse, image: e.target.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('teacherLoggedIn');
    localStorage.removeItem('teacherEmail');
    navigate('/teacher-login');
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

  return (
    <>
      <Navigationinner title={"TEACHER DASHBOARD"} hideLogo={true} hasSidebar={true} />
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
            <span className="text-gray-900 font-medium">Teacher Dashboard</span>
          </div>

          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome, Teacher! 👨‍🏫
            </h2>
            <p className="text-gray-600">
              Manage your courses and educational content from this dashboard.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setShowAddCourse(!showAddCourse)}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       transition-colors font-medium text-sm flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {showAddCourse ? 'Cancel' : 'Add New Course'}
            </button>
            <button
              onClick={handleLogout}
              className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 
                       transition-colors font-medium text-sm flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>

          {/* Add Course Form */}
          {showAddCourse && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6 mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Add New Course</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Course Title */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Course Title
                  </label>
                  <input
                    type="text"
                    value={newCourse.title}
                    onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none 
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter course title (e.g., Introduction to Python)"
                  />
                </div>

                {/* Course Description */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Course Description
                  </label>
                  <textarea
                    value={newCourse.description}
                    onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none 
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows="3"
                    placeholder="Describe what students will learn in this course"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={newCourse.category}
                    onChange={(e) => setNewCourse({ ...newCourse, category: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none 
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="programming">Programming</option>
                    <option value="design">Design</option>
                    <option value="marketing">Marketing</option>
                  </select>
                </div>

                {/* Difficulty */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Difficulty Level
                  </label>
                  <select
                    value={newCourse.difficulty}
                    onChange={(e) => setNewCourse({ ...newCourse, difficulty: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none 
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                {/* Course Image */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Course Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="w-full px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg 
                             cursor-pointer hover:border-blue-400 transition-colors"
                  />
                  {newCourse.image && (
                    <div className="mt-4">
                      <img
                        src={newCourse.image}
                        alt="Course preview" 
                        className="w-48 h-32 object-cover rounded-lg border border-gray-200"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleAddCourse}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                           transition-colors font-medium text-sm"
                >
                  Create Course
                </button>
                <button
                  onClick={() => setShowAddCourse(false)}
                  className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 
                           transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Courses Grid */}
          <div className="overflow-y-auto h-[calc(100vh-450px)] scroll-smooth scrollbar-hide pr-2">
            {courses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.map((course) => {
                  const badge = getDifficultyBadge(course.difficulty || 'beginner');
                  const icon = getCourseIcon(course.category);

                  return (
                    <div
                      key={course._id || course.id}
                      className="bg-white rounded-xl border border-gray-200 overflow-hidden 
                               hover:shadow-xl transition-all duration-300 group"
                    >
                      {/* Course Image */}
                      {course.image ? (
                        <img
                          src={course.image}
                          alt={course.title}
                          className="w-full h-48 object-cover"
                        />
                      ) : (
                        <div className="w-full h-48 bg-gradient-to-br from-blue-50 to-blue-100 
                                      flex items-center justify-center">
                          <span className="text-6xl">{icon}</span>
                        </div>
                      )}

                      {/* Card Content */}
                      <div className="p-6">
                        {/* Badge and Title */}
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-lg font-bold text-gray-900 flex-1 pr-2">
                            {course.title}
                          </h3>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${badge.color} whitespace-nowrap`}>
                            {badge.label}
                          </span>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                          {course.description}
                        </p>

                        {/* Stats */}
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                          <div className="flex items-center gap-1">
                            <span>📹</span>
                            <span>{course.videos?.length || 0} Videos</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>📅</span>
                            <span>{new Date(course.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate(`/course-videos/${course._id || course.id}`)}
                            className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-xs 
                                     font-medium hover:bg-green-700 transition-colors flex items-center 
                                     justify-center gap-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Videos
                          </button>
                          <button
                            onClick={() => {/* Edit functionality */ }}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium 
                                     hover:bg-blue-700 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to delete this course?')) {
                                try {
                                  const response = await fetch(`${process.env.REACT_APP_API_ENDPOINT}/api/courses/${course._id || course.id}`, {
                                    method: 'DELETE'
                                  });

                                  if (response.ok) {
                                    const updatedCourses = courses.filter(c => (c._id || c.id) !== (course._id || course.id));
                                    setCourses(updatedCourses);
                                  } else {
                                    console.error('Failed to delete course');
                                  }
                                } catch (error) {
                                  console.error('Error deleting course:', error);
                                  // Fallback to localStorage
                                  const updatedCourses = courses.filter(c => (c._id || c.id) !== (course._id || course.id));
                                  setCourses(updatedCourses);
                                  localStorage.setItem('teacherCourses', JSON.stringify(updatedCourses));
                                }
                              }
                            }}
                            className="px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-medium 
                                     hover:bg-red-700 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <div className="text-6xl mb-4">📚</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Courses Yet</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Create your first course to start teaching
                  </p>
                  <button
                    onClick={() => setShowAddCourse(true)}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                             transition-colors font-medium text-sm"
                  >
                      Add New Course
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default TeacherDashboard;
