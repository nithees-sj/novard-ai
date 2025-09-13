import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    // Check if teacher is logged in
    const isLoggedIn = localStorage.getItem('teacherLoggedIn');
    if (!isLoggedIn) {
      navigate('/teacher-login');
      return;
    }

    // Load course and videos
    loadCourse();
  }, [courseId, navigate]);

  const loadCourse = async () => {
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
      // Fallback to localStorage
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
  };

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
          console.error('Failed to save video');
        }
      } catch (error) {
        console.error('Error saving video:', error);
        // Fallback to localStorage
        const videoWithId = { ...video, id: Date.now() };
        const updatedVideos = [...videos, videoWithId];
        setVideos(updatedVideos);
        
        const savedCourses = JSON.parse(localStorage.getItem('teacherCourses') || '[]');
        const updatedCourses = savedCourses.map(c => 
          c.id === parseInt(courseId) 
            ? { ...c, videos: updatedVideos }
            : c
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
    // Convert Google Drive sharing link to embeddable format
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
    
    // Debug logging
    console.log('Generating quiz for video:', {
      videoId,
      videoTitle,
      videoDescription,
      videoContentSummary
    });
    
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
        const result = await response.json();
        alert('Quiz generated successfully!');
        // Reload the course to get updated video data
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
      fontSize: '2rem',
      fontWeight: 'bold',
      color: '#1a202c'
    },
    backButton: {
      backgroundColor: '#6b7280',
      color: 'white',
      border: 'none',
      padding: '0.8rem 1.5rem',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: '600',
      marginRight: '1rem'
    },
    addButton: {
      backgroundColor: '#10b981',
      color: 'white',
      border: 'none',
      padding: '0.8rem 1.5rem',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: '600'
    },
    addVideoForm: {
      backgroundColor: 'white',
      padding: '2rem',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      marginBottom: '2rem'
    },
    formGroup: {
      marginBottom: '1.5rem'
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
    videosGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
      gap: '1.5rem'
    },
    videoCard: {
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      overflow: 'hidden',
      transition: 'transform 0.2s ease'
    },
    videoThumbnail: {
      width: '100%',
      height: '200px',
      objectFit: 'cover'
    },
    videoContent: {
      padding: '1.5rem'
    },
    videoTitle: {
      fontSize: '1.25rem',
      fontWeight: 'bold',
      color: '#1a202c',
      marginBottom: '0.5rem'
    },
    videoDescription: {
      color: '#6b7280',
      marginBottom: '1rem',
      lineHeight: '1.5'
    },
    videoActions: {
      display: 'flex',
      gap: '0.5rem'
    },
    actionButton: {
      padding: '0.5rem 1rem',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '0.9rem',
      fontWeight: '500'
    },
    playButton: {
      backgroundColor: '#3b82f6',
      color: 'white'
    },
    generateQuizButton: {
      backgroundColor: '#8b5cf6',
      color: 'white'
    },
    editButton: {
      backgroundColor: '#f59e0b',
      color: 'white'
    },
    deleteButton: {
      backgroundColor: '#ef4444',
      color: 'white'
    },
    iframe: {
      width: '100%',
      height: '400px',
      border: 'none',
      borderRadius: '8px'
    }
  };

  if (!course) {
    return (
      <>
        <Navigationinner title={"COURSE VIDEOS"} />
        <div style={styles.container}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h2>Course not found</h2>
            <button 
              style={styles.backButton}
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
      <Navigationinner title={`${course.title} - Videos`} />
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>{course.title} - Videos</h1>
          <div>
            <button 
              style={styles.backButton}
              onClick={() => navigate('/teacher-dashboard')}
            >
              ← Back to Dashboard
            </button>
            <button 
              style={styles.addButton}
              onClick={() => setShowAddVideo(!showAddVideo)}
            >
              {showAddVideo ? 'Cancel' : 'Add Video'}
            </button>
          </div>
        </div>

        {showAddVideo && (
          <div style={styles.addVideoForm}>
            <h2 style={{ marginBottom: '1.5rem', color: '#1a202c' }}>Add New Video</h2>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Video Title</label>
              <input
                type="text"
                value={newVideo.title}
                onChange={(e) => setNewVideo({ ...newVideo, title: e.target.value })}
                style={styles.input}
                placeholder="Enter video title"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Video Description</label>
              <textarea
                value={newVideo.description}
                onChange={(e) => setNewVideo({ ...newVideo, description: e.target.value })}
                style={styles.textarea}
                placeholder="Enter video description"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Video Content Summary (for Quiz Generation)</label>
              <textarea
                value={newVideo.contentSummary}
                onChange={(e) => setNewVideo({ ...newVideo, contentSummary: e.target.value })}
                style={styles.textarea}
                placeholder="Provide a detailed summary of the key concepts, topics, and learning objectives covered in this video. This will help generate relevant quiz questions."
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Google Drive Link</label>
              <input
                type="url"
                value={newVideo.driveLink}
                onChange={(e) => setNewVideo({ ...newVideo, driveLink: e.target.value })}
                style={styles.input}
                placeholder="Paste Google Drive sharing link here"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Video Thumbnail (Optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleThumbnailUpload}
                style={styles.fileInput}
              />
            </div>

            {newVideo.thumbnail && (
              <div style={{ marginBottom: '1rem' }}>
                <img 
                  src={newVideo.thumbnail} 
                  alt="Thumbnail preview" 
                  style={{ width: '200px', height: '120px', objectFit: 'cover', borderRadius: '6px' }}
                />
              </div>
            )}

            <button 
              style={styles.addButton}
              onClick={handleAddVideo}
            >
              Add Video
            </button>
          </div>
        )}

        <div style={styles.videosGrid}>
          {videos.map((video) => (
            <div key={video.id} style={styles.videoCard}>
              {video.thumbnail ? (
                <img 
                  src={video.thumbnail} 
                  alt={video.title} 
                  style={styles.videoThumbnail}
                />
              ) : (
                <div style={{...styles.videoThumbnail, backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                  🎥 No Thumbnail
                </div>
              )}
              <div style={styles.videoContent}>
                <h3 style={styles.videoTitle}>{video.title}</h3>
                <p style={styles.videoDescription}>{video.description}</p>
                <div style={styles.videoActions}>
                  <button 
                    style={{...styles.actionButton, ...styles.playButton}}
                    onClick={() => {
                      const embedLink = convertDriveLink(video.driveLink);
                      window.open(embedLink, '_blank');
                    }}
                  >
                    Play Video
                  </button>
                  <button 
                    style={{...styles.actionButton, ...styles.generateQuizButton}}
                    onClick={() => generateQuiz(video._id || video.id, video.title, video.description, video.contentSummary)}
                    disabled={generatingQuiz[video._id || video.id]}
                  >
                    {generatingQuiz[video._id || video.id] ? 'Generating...' : 'Generate Quiz'}
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
                        const response = await fetch(`${process.env.REACT_APP_API_ENDPOINT}/api/courses/${courseId}/videos/${video._id || video.id}`, {
                          method: 'DELETE'
                        });
                        
                        if (response.ok) {
                          const updatedVideos = videos.filter(v => (v._id || v.id) !== (video._id || video.id));
                          setVideos(updatedVideos);
                        } else {
                          console.error('Failed to delete video');
                        }
                      } catch (error) {
                        console.error('Error deleting video:', error);
                        // Fallback to localStorage
                        const updatedVideos = videos.filter(v => (v._id || v.id) !== (video._id || video.id));
                        setVideos(updatedVideos);
                        
                        const savedCourses = JSON.parse(localStorage.getItem('teacherCourses') || '[]');
                        const updatedCourses = savedCourses.map(c => 
                          c.id === parseInt(courseId) 
                            ? { ...c, videos: updatedVideos }
                            : c
                        );
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

        {videos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            <h3>No videos added yet</h3>
            <p>Click "Add Video" to start adding videos to this course</p>
          </div>
        )}
      </div>
    </>
  );
};

export default CourseVideos;
