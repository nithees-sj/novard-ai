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
    background: '#ffffff',
    overflow: 'hidden',
    padding: '0 1.5rem',
    boxSizing: 'border-box',
    maxWidth: '1800px',
    margin: '0 auto'
  },
  sidebar: {
    width: '380px',
    background: 'rgba(255, 255, 255, 0.97)',
    backdropFilter: 'blur(12px)',
    borderLeft: '1px solid rgba(0, 0, 0, 0.08)',
    overflowY: 'auto',
    padding: '2rem 1.5rem',
    order: 2,
    flexShrink: 0
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2.3rem',
    paddingBottom: '1.3rem',
    borderBottom: '1.5px solid rgba(0, 0, 0, 0.1)'
  },
  sidebarTitle: {
    fontSize: '2rem',
    fontWeight: '700',
    color: '#111827',
    margin: 0
  },
  addButton: {
    background: '#111827',
    color: 'white',
    border: 'none',
    borderRadius: '11px',
    padding: '1.15rem 1.7rem',
    cursor: 'pointer',
    fontSize: '1.3rem',
    fontWeight: '700',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.13)'
  },
  addButtonHover: {
    background: '#000000',
    transform: 'translateY(-2px)',
    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.22)'
  },
  doubtItem: {
    background: '#ffffff',
    border: '1.2px solid rgba(0, 0, 0, 0.09)',
    borderRadius: '15px',
    padding: '2rem',
    marginBottom: '1.6rem',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative',
    boxShadow: '0 3px 8px rgba(0, 0, 0, 0.07)'
  },
  doubtItemHover: {
    transform: 'translateY(-4px)',
    boxShadow: '0 9px 22px rgba(0, 0, 0, 0.16)'
  },
  doubtItemSelected: {
    background: 'rgba(0,0,0,0.05)',
    border: '1.5px solid rgba(0, 0, 0, 0.22)',
    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.21)'
  },
  doubtTitle: {
    fontSize: '2rem',
    fontWeight: '700',
    color: '#111827',
    marginBottom: '1.05rem',
    lineHeight: '1.5'
  },
  doubtDescription: {
    fontSize: '1.35rem',
    color: '#374151',
    lineHeight: '1.7',
    marginBottom: '0.9rem'
  },
  doubtDate: {
    fontSize: '1.1rem',
    color: '#6b7280',
    marginBottom: '0.7rem'
  },
  deleteButton: {
    position: 'absolute',
    top: '0.75rem',
    right: '0.75rem',
    background: 'rgba(0,0,0,0.07)',
    color: '#111827',
    border: 'none',
    borderRadius: '7px',
    padding: '0.45rem',
    cursor: 'pointer',
    fontSize: '1.08rem',
    transition: 'all 0.3s ease'
  },
  deleteButtonHover: {
    background: 'rgba(0,0,0,0.13)',
    transform: 'scale(1.08)'
  },
  mainContent: {
    flex: '1',
    display: 'flex',
    flexDirection: 'column',
    padding: '2rem 2rem',
    overflowY: 'auto',
    order: 1,
    minWidth: 0
  },
  mainHeader: {
    marginBottom: '2.5rem'
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.3rem'
  },
  mainTitle: {
    fontSize: '3.2rem',
    fontWeight: '900',
    color: '#111827',
    margin: 0,
    flex: 1,
    lineHeight: '1.2'
  },
  refreshButton: {
    background: '#111827',
    color: 'white',
    border: 'none',
    borderRadius: '11px',
    padding: '1rem 1.4rem',
    fontSize: '1.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 11px rgba(0,0,0,0.11)'
  },
  refreshButtonHover: {
    background: '#000000',
    transform: 'translateY(-2px)',
    boxShadow: '0 7px 19px rgba(0,0,0,0.18)'
  },
  mainSubtitle: {
    fontSize: '1.5rem',
    color: '#4b5563',
    marginBottom: '0'
  },
  videoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '1.8rem',
    marginBottom: '2rem'
  },
  videoCard: {
    background: '#ffffff',
    borderRadius: '22px',
    boxShadow: '0 11px 32px rgba(0, 0, 0, 0.12)',
    overflow: 'hidden',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    border: '1.7px solid rgba(0, 0, 0, 0.09)'
  },
  videoCardHover: {
    transform: 'translateY(-7px)',
    boxShadow: '0 17px 38px rgba(0, 0, 0, 0.18)',
    border: '1.7px solid rgba(0, 0, 0, 0.21)'
  },
  videoThumbnail: {
    width: '100%',
    height: '245px',
    objectFit: 'cover',
    transition: 'transform 0.3s ease'
  },
  videoThumbnailHover: {
    transform: 'scale(1.07)'
  },
  videoInfo: {
    padding: '2rem 2rem 1.2rem 2rem'
  },
  videoTitle: {
    fontSize: '1.76rem',
    fontWeight: '800',
    color: '#111827',
    marginBottom: '1.15rem',
    lineHeight: '1.55',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  },
  videoDescription: {
    fontSize: '1.25rem',
    color: '#374151',
    lineHeight: '1.7',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  },
  loadingSpinner: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '2.7rem',
    fontSize: '2.2rem',
    color: '#111827'
  },
  submitButton: {
    background: '#111827',
    color: 'white',
    borderRadius: '11px',
    padding: '1.1rem 1.8rem',
    fontSize: '1.3rem',
    boxShadow: '0 5px 14px rgba(0,0,0,0.14)'
  },
  submitButtonHover: {
    background: '#000000',
    transform: 'translateY(-2px)'
  },
  cancelButton: {
    background: 'rgba(0,0,0,0.06)',
    color: '#111827',
    border: '1px solid rgba(0,0,0,0.11)'
  },
  toastSuccess: {
    background: '#111827',
    color: 'white'
  },
  toastError: {
    background: '#b91c1c'
  },
  addDoubtForm: {
  background: '#fff',
  borderRadius: '20px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.11)',
  padding: '2.6rem 2.5rem 2.2rem 2.5rem',
  margin: '0 auto',
  maxWidth: '440px',
  minWidth: '320px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: '1.25rem'
},
formTitle: {
  fontSize: '2rem',
  fontWeight: '800',
  color: '#111827',
  marginBottom: '1rem',
  textAlign: 'center',
  letterSpacing: '0.03em'
},
inputGroup: {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  marginBottom: '0.7rem'
},
label: {
  fontSize: '1.18rem',
  fontWeight: '600',
  color: '#2a2f34',
  marginBottom: '0.16rem'
},
input: {
  width: '100%',
  padding: '15px 22px',
  borderRadius: '12px',
  border: '1.5px solid #d1d5db',
  background: '#f8fafb',
  fontSize: '1.17rem',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box'
},
textarea: {
  width: '100%',
  padding: '15px 22px',
  borderRadius: '12px',
  border: '1.5px solid #d1d5db',
  background: '#f8fafb',
  fontSize: '1.17rem',
  fontFamily: 'inherit',
  outline: 'none',
  minHeight: '90px',
  resize: 'vertical',
  boxSizing: 'border-box'
},
formButtons: {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '1.2rem'
},
button: {
  padding: '15px 32px',
  borderRadius: '10px',
  fontSize: '1.14rem',
  fontWeight: '700',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.2s'
},
submitButton: {
  background: '#111827',
  color: '#fff',
  boxShadow: '0 2px 8px rgba(0,0,0,0.13)'
},
cancelButton: {
  background: '#f2f4f5',
  color: '#232323',
  border: '1.5px solid #d1d5db'
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
                  {isLoading ? ' Loading...' : ' Refresh Videos'}
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
