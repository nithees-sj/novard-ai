import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigationinner } from "../components/navigationinner";
import ChatbotButton from '../components/ChatbotButton';

const TeacherGuidance = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [quizResults, setQuizResults] = useState({});
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(null);
  const [activeVideoTab, setActiveVideoTab] = useState('all');
  const [activeQuizTab, setActiveQuizTab] = useState('all');

  useEffect(() => {
    // Load courses from API
    loadCourses();
  }, []);

  useEffect(() => {
    // Load quizzes when selected course changes
    if (selectedCourse) {
      loadQuizzes(selectedCourse._id || selectedCourse.id);
    }
  }, [selectedCourse]);

  const loadCourses = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_ENDPOINT}/api/courses`);
      if (response.ok) {
        const data = await response.json();
        setCourses(data);
      }
    } catch (error) {
      console.error('Error loading courses:', error);
      // Fallback to localStorage
      const savedCourses = localStorage.getItem('teacherCourses');
      if (savedCourses) {
        setCourses(JSON.parse(savedCourses));
      }
    }
  };

  const loadQuizzes = async (courseId) => {
    try {
      // Load quizzes from the course data (quizzes are stored within videos)
      if (selectedCourse && selectedCourse.videos) {
        console.log('Loading quizzes for course:', selectedCourse.title);
        console.log('Videos in course:', selectedCourse.videos);
        
        const videoQuizzes = [];
        selectedCourse.videos.forEach((video) => {
          console.log('Checking video:', video.title, 'Quiz data:', video.quiz);
          if (video.quiz && video.quiz.questions && video.quiz.questions.length > 0) {
            videoQuizzes.push({
              id: `video-${video._id || video.id}`,
              videoId: video._id || video.id,
              videoTitle: video.title,
              title: video.quiz.title || `${video.title} Quiz`,
              description: video.quiz.description || `Test your understanding of ${video.title}`,
              questions: video.quiz.questions.length,
              completed: false,
              score: null,
              quiz: video.quiz
            });
          }
        });
        
        console.log('Found quizzes:', videoQuizzes);
        setQuizzes(videoQuizzes);
      }
    } catch (error) {
      console.error('Error loading quizzes:', error);
      setQuizzes([]);
    }
  };

  const handleQuizStart = (quizId) => {
    const quiz = quizzes.find(q => q.id === quizId);
    if (quiz) {
      setSelectedQuiz(quiz);
      setQuizAnswers({});
      setQuizSubmitted(false);
      setQuizScore(null);
      setShowQuizModal(true);
    }
  };

  const handleQuizAnswer = (questionIndex, answerIndex) => {
    setQuizAnswers(prev => ({
      ...prev,
      [questionIndex]: answerIndex
    }));
  };

  const handleQuizSubmit = async () => {
    if (!selectedQuiz || !selectedCourse) return;

    const answers = Object.values(quizAnswers);
    if (answers.length !== selectedQuiz.quiz.questions.length) {
      alert('Please answer all questions before submitting.');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_ENDPOINT}/api/courses/${selectedCourse._id || selectedCourse.id}/videos/${selectedQuiz.videoId}/quiz/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answers: answers,
          userEmail: 'user@example.com' // You can get this from user context
        })
      });

      if (response.ok) {
        const result = await response.json();
        setQuizScore(result);
        setQuizSubmitted(true);
        setQuizResults(prev => ({
          ...prev,
          [selectedQuiz.id]: { completed: true, score: result.score }
        }));
      } else {
        const error = await response.json();
        alert(`Failed to submit quiz: ${error.error}`);
      }
    } catch (error) {
      console.error('Error submitting quiz:', error);
      alert('Failed to submit quiz. Please try again.');
    }
  };

  const handleQuizComplete = (quizId, score) => {
    setQuizResults(prev => ({
      ...prev,
      [quizId]: { completed: true, score }
    }));
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

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '2rem',
      alignItems: 'center',
      justifyContent: 'flex-start'
    },
    pageTitle: {
      fontSize: '2.5rem',
      fontWeight: 'bold',
      color: '#1a202c',
      marginBottom: '1rem',
      textAlign: 'center'
    },
    pageSubtitle: {
      fontSize: '1.2rem',
      color: '#6b7280',
      marginBottom: '2rem',
      textAlign: 'center'
    },
    coursesGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '1.5rem',
      marginBottom: '2rem',
      maxWidth: '1200px',
      width: '100%',
      justifyContent: 'center'
    },
    courseCard: {
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      overflow: 'hidden',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      cursor: 'pointer',
      border: '2px solid transparent'
    },
    courseCardHover: {
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
      borderColor: '#3b82f6'
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
      display: '-webkit-box',
      WebkitLineClamp: 3,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden'
    },
    courseMeta: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '0.9rem',
      color: '#9ca3af'
    },
    videoCount: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.25rem'
    },
    rightNavTitle: {
      fontSize: '1.5rem',
      fontWeight: 'bold',
      color: '#1a202c',
      marginBottom: '1rem',
      paddingBottom: '0.5rem',
      borderBottom: '2px solid #e2e8f0'
    },
    courseList: {
      listStyle: 'none',
      padding: 0,
      margin: 0
    },
    courseListItem: {
      padding: '0.75rem',
      marginBottom: '0.5rem',
      backgroundColor: '#f8fafc',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
      border: '2px solid transparent'
    },
    courseListItemActive: {
      backgroundColor: '#dbeafe',
      borderColor: '#3b82f6'
    },
    courseListItemTitle: {
      fontWeight: '600',
      color: '#1a202c',
      marginBottom: '0.25rem'
    },
    courseListItemDesc: {
      fontSize: '0.8rem',
      color: '#6b7280',
      lineHeight: '1.4'
    },
    videoPlayer: {
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      padding: '1.5rem',
      marginBottom: '2rem'
    },
    videoTitle: {
      fontSize: '1.5rem',
      fontWeight: 'bold',
      color: '#1a202c',
      marginBottom: '1rem'
    },
    videoDescription: {
      color: '#6b7280',
      marginBottom: '1rem',
      lineHeight: '1.5'
    },
    iframe: {
      width: '100%',
      height: '400px',
      border: 'none',
      borderRadius: '8px'
    },
    videosList: {
      marginTop: '1rem'
    },
    videoItem: {
      padding: '0.75rem',
      backgroundColor: '#f8fafc',
      borderRadius: '8px',
      marginBottom: '0.5rem',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
      border: '2px solid transparent'
    },
    videoItemActive: {
      backgroundColor: '#dbeafe',
      borderColor: '#3b82f6'
    },
    videoItemTitle: {
      fontWeight: '600',
      color: '#1a202c',
      marginBottom: '0.25rem'
    },
    videoItemDesc: {
      fontSize: '0.8rem',
      color: '#6b7280',
      lineHeight: '1.4'
    },
    emptyState: {
      textAlign: 'center',
      padding: '3rem',
      color: '#6b7280'
    },
    emptyStateIcon: {
      fontSize: '4rem',
      marginBottom: '1rem'
    },
    emptyStateTitle: {
      fontSize: '1.5rem',
      fontWeight: 'bold',
      marginBottom: '0.5rem',
      color: '#374151'
    },
    emptyStateDesc: {
      fontSize: '1rem',
      lineHeight: '1.5'
    },
    courseSections: {
      display: 'flex',
      gap: '2rem',
      marginTop: '2rem',
      maxWidth: '1400px',
      width: '100%',
      justifyContent: 'center'
    },
    sectionContainer: {
      flex: 1,
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      padding: '1.5rem',
      position: 'relative'
    },
    sectionNavbar: {
      position: 'absolute',
      top: '1rem',
      right: '1rem',
      display: 'flex',
      gap: '0.5rem'
    },
    navButton: {
      backgroundColor: '#f3f4f6',
      color: '#374151',
      border: '1px solid #d1d5db',
      padding: '0.5rem 1rem',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '0.9rem',
      fontWeight: '500',
      transition: 'all 0.2s ease'
    },
    navButtonActive: {
      backgroundColor: '#3b82f6',
      color: 'white',
      borderColor: '#3b82f6'
    },
    sectionTitle: {
      fontSize: '1.8rem',
      fontWeight: 'bold',
      color: '#1a202c',
      marginBottom: '1.5rem',
      paddingBottom: '0.5rem',
      borderBottom: '2px solid #e2e8f0'
    },
    videosGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '1.5rem'
    },
    videoCard: {
      backgroundColor: '#f8fafc',
      borderRadius: '8px',
      overflow: 'hidden',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      cursor: 'pointer',
      border: '2px solid transparent'
    },
    videoCardHover: {
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
      borderColor: '#3b82f6'
    },
    videoThumbnail: {
      width: '100%',
      height: '160px',
      objectFit: 'cover',
      backgroundColor: '#e5e7eb'
    },
    videoContent: {
      padding: '1rem'
    },
    videoTitle: {
      fontSize: '1.1rem',
      fontWeight: 'bold',
      color: '#1a202c',
      marginBottom: '0.5rem'
    },
    videoDescription: {
      fontSize: '0.9rem',
      color: '#6b7280',
      lineHeight: '1.4',
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden'
    },
    quizList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem'
    },
    quizCard: {
      backgroundColor: '#f8fafc',
      borderRadius: '8px',
      padding: '1.5rem',
      border: '2px solid #e2e8f0',
      transition: 'all 0.2s ease',
      cursor: 'pointer'
    },
    quizCardHover: {
      borderColor: '#3b82f6',
      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)'
    },
    quizHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '0.5rem'
    },
    quizTitle: {
      fontSize: '1.2rem',
      fontWeight: 'bold',
      color: '#1a202c'
    },
    quizStatus: {
      padding: '0.25rem 0.75rem',
      borderRadius: '20px',
      fontSize: '0.8rem',
      fontWeight: '600',
      textTransform: 'uppercase'
    },
    quizStatusCompleted: {
      backgroundColor: '#d1fae5',
      color: '#065f46'
    },
    quizStatusPending: {
      backgroundColor: '#fef3c7',
      color: '#92400e'
    },
    quizDescription: {
      fontSize: '0.9rem',
      color: '#6b7280',
      marginBottom: '1rem',
      lineHeight: '1.4'
    },
    quizMeta: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '0.8rem',
      color: '#9ca3af'
    },
    quizScore: {
      fontWeight: 'bold',
      color: '#059669'
    },
    quizButton: {
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
      padding: '0.5rem 1rem',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '0.9rem',
      fontWeight: '500',
      transition: 'background-color 0.2s ease'
    },
    quizButtonCompleted: {
      backgroundColor: '#10b981'
    },
    videoModal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '2rem'
    },
    videoModalContent: {
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '2rem',
      maxWidth: '900px',
      width: '100%',
      maxHeight: '80vh',
      overflow: 'auto',
      position: 'relative'
    },
    videoModalClose: {
      position: 'absolute',
      top: '1rem',
      right: '1rem',
      backgroundColor: '#ef4444',
      color: 'white',
      border: 'none',
      borderRadius: '50%',
      width: '40px',
      height: '40px',
      cursor: 'pointer',
      fontSize: '1.2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    videoModalTitle: {
      fontSize: '1.8rem',
      fontWeight: 'bold',
      color: '#1a202c',
      marginBottom: '1rem'
    },
    videoModalDescription: {
      color: '#6b7280',
      marginBottom: '1.5rem',
      fontSize: '1.1rem',
      lineHeight: '1.5'
    },
    videoModalIframe: {
      width: '100%',
      height: '500px',
      border: 'none',
      borderRadius: '8px'
    },
    quizModal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '2rem'
    },
    quizModalContent: {
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '2rem',
      maxWidth: '800px',
      width: '100%',
      maxHeight: '90vh',
      overflow: 'auto',
      position: 'relative'
    },
    quizModalClose: {
      position: 'absolute',
      top: '1rem',
      right: '1rem',
      backgroundColor: '#ef4444',
      color: 'white',
      border: 'none',
      borderRadius: '50%',
      width: '40px',
      height: '40px',
      cursor: 'pointer',
      fontSize: '1.2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    quizModalTitle: {
      fontSize: '1.8rem',
      fontWeight: 'bold',
      color: '#1a202c',
      marginBottom: '1rem'
    },
    quizModalDescription: {
      color: '#6b7280',
      marginBottom: '2rem',
      fontSize: '1.1rem',
      lineHeight: '1.5'
    },
    quizQuestion: {
      marginBottom: '2rem',
      padding: '1.5rem',
      backgroundColor: '#f8fafc',
      borderRadius: '8px',
      border: '1px solid #e2e8f0'
    },
    quizQuestionText: {
      fontSize: '1.2rem',
      fontWeight: '600',
      color: '#1a202c',
      marginBottom: '1rem'
    },
    quizOptions: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem'
    },
    quizOption: {
      padding: '0.75rem 1rem',
      border: '2px solid #e2e8f0',
      borderRadius: '6px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      backgroundColor: 'white'
    },
    quizOptionSelected: {
      borderColor: '#3b82f6',
      backgroundColor: '#dbeafe'
    },
    quizOptionCorrect: {
      borderColor: '#10b981',
      backgroundColor: '#d1fae5'
    },
    quizOptionIncorrect: {
      borderColor: '#ef4444',
      backgroundColor: '#fee2e2'
    },
    quizSubmitButton: {
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
      padding: '1rem 2rem',
      borderRadius: '8px',
      fontSize: '1.1rem',
      fontWeight: '600',
      cursor: 'pointer',
      marginTop: '1rem',
      width: '100%'
    },
    quizResults: {
      textAlign: 'center',
      padding: '2rem',
      backgroundColor: '#f0f9ff',
      borderRadius: '8px',
      marginTop: '1rem'
    },
    quizScore: {
      fontSize: '2rem',
      fontWeight: 'bold',
      color: '#059669',
      marginBottom: '1rem'
    },
    quizStats: {
      display: 'flex',
      justifyContent: 'space-around',
      marginTop: '1rem',
      fontSize: '1rem',
      color: '#6b7280'
    }
  };

  const handleCourseClick = async (course) => {
    setSelectedCourse(course);
    setSelectedVideo(null);
    
    // Load fresh course data to get updated quiz information
    try {
      const response = await fetch(`${process.env.REACT_APP_API_ENDPOINT}/api/courses/${course._id || course.id}`);
      if (response.ok) {
        const courseData = await response.json();
        setSelectedCourse(courseData);
        loadQuizzes(course._id || course.id);
      } else {
        loadQuizzes(course._id || course.id);
      }
    } catch (error) {
      console.error('Error loading course details:', error);
      loadQuizzes(course._id || course.id);
    }
  };

  const handleVideoClick = (video) => {
    setSelectedVideo(video);
    setShowVideoModal(true);
  };

  return (
    <>
      <Navigationinner title={"TEACHER GUIDANCE"} />
      <div style={styles.container}>
        <h1 style={styles.pageTitle}>Teacher Guidance</h1>
        <p style={styles.pageSubtitle}>
          Learn from expert teachers with structured courses and video content
        </p>

          {selectedCourse ? (
            <div style={{ maxWidth: '1400px', width: '100%', textAlign: 'center' }}>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1a202c', marginBottom: '1rem' }}>
                {selectedCourse.title}
              </h2>
              <p style={{ color: '#6b7280', marginBottom: '2rem', fontSize: '1.2rem' }}>
                {selectedCourse.description}
              </p>
              
              <div style={styles.courseSections}>
                {/* Videos Section */}
                <div style={styles.sectionContainer}>
                  <div style={styles.sectionNavbar}>
                    <button 
                      style={{
                        ...styles.navButton,
                        ...(activeVideoTab === 'all' ? styles.navButtonActive : {})
                      }}
                      onClick={() => setActiveVideoTab('all')}
                    >
                      All Videos
                    </button>
                    <button 
                      style={{
                        ...styles.navButton,
                        ...(activeVideoTab === 'watched' ? styles.navButtonActive : {})
                      }}
                      onClick={() => setActiveVideoTab('watched')}
                    >
                      Watched
                    </button>
                  </div>
                  <h3 style={styles.sectionTitle}>📹 Videos</h3>
                  {selectedCourse.videos && selectedCourse.videos.length > 0 ? (
                    <div style={styles.videosGrid}>
                      {selectedCourse.videos.map((video) => (
                        <div
                          key={video._id || video.id}
                          style={styles.videoCard}
                          onClick={() => handleVideoClick(video)}
                        >
                          {video.thumbnail ? (
                            <img 
                              src={video.thumbnail} 
                              alt={video.title} 
                              style={styles.videoThumbnail}
                            />
                          ) : (
                            <div style={{...styles.videoThumbnail, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                              🎥
                            </div>
                          )}
                          <div style={styles.videoContent}>
                            <h4 style={styles.videoTitle}>{video.title}</h4>
                            <p style={styles.videoDescription}>{video.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={styles.emptyState}>
                      <div style={styles.emptyStateIcon}>📹</div>
                      <div style={styles.emptyStateTitle}>No Videos Available</div>
                      <div style={styles.emptyStateDesc}>
                        This course doesn't have any videos yet. Check back later!
                      </div>
                    </div>
                  )}
                </div>

                {/* Quiz Section */}
                <div style={styles.sectionContainer}>
                  <div style={styles.sectionNavbar}>
                    <button 
                      style={{
                        ...styles.navButton,
                        ...(activeQuizTab === 'all' ? styles.navButtonActive : {})
                      }}
                      onClick={() => setActiveQuizTab('all')}
                    >
                      All Quizzes
                    </button>
                    <button 
                      style={{
                        ...styles.navButton,
                        ...(activeQuizTab === 'completed' ? styles.navButtonActive : {})
                      }}
                      onClick={() => setActiveQuizTab('completed')}
                    >
                      Completed
                    </button>
                    <button 
                      style={{
                        ...styles.navButton,
                        ...(activeQuizTab === 'pending' ? styles.navButtonActive : {})
                      }}
                      onClick={() => setActiveQuizTab('pending')}
                    >
                      Pending
                    </button>
                  </div>
                  <h3 style={styles.sectionTitle}>🧠 Quizzes</h3>
                  {quizzes.length > 0 ? (
                    <div style={styles.quizList}>
                      {quizzes.map((quiz) => {
                        const isCompleted = quiz.completed || quizResults[quiz.id]?.completed;
                        const score = quiz.score || quizResults[quiz.id]?.score;
                        
                        return (
                          <div
                            key={quiz.id}
                            style={styles.quizCard}
                            onClick={() => handleQuizStart(quiz.id)}
                          >
                            <div style={styles.quizHeader}>
                              <h4 style={styles.quizTitle}>{quiz.title}</h4>
                              <span style={{
                                ...styles.quizStatus,
                                ...(isCompleted ? styles.quizStatusCompleted : styles.quizStatusPending)
                              }}>
                                {isCompleted ? 'Completed' : 'Pending'}
                              </span>
                            </div>
                            <p style={styles.quizDescription}>{quiz.description}</p>
                            <div style={styles.quizMeta}>
                              <span>{quiz.questions} questions</span>
                              {isCompleted && score && (
                                <span style={styles.quizScore}>Score: {score}%</span>
                              )}
                            </div>
                            <button 
                              style={{
                                ...styles.quizButton,
                                ...(isCompleted ? styles.quizButtonCompleted : {})
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuizStart(quiz.id);
                              }}
                            >
                              {isCompleted ? 'Review Quiz' : 'Start Quiz'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={styles.emptyState}>
                      <div style={styles.emptyStateIcon}>🧠</div>
                      <div style={styles.emptyStateTitle}>No Quizzes Available</div>
                      <div style={styles.emptyStateDesc}>
                        This course doesn't have any quizzes yet. Check back later!
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '1200px', width: '100%', textAlign: 'center' }}>
              {courses.length > 0 ? (
                <div style={styles.coursesGrid}>
                  {courses.map((course) => (
                    <div
                      key={course.id}
                      style={{
                        ...styles.courseCard,
                        ...(selectedCourse && selectedCourse.id === course.id ? styles.courseCardHover : {})
                      }}
                      onClick={() => handleCourseClick(course)}
                    >
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
                        <div style={styles.courseMeta}>
                          <div style={styles.videoCount}>
                            🎥 {course.videos ? course.videos.length : 0} videos
                          </div>
                          <div>📅 {new Date(course.createdAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.emptyState}>
                  <div style={styles.emptyStateIcon}>📚</div>
                  <div style={styles.emptyStateTitle}>No Courses Available</div>
                  <div style={styles.emptyStateDesc}>
                    No teacher courses are available at the moment. Check back later for new content!
                  </div>
                </div>
              )}
            </div>
          )}
      </div>
      
      {/* Video Modal */}
      {showVideoModal && selectedVideo && (
        <div style={styles.videoModal} onClick={() => setShowVideoModal(false)}>
          <div style={styles.videoModalContent} onClick={(e) => e.stopPropagation()}>
            <button 
              style={styles.videoModalClose}
              onClick={() => setShowVideoModal(false)}
            >
              ×
            </button>
            <h2 style={styles.videoModalTitle}>{selectedVideo.title}</h2>
            <p style={styles.videoModalDescription}>{selectedVideo.description}</p>
            <iframe
              src={convertDriveLink(selectedVideo.driveLink)}
              style={styles.videoModalIframe}
              allow="autoplay"
              title={selectedVideo.title}
            />
          </div>
        </div>
      )}

      {/* Quiz Modal */}
      {showQuizModal && selectedQuiz && (
        <div style={styles.quizModal} onClick={() => setShowQuizModal(false)}>
          <div style={styles.quizModalContent} onClick={(e) => e.stopPropagation()}>
            <button 
              style={styles.quizModalClose}
              onClick={() => setShowQuizModal(false)}
            >
              ×
            </button>
            <h2 style={styles.quizModalTitle}>{selectedQuiz.title}</h2>
            <p style={styles.quizModalDescription}>{selectedQuiz.description}</p>
            
            {!quizSubmitted ? (
              <div>
                {selectedQuiz.quiz.questions.map((question, questionIndex) => (
                  <div key={questionIndex} style={styles.quizQuestion}>
                    <div style={styles.quizQuestionText}>
                      {questionIndex + 1}. {question.question}
                    </div>
                    <div style={styles.quizOptions}>
                      {question.options.map((option, optionIndex) => (
                        <div
                          key={optionIndex}
                          style={{
                            ...styles.quizOption,
                            ...(quizAnswers[questionIndex] === optionIndex ? styles.quizOptionSelected : {})
                          }}
                          onClick={() => handleQuizAnswer(questionIndex, optionIndex)}
                        >
                          {String.fromCharCode(65 + optionIndex)}. {option}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button 
                  style={styles.quizSubmitButton}
                  onClick={handleQuizSubmit}
                >
                  Submit Quiz
                </button>
              </div>
            ) : (
              <div style={styles.quizResults}>
                <div style={styles.quizScore}>
                  Your Score: {quizScore?.score}%
                </div>
                <div style={styles.quizStats}>
                  <div>Correct: {quizScore?.correctAnswers}</div>
                  <div>Total: {quizScore?.totalQuestions}</div>
                </div>
                <button 
                  style={styles.quizSubmitButton}
                  onClick={() => setShowQuizModal(false)}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      <ChatbotButton />
    </>
  );
};

export default TeacherGuidance;
