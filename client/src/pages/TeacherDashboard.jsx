import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigationinner } from "../components/navigationinner";

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newCourse, setNewCourse] = useState({
    title: '',
    description: '',
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
          setNewCourse({ title: '', description: '', image: null });
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
        setNewCourse({ title: '', description: '', image: null });
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
    navigate('/teacher-login');
  };

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '2rem'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '2rem',
      padding: '1rem 0',
      borderBottom: '2px solid #e2e8f0'
    },
    title: {
      fontSize: '2.5rem',
      fontWeight: 'bold',
      color: '#1a202c'
    },
    button: {
      backgroundColor: '#667eea',
      color: 'white',
      border: 'none',
      padding: '0.8rem 1.5rem',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: '600',
      marginLeft: '1rem'
    },
    logoutButton: {
      backgroundColor: '#e53e3e',
      color: 'white',
      border: 'none',
      padding: '0.8rem 1.5rem',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: '600'
    },
    addCourseForm: {
      backgroundColor: 'white',
      padding: '1.5rem',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      marginBottom: '1.5rem'
    },
    formGroup: {
      marginBottom: '1rem'
    },
    label: {
      display: 'block',
      fontSize: '1rem',
      fontWeight: '600',
      color: '#374151',
      marginBottom: '0.5rem'
    },
    input: {
      width: '100%',
      padding: '0.8rem',
      border: '2px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '1rem',
      outline: 'none'
    },
    textarea: {
      width: '100%',
      padding: '0.8rem',
      border: '2px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '1rem',
      outline: 'none',
      minHeight: '100px',
      resize: 'vertical'
    },
    fileInput: {
      width: '100%',
      padding: '0.8rem',
      border: '2px dashed #d1d5db',
      borderRadius: '6px',
      fontSize: '1rem',
      cursor: 'pointer'
    },
    coursesGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '1.5rem'
    },
    courseCard: {
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      overflow: 'hidden',
      transition: 'transform 0.2s ease'
    },
    courseImage: {
      width: '100%',
      height: '200px',
      objectFit: 'cover'
    },
    courseContent: {
      padding: '1.5rem'
    },
    courseTitle: {
      fontSize: '1.25rem',
      fontWeight: 'bold',
      color: '#1a202c',
      marginBottom: '0.5rem'
    },
    courseDescription: {
      color: '#6b7280',
      marginBottom: '1rem',
      lineHeight: '1.5',
      fontSize: '1rem'
    },
    courseActions: {
      display: 'flex',
      gap: '0.5rem'
    },
    actionButton: {
      padding: '0.6rem 1rem',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '0.9rem',
      fontWeight: '500'
    },
    addVideoButton: {
      backgroundColor: '#10b981',
      color: 'white'
    },
    editButton: {
      backgroundColor: '#3b82f6',
      color: 'white'
    },
    deleteButton: {
      backgroundColor: '#ef4444',
      color: 'white'
    }
  };

  return (
    <>
      <Navigationinner title={"TEACHER DASHBOARD"} />
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Teacher Dashboard</h1>
          <div>
            <button 
              style={styles.button}
              onClick={() => setShowAddCourse(!showAddCourse)}
            >
              {showAddCourse ? 'Cancel' : 'Add New Course'}
            </button>
            <button 
              style={styles.logoutButton}
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>

        {showAddCourse && (
          <div style={styles.addCourseForm}>
            <h2 style={{ marginBottom: '1.5rem', color: '#1a202c' }}>Add New Course</h2>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Course Title</label>
              <input
                type="text"
                value={newCourse.title}
                onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                style={styles.input}
                placeholder="Enter course title"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Course Description</label>
              <textarea
                value={newCourse.description}
                onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                style={styles.textarea}
                placeholder="Enter course description"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Course Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={styles.fileInput}
              />
            </div>

            {newCourse.image && (
              <div style={{ marginBottom: '1rem' }}>
                <img 
                  src={newCourse.image} 
                  alt="Course preview" 
                  style={{ width: '200px', height: '120px', objectFit: 'cover', borderRadius: '6px' }}
                />
              </div>
            )}

            <button 
              style={styles.button}
              onClick={handleAddCourse}
            >
              Create Course
            </button>
          </div>
        )}

        <div style={styles.coursesGrid}>
          {courses.map((course) => (
            <div key={course.id} style={styles.courseCard}>
              {course.image && (
                <img 
                  src={course.image} 
                  alt={course.title} 
                  style={styles.courseImage}
                />
              )}
              <div style={styles.courseContent}>
                <h3 style={styles.courseTitle}>{course.title}</h3>
                <p style={styles.courseDescription}>{course.description}</p>
                <div style={styles.courseActions}>
                  <button 
                    style={{...styles.actionButton, ...styles.addVideoButton}}
                    onClick={() => navigate(`/course-videos/${course._id || course.id}`)}
                  >
                    Add Videos
                  </button>
                  <button 
                    style={{...styles.actionButton, ...styles.editButton}}
                    onClick={() => {/* Edit functionality */}}
                  >
                    Edit
                  </button>
                  <button 
                    style={{...styles.actionButton, ...styles.deleteButton}}
                    onClick={async () => {
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
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default TeacherDashboard;
