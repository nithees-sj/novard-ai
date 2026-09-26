import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Workspace, Panel, ItemFrame, GeneratingState, EmptyState, SideList, ListItem, ListEmpty, Badge, Toast, Icon, btn, inputClass,
} from './learning/LearningUI';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;

const VideoLibraryInlineView = () => {
  const [videoRequests, setVideoRequests] = useState([]);
  const [selectedVideoRequest, setSelectedVideoRequest] = useState(null);
  const [showAddVideoRequest, setShowAddVideoRequest] = useState(false);
  const [recommendedVideos, setRecommendedVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [newVideoRequest, setNewVideoRequest] = useState({ title: '', description: '', platform: 'youtube' });
  const [videoCache, setVideoCache] = useState({});

  const platforms = {
    youtube: { name: 'YouTube', icon: '📺', color: '#FF0000' }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    loadUserVideoRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUserVideoRequests = async () => {
    try {
      const userId = localStorage.getItem('email') || 'demo-user';
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
      const userId = localStorage.getItem('email') || 'demo-user';
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

  const addForm = (
    <form onSubmit={handleAddVideoRequest} className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Platform">
        {Object.entries(platforms).map(([key, platform]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={newVideoRequest.platform === key}
            onClick={() => setNewVideoRequest((prev) => ({ ...prev, platform: key }))}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              newVideoRequest.platform === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {platform.name}
          </button>
        ))}
      </div>
      <input type="text" value={newVideoRequest.title} onChange={(e) => setNewVideoRequest({ ...newVideoRequest, title: e.target.value })} placeholder="What do you want to learn?" className={inputClass} required autoFocus />
      <textarea value={newVideoRequest.description} onChange={(e) => setNewVideoRequest({ ...newVideoRequest, description: e.target.value })} placeholder="Your level and what you want to focus on" className={`${inputClass} resize-none`} rows={3} required />
      <div className="flex gap-2">
        <button type="button" onClick={() => setShowAddVideoRequest(false)} className={`${btn.secondary} flex-1`}>Cancel</button>
        <button type="submit" disabled={isLoading} className={`${btn.primary} flex-1`}>Add request</button>
      </div>
    </form>
  );

  return (
    <>
      <Workspace
        side={(
          <SideList
            title="Your requests"
            count={videoRequests.length}
            action={showAddVideoRequest ? addForm : (
              <button type="button" onClick={() => setShowAddVideoRequest(true)} className={`${btn.primary} w-full`}>
                <Icon name="plus" /> New request
              </button>
            )}
          >
            {videoRequests.length > 0 ? videoRequests.map((request) => (
              <ListItem
                key={request._id || request.id}
                active={selectedVideoRequest?._id === request._id}
                title={request.title}
                subtitle={request.description}
                badges={<Badge tone="blue">{platforms[request.platform]?.name || 'Videos'}</Badge>}
                onSelect={() => { setSelectedVideoRequest(request); getRecommendedVideos(request, false); }}
                onDelete={() => handleDeleteVideoRequest(request._id || request.id, request.title)}
              />
            )) : <ListEmpty icon="video" title="No requests yet" text="Tell us what you want to learn and we will find videos for it." />}
          </SideList>
        )}
      >
        {selectedVideoRequest ? (
          <>
            <ItemFrame
              icon="video"
              title={selectedVideoRequest.title}
              meta={`Recommended ${platforms[selectedVideoRequest.platform]?.name || 'educational'} videos`}
              actions={(
                <button type="button" onClick={() => !isLoading && getRecommendedVideos(selectedVideoRequest, true)} disabled={isLoading} className={`${btn.secondary} py-1.5`}>
                  {isLoading ? 'Searching…' : 'Refresh'}
                </button>
              )}
            >
              {isLoading ? (
                <GeneratingState icon="video" title={selectedVideoRequest.platform === 'youtube' ? 'Finding videos' : 'Finding courses'} hint={`Searching ${platforms[selectedVideoRequest.platform]?.name || 'the web'} for the best learning content for this request.`} />
              ) : recommendedVideos.length > 0 ? (
                <div className="h-full overflow-y-auto p-5">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {recommendedVideos.map((video, index) => (
                      <a key={index} href={video.url} target="_blank" rel="noopener noreferrer" className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md">
                        <div className="relative aspect-video bg-gray-100">
                          <img src={video.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.src = '/courses.jpg'; }} />
                          {video.duration && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">{video.duration}</span>}
                        </div>
                        <div className="flex flex-1 flex-col p-3.5">
                          <p className="line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-blue-700">{video.title}</p>
                          {video.channel && <p className="mt-1 text-xs text-gray-500">{video.channel}</p>}
                          {video.description && <p className="mt-1.5 line-clamp-2 text-xs text-gray-600">{video.description}</p>}
                          {(video.rating || video.price) && (
                            <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                              {video.rating && <Badge tone="amber">★ {video.rating}</Badge>}
                              {video.price && <Badge tone="green">{video.price}</Badge>}
                            </div>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState icon="video" title="Nothing found yet" text="Try Refresh, or add more detail to your request." action={<button type="button" onClick={() => getRecommendedVideos(selectedVideoRequest, true)} className={btn.primary}>Search again</button>} />
              )}
            </ItemFrame>
          </>
        ) : (
          <Panel fill>
            <EmptyState icon="video" title="Find learning videos" text="Create a request with what you want to learn and your level, and we will recommend the best YouTube videos for it." action={<button type="button" onClick={() => setShowAddVideoRequest(true)} className={btn.primary}><Icon name="plus" /> New request</button>} />
          </Panel>
        )}
      </Workspace>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
};

export default VideoLibraryInlineView;
