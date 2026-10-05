import React, { useState, useEffect } from 'react';
import { api, errorMessage } from '../lib/api';
import logger from '../lib/logger';
import { currentEmail } from '../lib/session';
import {
  Workspace, Panel, ItemFrame, GeneratingState, EmptyState, LoadingPanel, SideList, ListItem, ListEmpty, Badge, Toast, Icon, btn, Spinner, useToastTimer } from './learning/LearningUI';
import confirm from './ui/confirm';
import NewVideoRequestForm from './learning/NewVideoRequestForm';


const VideoLibraryInlineView = () => {
  const [videoRequests, setVideoRequests] = useState([]);
  const [selectedVideoRequest, setSelectedVideoRequest] = useState(null);
  const [showAddVideoRequest, setShowAddVideoRequest] = useState(false);
  const [recommendedVideos, setRecommendedVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [videoCache, setVideoCache] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [addError, setAddError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const platforms = {
    youtube: { name: 'YouTube' }
  };

  const showToast = useToastTimer(setToast);

  useEffect(() => {
    loadUserVideoRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUserVideoRequests = async () => {
    try {
      const response = await api.get(`/educational-video-requests/${encodeURIComponent(currentEmail())}`);
      const videoRequestsData = Array.isArray(response.data) ? response.data : [];
      setVideoRequests(videoRequestsData);

      if (videoRequestsData.length > 0 && !selectedVideoRequest) {
        setSelectedVideoRequest(videoRequestsData[0]);
        getRecommendedVideos(videoRequestsData[0], false);
      }
    } catch (error) {
      logger.error('Error loading video requests', error);
      showToast(errorMessage(error, 'Could not load your requests.'), 'error');
    } finally {
      setLoaded(true);
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
      const response = await api.post(`/recommend-educational-videos`, {
        title: videoRequest.title,
        description: videoRequest.description,
        platform: videoRequest.platform || 'youtube'
      });
      const videos = response.data.videos || [];
      setRecommendedVideos(videos);
      setVideoCache(prev => ({ ...prev, [requestId]: videos }));
    } catch (error) {
      logger.error('Error getting recommended videos', error);
      showToast(errorMessage(error, 'Error getting video recommendations'), 'error');
      setRecommendedVideos([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Called by the new-request form in the main area: save it, open it and start searching.
  const handleAddVideoRequest = async (request) => {
    setIsSaving(true);
    setAddError(null);
    try {
      const { data: created } = await api.post('/educational-video-requests', request);
      // Open the new request and start searching first, then refresh the list.
      if (created) {
        setSelectedVideoRequest(created);
        getRecommendedVideos(created, true);
      }
      setShowAddVideoRequest(false);
      await loadUserVideoRequests();
      return true;
    } catch (error) {
      logger.error('Error adding video request', error);
      setAddError(errorMessage(error, 'Your request could not be saved. Please try again.'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const openRequest = (request) => {
    setSelectedVideoRequest(request);
    setShowAddVideoRequest(false);
    setAddError(null);
    getRecommendedVideos(request, false);
  };

  const handleDeleteVideoRequest = async (videoRequestId, videoRequestTitle) => {
    if (!(await confirm({ title: 'Delete this request?', message: `“${videoRequestTitle}” and its video list will be removed.`, confirmLabel: 'Delete', danger: true }))) return;

    try {
      await api.delete(`/educational-video-requests/${videoRequestId}`);
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
      logger.error('Error deleting video request', error);
      showToast(errorMessage(error, 'Error deleting video request.'), 'error');
    }
  };

  // The form fills the main area: on request, or straight away when there are no requests yet.
  const adding = showAddVideoRequest || (loaded && videoRequests.length === 0);

  return (
    <>
      <Workspace
        side={(
          <SideList
            loading={!loaded}
            title="Your requests"
            count={videoRequests.length}
            action={(
              <button
                type="button"
                onClick={() => { setShowAddVideoRequest(true); setAddError(null); }}
                aria-pressed={adding}
                className={`${adding ? btn.secondary : btn.primary} w-full`}
              >
                <Icon name="plus" /> {adding ? 'Writing a request…' : 'New request'}
              </button>
            )}
          >
            {videoRequests.length > 0 ? videoRequests.map((request) => (
              <ListItem
                key={request._id || request.id}
                active={selectedVideoRequest?._id === request._id && !adding}
                title={request.title}
                subtitle={request.description}
                badges={<Badge tone="blue">{platforms[request.platform]?.name || 'Videos'}</Badge>}
                onSelect={() => openRequest(request)}
                onDelete={() => handleDeleteVideoRequest(request._id || request.id, request.title)}
              />
            )) : <ListEmpty icon="video" title="No requests yet" text="Tell us what you want to learn and we will find videos for it." />}
          </SideList>
        )}
      >
        {adding ? (
          <NewVideoRequestForm
            onSubmit={handleAddVideoRequest}
            onCancel={videoRequests.length > 0 ? () => { setShowAddVideoRequest(false); setAddError(null); } : undefined}
            submitting={isSaving}
            error={addError}
            isFirst={videoRequests.length === 0}
          />
        ) : selectedVideoRequest ? (
          <>
            <ItemFrame
              icon="video"
              title={selectedVideoRequest.title}
              meta={`Recommended ${platforms[selectedVideoRequest.platform]?.name || 'educational'} videos`}
              actions={(
                <button type="button" onClick={() => !isLoading && getRecommendedVideos(selectedVideoRequest, true)} disabled={isLoading} className={btn.secondary}>
                  {isLoading ? <><Spinner /> Searching…</> : <><Icon name="refresh" /> Refresh</>}
                </button>
              )}
            >
              {isLoading ? (
                <GeneratingState icon="video" title={selectedVideoRequest.platform === 'youtube' ? 'Finding videos' : 'Finding courses'} hint={`Searching ${platforms[selectedVideoRequest.platform]?.name || 'the web'} for the best learning content for this request.`} />
              ) : recommendedVideos.length > 0 ? (
                <div className="h-full overflow-y-auto p-5">
                  <div className="grid gap-x-5 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
                    {recommendedVideos.map((video, index) => (
                      <a key={index} href={video.url} target="_blank" rel="noopener noreferrer" className="group flex flex-col rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                        <div className="relative aspect-video overflow-hidden rounded-lg bg-sunken ring-1 ring-line-subtle">
                          <img src={video.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.src = '/courses.jpg'; }} />
                          {video.duration && video.duration !== 'Unknown' && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-micro font-medium text-white">{video.duration}</span>}
                        </div>
                        <div className="flex flex-1 flex-col pt-2.5">
                          <p className="line-clamp-2 text-body font-medium text-fg group-hover:text-accent-fg">{video.title}</p>
                          {video.channel && <p className="mt-1 text-small text-fg-subtle">{video.channel}</p>}
                          {/* The search API fills a generic line when a video has no description; hide it. */}
                          {video.description && !/^Educational (video|course) content$/.test(video.description) && <p className="mt-1.5 line-clamp-2 text-small text-fg-muted">{video.description}</p>}
                          {(video.rating || video.price) && (
                            <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                              {video.rating && <Badge tone="warning"><Icon name="star" className="h-3 w-3" /> {video.rating}</Badge>}
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
          loaded ? (
            <Panel fill>
              <EmptyState icon="video" title="Pick a request" text="Choose one of your requests, or start a new one." />
            </Panel>
          ) : <LoadingPanel label="Loading your requests…" />
        )}
      </Workspace>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
};

export default VideoLibraryInlineView;
