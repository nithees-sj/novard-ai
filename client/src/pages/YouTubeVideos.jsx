import React, { useState, useEffect } from 'react';
import { Navigationinner } from "../components/navigationinner";
import ChatbotButton from '../components/ChatbotButton';
import axios from 'axios';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;

const EducationalVideos = () => {
  const [videoRequests, setVideoRequests] = useState([]);
  const [selectedVideoRequest, setSelectedVideoRequest] = useState(null);
  const [showAddVideoRequest, setShowAddVideoRequest] = useState(false);
  const [recommendedVideos, setRecommendedVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [newVideoRequest, setNewVideoRequest] = useState({ title: '', description: '', platform: 'youtube' });
  const [videoCache, setVideoCache] = useState({});

  const platforms = {
    youtube: { name: 'YouTube', icon: '📺', color: '#FF0000' },
    udemy: { name: 'Udemy', icon: '🎓', color: '#A435F0' },
    coursera: { name: 'Coursera', icon: '🎓', color: '#0056D3' },
    edureka: { name: 'Edureka', icon: '🎓', color: '#FF6B35' },
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    loadUserVideoRequests();
  }, []);

  const loadUserVideoRequests = async () => {
    try {
      const userId = localStorage.getItem('userId') || 'demo-user';
      const response = await axios.get(`${apiUrl}/educational-video-requests/${userId}`);
      const videoRequestsData = Array.isArray(response.data) ? response.data : [];
      setVideoRequests(videoRequestsData);

      if (videoRequestsData.length > 0 && !selectedVideoRequest) {
        setSelectedVideoRequest(videoRequestsData[0]);
        getRecommendedVideos(videoRequestsData[0], false);
      }
    } catch (error) {
      console.error('Error loading video requests:', error);
      setVideoRequests([]);
    }
  };

  const getRecommendedVideos = async (videoRequest, forceRefresh = false) => {
    if (!videoRequest) return;
    
    const requestId = videoRequest._id || videoRequest.id;

    if (!forceRefresh && videoCache[requestId]) {
      setRecommendedVideos(videoCache[requestId]);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await axios.post(`${apiUrl}/recommend-educational-videos`, {
        title: videoRequest.title,
        description: videoRequest.description,
        platform: videoRequest.platform || 'youtube'
      });
      const videos = response.data.videos || [];
      setRecommendedVideos(videos);
      setVideoCache(prev => ({ ...prev, [requestId]: videos }));
    } catch (error) {
      console.error('Error getting recommended videos:', error);
      showToast('Error getting video recommendations', 'error');
      setRecommendedVideos([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddVideoRequest = async (e) => {
    e.preventDefault();
    
    if (!newVideoRequest.title.trim() || !newVideoRequest.description.trim()) {
      showToast('Please fill in both title and description', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const userId = localStorage.getItem('userId') || 'demo-user';
      await axios.post(`${apiUrl}/educational-video-requests`, {
        ...newVideoRequest,
        userId: userId
      });

      await loadUserVideoRequests();
      setShowAddVideoRequest(false);
      setNewVideoRequest({ title: '', description: '', platform: 'youtube' });
      showToast('Video request added successfully!', 'success');
    } catch (error) {
      console.error('Error adding video request:', error);
      showToast('Error adding video request. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteVideoRequest = async (videoRequestId, videoRequestTitle) => {
    if (!window.confirm(`Delete "${videoRequestTitle}"?`)) return;

    try {
      await axios.delete(`${apiUrl}/educational-video-requests/${videoRequestId}`);
      await loadUserVideoRequests();

      if (selectedVideoRequest && selectedVideoRequest._id === videoRequestId) {
        setSelectedVideoRequest(null);
        setRecommendedVideos([]);
      }

      setVideoCache(prev => {
        const newCache = { ...prev };
        delete newCache[videoRequestId];
        return newCache;
      });
      showToast('Video request deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting video request:', error);
      showToast('Error deleting video request.', 'error');
    }
  };

  return (
    <>
      <Navigationinner title={"EDUCATIONAL VIDEOS"} />
      <div className="flex min-h-screen bg-gray-50">
        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">
                {selectedVideoRequest ? `Videos for: ${selectedVideoRequest.title}` : 'Educational Videos'}
              </h1>
              {selectedVideoRequest && (
                <button 
                  onClick={() => !isLoading && getRecommendedVideos(selectedVideoRequest, true)}
                  disabled={isLoading}
                  className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-black transition-colors disabled:opacity-60"
                >
                  {isLoading ? 'Loading...' : 'Refresh'}
                </button>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-6">
              {selectedVideoRequest 
                ? `Recommended ${platforms[selectedVideoRequest.platform]?.name || 'educational'} videos`
                : 'Select a video request to see recommendations'
              }
            </p>

            {/* Loading */}
            {isLoading && (
              <div className="text-center py-12 text-lg text-gray-700">
                🔍 Finding relevant videos...
              </div>
            )}

            {/* Video Grid */}
            {!isLoading && recommendedVideos.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendedVideos.map((video, index) => (
                  <div
                    key={index}
                    onClick={() => window.open(video.url, '_blank')}
                    className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition-shadow"
                  >
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-40 object-cover"
                      onError={(e) => { e.target.src = '/courses.jpg'; }}
                    />
                    <div className="p-4">
                      <h3 className="text-base font-bold text-gray-900 mb-2 line-clamp-2">{video.title}</h3>
                      {video.channel && (
                        <p className="text-xs text-gray-500 mb-2">
                          {video.platform === 'youtube' ? '📺' : '🎓'} {video.channel}
                        </p>
                      )}
                      <p className="text-sm text-gray-600 line-clamp-2 mb-3">{video.description}</p>

                      {/* Metadata */}
                      <div className="flex flex-wrap gap-1">
                        {video.rating && <span className="px-2 py-0.5 bg-gray-100 text-xs rounded">⭐ {video.rating}</span>}
                        {video.price && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded font-semibold">💰 {video.price}</span>}
                        {video.duration && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">⏱️ {video.duration}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty States */}
            {!isLoading && recommendedVideos.length === 0 && selectedVideoRequest && (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">🎓</div>
                <div className="text-lg font-semibold text-gray-700 mb-2">No videos found</div>
                <div className="text-sm text-gray-500">Try adding more details or check back later.</div>
              </div>
            )}

            {!selectedVideoRequest && (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">🎯</div>
                <div className="text-lg font-semibold text-gray-700 mb-2">Select a video request</div>
                <div className="text-sm text-gray-500">Choose from the sidebar or add a new request.</div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Your Requests</h2>
            <button 
              onClick={() => setShowAddVideoRequest(!showAddVideoRequest)}
              className="px-3 py-1.5 bg-gray-900 text-white text-sm font-semibold rounded-md hover:bg-black"
            >
              + Add
            </button>
          </div>

          {/* Add Form */}
          {showAddVideoRequest && (
            <div className="bg-gray-50 p-4 rounded-lg shadow-sm mb-4">
              <h3 className="text-base font-bold text-gray-900 mb-3">Add Request</h3>
              <form onSubmit={handleAddVideoRequest} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Platform</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(platforms).map(([key, platform]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setNewVideoRequest(prev => ({ ...prev, platform: key }))}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${newVideoRequest.platform === key ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                          }`}
                      >
                        {platform.icon} {platform.name}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  value={newVideoRequest.title}
                  onChange={(e) => setNewVideoRequest({ ...newVideoRequest, title: e.target.value })}
                  placeholder="Title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  required
                />
                <textarea
                  value={newVideoRequest.description}
                  onChange={(e) => setNewVideoRequest({ ...newVideoRequest, description: e.target.value })}
                  placeholder="Description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  rows="3"
                  required
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddVideoRequest(false)}
                    className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 px-3 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-black disabled:opacity-60"
                  >
                    Add
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Request List */}
          <div className="space-y-2">
            {videoRequests.map((request) => (
              <div
                key={request._id || request.id}
                onClick={() => {
                  setSelectedVideoRequest(request);
                  getRecommendedVideos(request, false);
                }}
                className={`relative p-3 rounded-lg border cursor-pointer transition-all ${selectedVideoRequest?._id === request._id
                  ? 'bg-gray-900 text-white border-gray-900 shadow-lg'
                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }`}
              >
                <div className="pr-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{platforms[request.platform]?.icon || '🎓'}</span>
                    <h3 className={`text-sm font-bold line-clamp-1 ${selectedVideoRequest?._id === request._id ? 'text-white' : 'text-gray-900'
                      }`}>
                      {request.title}
                    </h3>
                  </div>
                  <p className={`text-xs line-clamp-2 ${selectedVideoRequest?._id === request._id ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                    {request.description}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteVideoRequest(request._id || request.id, request.title);
                  }}
                  className={`absolute top-2 right-2 p-1 rounded hover:bg-opacity-20 hover:bg-black ${selectedVideoRequest?._id === request._id ? 'text-white' : 'text-gray-400'
                    }`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <ChatbotButton />
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 px-4 py-3 rounded-md shadow-lg text-white font-semibold text-sm z-50 ${toast.type === 'success' ? 'bg-gray-900' : 'bg-red-600'
          }`}>
          {toast.message}
        </div>
      )}
    </>
  );
};

export default EducationalVideos;
