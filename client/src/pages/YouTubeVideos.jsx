import React, { useState, useEffect } from 'react';
import { Navigationinner } from "../components/navigationinner";
import ChatbotButton from '../components/ChatbotButton';
import axios from 'axios';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;

const YouTubeVideos = () => {
  const [videoRequests, setVideoRequests] = useState([]);
  const [selectedVideoRequest, setSelectedVideoRequest] = useState(null);
  const [showAddVideoRequest, setShowAddVideoRequest] = useState(false);
  const [recommendedVideos, setRecommendedVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [newVideoRequest, setNewVideoRequest] = useState({ title: '', description: '' });
  const [videoCache, setVideoCache] = useState({}); // Cache videos for each request

  // Toast notification function
  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load user video requests on component mount
  useEffect(() => {
    loadUserVideoRequests();
  }, []);

  // Load user video requests
  const loadUserVideoRequests = async () => {
    try {
      const userId = localStorage.getItem('userId') || 'demo-user';
      const response = await axios.get(`${apiUrl}/video-requests/${userId}`);
      const videoRequestsData = Array.isArray(response.data) ? response.data : [];
      setVideoRequests(videoRequestsData);
      
      // If we have video requests and no selected request, select the first one
      if (videoRequestsData.length > 0 && !selectedVideoRequest) {
        setSelectedVideoRequest(videoRequestsData[0]);
        getRecommendedVideos(videoRequestsData[0], false);
      }
    } catch (error) {
      console.error('Error loading video requests:', error);
      setVideoRequests([]);
    }
  };

  // Get recommended videos based on video request
  const getRecommendedVideos = async (videoRequest, forceRefresh = false) => {
    if (!videoRequest) return;
    
    const requestId = videoRequest._id || videoRequest.id;
    
    // Check if videos are already cached and not forcing refresh
    if (!forceRefresh && videoCache[requestId]) {
      console.log('Loading videos from cache for:', videoRequest.title);
      setRecommendedVideos(videoCache[requestId]);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await axios.post(`${apiUrl}/recommend-videos`, {
        title: videoRequest.title,
        description: videoRequest.description
      });
      const videos = response.data.videos || [];
      setRecommendedVideos(videos);
      
      // Cache the videos for this request
      setVideoCache(prev => ({
        ...prev,
        [requestId]: videos
      }));
      
      console.log('Cached videos for:', videoRequest.title);
    } catch (error) {
      console.error('Error getting recommended videos:', error);
      showToast('Error getting video recommendations', 'error');
      setRecommendedVideos([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Add new video request
  const handleAddVideoRequest = async (e) => {
    e.preventDefault();
    
    if (!newVideoRequest.title.trim() || !newVideoRequest.description.trim()) {
      showToast('Please fill in both title and description', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const userId = localStorage.getItem('userId') || 'demo-user';
      const response = await axios.post(`${apiUrl}/video-requests`, {
        title: newVideoRequest.title,
        description: newVideoRequest.description,
        userId: userId
      });
      
      // Refresh the video requests list
      await loadUserVideoRequests();
      setShowAddVideoRequest(false);
      setNewVideoRequest({ title: '', description: '' });
      showToast('Video request added successfully!', 'success');
    } catch (error) {
      console.error('Error adding video request:', error);
      showToast('Error adding video request. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Select video request
  const handleVideoRequestSelect = (videoRequest) => {
    setSelectedVideoRequest(videoRequest);
    // Only load videos if not already cached
    getRecommendedVideos(videoRequest, false);
  };

  // Delete video request
  const handleDeleteVideoRequest = async (videoRequestId, videoRequestTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${videoRequestTitle}"?`)) {
      return;
    }

    try {
      await axios.delete(`${apiUrl}/video-requests/${videoRequestId}`);
      await loadUserVideoRequests();
      
      // If the deleted video request was selected, clear selection and cache
      if (selectedVideoRequest && selectedVideoRequest._id === videoRequestId) {
        setSelectedVideoRequest(null);
        setRecommendedVideos([]);
      }
      
      // Remove from cache
      setVideoCache(prev => {
        const newCache = { ...prev };
        delete newCache[videoRequestId];
        return newCache;
      });
      showToast('Video request deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting video request:', error);
      showToast('Error deleting video request. Please try again.', 'error');
    }
  };

  const styles = {
    container: {
      display: 'flex',
      minHeight: '100vh',
      background: '#f8fafc',
      overflow: 'hidden'
    },
    sidebar: {
      width: '400px',
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(10px)',
      borderLeft: '1px solid rgba(229, 231, 235, 0.8)',
      overflowY: 'auto',
      padding: '1.5rem',
      order: 2
    },
    sidebarHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1.5rem',
      paddingBottom: '1rem',
      borderBottom: '1px solid rgba(229, 231, 235, 0.8)'
    },
    sidebarTitle: {
      fontSize: '1.5rem',
      fontWeight: '700',
      color: '#1f2937',
      margin: 0
    },
    addButton: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      padding: '0.75rem 1.25rem',
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: '600',
      transition: 'all 0.3s ease',
      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
    },
    doubtItem: {
      background: 'rgba(255, 255, 255, 0.8)',
      border: '1px solid rgba(229, 231, 235, 0.5)',
      borderRadius: '12px',
      padding: '1.25rem',
      marginBottom: '1.25rem',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      position: 'relative',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
    },
    doubtItemSelected: {
      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
      border: '1px solid rgba(102, 126, 234, 0.3)',
      boxShadow: '0 4px 16px rgba(102, 126, 234, 0.15)'
    },
    doubtTitle: {
      fontSize: '1.65rem',
      fontWeight: '600',
      color: '#1f2937',
      marginBottom: '0.75rem',
      lineHeight: '1.4'
    },
    doubtDescription: {
      fontSize: '1.15rem',
      color: '#6b7280',
      lineHeight: '1.5',
      marginBottom: '0.75rem'
    },
    doubtDate: {
      fontSize: '0.85rem',
      color: '#9ca3af',
      marginBottom: '0.75rem'
    },
    deleteButton: {
      position: 'absolute',
      top: '0.5rem',
      right: '0.5rem',
      background: 'rgba(239, 68, 68, 0.1)',
      color: '#ef4444',
      border: 'none',
      borderRadius: '6px',
      padding: '0.25rem',
      cursor: 'pointer',
      fontSize: '0.8rem',
      transition: 'all 0.3s ease'
    },
    mainContent: {
      flex: '1',
      display: 'flex',
      flexDirection: 'column',
      padding: '2rem',
      overflowY: 'auto',
      order: 1
    },
    mainHeader: {
      marginBottom: '2rem'
    },
    headerTop: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '0.5rem'
    },
    mainTitle: {
      fontSize: '2rem',
      fontWeight: '700',
      color: '#1f2937',
      margin: 0,
      flex: 1
    },
    refreshButton: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      padding: '0.5rem 1rem',
      fontSize: '0.9rem',
      fontWeight: '500',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      transition: 'all 0.3s ease',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      opacity: 1
    },
    mainSubtitle: {
      fontSize: '1.1rem',
      color: '#6b7280',
      marginBottom: '0'
    },
    videoGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '1.5rem',
      marginBottom: '2rem'
    },
    videoCard: {
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      border: '1px solid rgba(229, 231, 235, 0.8)'
    },
    videoThumbnail: {
      width: '100%',
      height: '200px',
      objectFit: 'cover',
      transition: 'transform 0.3s ease'
    },
    videoInfo: {
      padding: '1rem'
    },
    videoTitle: {
      fontSize: '1rem',
      fontWeight: '600',
      color: '#1f2937',
      marginBottom: '0.5rem',
      lineHeight: '1.4',
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden'
    },
    videoDescription: {
      fontSize: '0.85rem',
      color: '#6b7280',
      lineHeight: '1.4',
      display: '-webkit-box',
      WebkitLineClamp: 3,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden'
    },
    loadingSpinner: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '2rem',
      fontSize: '1.1rem',
      color: '#6b7280'
    },
    addDoubtForm: {
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '16px',
      padding: '2rem',
      marginBottom: '1.5rem',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      border: '1px solid rgba(229, 231, 235, 0.8)'
    },
    formTitle: {
      fontSize: '1.25rem',
      fontWeight: '600',
      color: '#1f2937',
      marginBottom: '1.25rem'
    },
    inputGroup: {
      marginBottom: '1.25rem'
    },
    label: {
      display: 'block',
      fontSize: '1rem',
      fontWeight: '500',
      color: '#374151',
      marginBottom: '0.75rem'
    },
    input: {
      width: '100%',
      padding: '1rem',
      border: '1px solid rgba(209, 213, 219, 0.8)',
      borderRadius: '8px',
      fontSize: '1rem',
      outline: 'none',
      transition: 'border-color 0.2s ease',
      fontFamily: 'inherit'
    },
    textarea: {
      width: '100%',
      padding: '1rem',
      border: '1px solid rgba(209, 213, 219, 0.8)',
      borderRadius: '8px',
      fontSize: '1rem',
      outline: 'none',
      transition: 'border-color 0.2s ease',
      fontFamily: 'inherit',
      resize: 'vertical',
      minHeight: '100px'
    },
    formButtons: {
      display: 'flex',
      gap: '0.5rem',
      justifyContent: 'flex-end'
    },
    button: {
      padding: '0.75rem 1.25rem',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: '600',
      transition: 'all 0.3s ease'
    },
    submitButton: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
    },
    cancelButton: {
      background: 'rgba(107, 114, 128, 0.1)',
      color: '#6b7280',
      border: '1px solid rgba(107, 114, 128, 0.2)'
    },
    toast: {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '1rem 1.5rem',
      borderRadius: '8px',
      color: 'white',
      fontWeight: '600',
      zIndex: 1000,
      animation: 'slideIn 0.3s ease'
    },
    toastSuccess: {
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
    },
    toastError: {
      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
    },
    emptyState: {
      textAlign: 'center',
      padding: '3rem 2rem',
      color: '#6b7280'
    },
    emptyIcon: {
      fontSize: '4rem',
      marginBottom: '1rem'
    },
    emptyTitle: {
      fontSize: '1.5rem',
      fontWeight: '600',
      marginBottom: '0.5rem',
      color: '#374151'
    },
    emptyDescription: {
      fontSize: '1rem',
      lineHeight: '1.5'
    }
  };

  return (
    <>
      <Navigationinner title={"YOUTUBE VIDEOS"} />
      <div style={styles.container}>
        {/* Main Content */}
        <div style={styles.mainContent}>
          <div style={styles.mainHeader}>
            <div style={styles.headerTop}>
              <h1 style={styles.mainTitle}>
                {selectedVideoRequest ? `Videos for: ${selectedVideoRequest.title}` : 'YouTube Video Recommendations'}
              </h1>
              {selectedVideoRequest && (
                <button 
                  style={{
                    ...styles.refreshButton,
                    ...(isLoading ? { opacity: 0.6, cursor: 'not-allowed' } : {})
                  }}
                  onClick={() => !isLoading && getRecommendedVideos(selectedVideoRequest, true)}
                  disabled={isLoading}
                >
                  {isLoading ? '🔄 Loading...' : '🔄 Refresh Videos'}
                </button>
              )}
            </div>
            <p style={styles.mainSubtitle}>
              {selectedVideoRequest 
                ? 'Based on your video request, here are some recommended videos'
                : 'Select a video request from the sidebar to see personalized video recommendations'
              }
            </p>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div style={styles.loadingSpinner}>
              🔍 Finding relevant videos...
            </div>
          )}

          {/* Video Grid */}
          {!isLoading && Array.isArray(recommendedVideos) && recommendedVideos.length > 0 && (
            <div style={styles.videoGrid}>
              {recommendedVideos.map((video, index) => (
                <div
                  key={index}
                  style={styles.videoCard}
                  onClick={() => {
                    // Open video in new tab or embed player
                    window.open(video.url, '_blank');
                  }}
                >
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    style={styles.videoThumbnail}
                    onError={(e) => {
                      console.log('Thumbnail failed to load:', video.thumbnail);
                      // Fallback to default YouTube thumbnail
                      e.target.src = `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`;
                    }}
                  />
                  <div style={styles.videoInfo}>
                    <h3 style={styles.videoTitle}>{video.title}</h3>
                    {video.channel && (
                      <p style={{...styles.videoDescription, color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.5rem'}}>
                        📺 {video.channel}
                      </p>
                    )}
                    <p style={styles.videoDescription}>
                      {video.description.length > 150 
                        ? `${video.description.substring(0, 150)}...` 
                        : video.description
                      }
                    </p>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem'}}>
                      {video.duration && (
                        <span style={{...styles.videoDescription, color: '#9ca3af', fontSize: '0.8rem'}}>
                          ⏱️ {video.duration}
                        </span>
                      )}
                      {video.reason && (
                        <p style={{...styles.videoDescription, fontStyle: 'italic', color: '#667eea', fontSize: '0.75rem', margin: 0}}>
                          💡 {video.reason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty Video State */}
          {!isLoading && (!Array.isArray(recommendedVideos) || recommendedVideos.length === 0) && selectedVideoRequest && (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🎥</div>
              <div style={styles.emptyTitle}>No videos found</div>
              <div style={styles.emptyDescription}>
                We couldn't find relevant videos for this request. Try adding more details or check back later.
              </div>
            </div>
          )}

          {/* No Video Request Selected State */}
          {!selectedVideoRequest && (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🎯</div>
              <div style={styles.emptyTitle}>Select a video request to get started</div>
              <div style={styles.emptyDescription}>
                Choose a video request from the sidebar to see personalized video recommendations, or add a new request to begin.
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <h2 style={styles.sidebarTitle}>Your Video Requests</h2>
            <button 
              style={styles.addButton}
              onClick={() => setShowAddVideoRequest(!showAddVideoRequest)}
            >
              + Add Request
            </button>
          </div>

          {/* Add Video Request Form */}
          {showAddVideoRequest && (
            <div style={styles.addDoubtForm}>
              <h3 style={styles.formTitle}>Add New Video Request</h3>
              <form onSubmit={handleAddVideoRequest}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Title</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={newVideoRequest.title}
                    onChange={(e) => setNewVideoRequest({ ...newVideoRequest, title: e.target.value })}
                    placeholder="Enter doubt title..."
                    required
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Description</label>
                  <textarea
                    style={styles.textarea}
                    value={newVideoRequest.description}
                    onChange={(e) => setNewVideoRequest({ ...newVideoRequest, description: e.target.value })}
                    placeholder="Describe your doubt in detail..."
                    required
                  />
                </div>
                <div style={styles.formButtons}>
                  <button
                    type="button"
                    style={{ ...styles.button, ...styles.cancelButton }}
                    onClick={() => setShowAddVideoRequest(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ ...styles.button, ...styles.submitButton }}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Adding...' : 'Add Doubt'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Video Requests List */}
          {Array.isArray(videoRequests) && videoRequests.map((videoRequest) => (
            <div
              key={videoRequest._id}
              style={{
                ...styles.doubtItem,
                ...(selectedVideoRequest && selectedVideoRequest._id === videoRequest._id ? styles.doubtItemSelected : {})
              }}
              onClick={() => handleVideoRequestSelect(videoRequest)}
            >
              <button
                style={styles.deleteButton}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteVideoRequest(videoRequest._id, videoRequest.title);
                }}
                title="Delete video request"
              >
                ✕
              </button>
              <div style={styles.doubtTitle}>{videoRequest.title}</div>
              <div style={styles.doubtDescription}>{videoRequest.description}</div>
              <div style={styles.doubtDate}>
                {new Date(videoRequest.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}

          {/* Empty State */}
          {Array.isArray(videoRequests) && videoRequests.length === 0 && (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🎥</div>
              <div style={styles.emptyTitle}>No video requests yet</div>
              <div style={styles.emptyDescription}>
                Add your first video request to get personalized video recommendations!
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notifications */}
      {toast && (
        <div style={{
          ...styles.toast,
          ...(toast.type === 'success' ? styles.toastSuccess : styles.toastError)
        }}>
          {toast.message}
        </div>
      )}

      <ChatbotButton />
    </>
  );
};

export default YouTubeVideos;
