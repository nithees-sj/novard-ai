import React, { useEffect, useState } from 'react';
import { readParam, clearParam } from '../lib/openParam';
import AppShell from '../components/layout/AppShell';
import ToolIndex from '../components/layout/ToolIndex';
import { PageHeader } from '../components/ui/Headers';
import VideoLibraryInlineView from '../components/VideoLibraryInlineView';
import VideoSummarizerInlineView from '../components/VideoSummarizerInlineView';
import FeatureNotice from '../components/FeatureNotice';

const Video = () => {
  // ?tool=<name> opens a section directly (links from the Novard Agent and the profile page).
  const [activeView, setActiveView] = useState(() => ({ library: 'videoLibrary', summarizer: 'videoSummarizer' })[readParam('tool')] || 'landing'); // 'landing', 'videoLibrary', 'videoSummarizer'
  useEffect(() => clearParam('tool'), []);

  const tool = activeView === 'landing' ? undefined : { key: activeView, onBack: () => setActiveView('landing') };

  return (
    <AppShell page="videos" tool={tool} width={tool ? 'full' : 'default'}>
      <FeatureNotice tool={{ videoLibrary: 'videoLibrary', videoSummarizer: 'videoSummarizer' }[activeView]} className="mb-4" />

      {activeView === 'landing' && (
        <>
          <PageHeader title="Videos" description="Find videos for what you are learning, or turn a YouTube video into something you can chat with and quiz yourself on." />
          <ToolIndex
            tools={[
              {
                key: 'videoLibrary',
                description: 'Ask for videos on a topic and get a curated list from YouTube and course sites, with ratings and prices where they apply.',
                detail: 'Requests · curated videos · kept for later',
                onOpen: () => setActiveView('videoLibrary'),
              },
              {
                key: 'videoSummarizer',
                description: 'Paste a YouTube link. Chat about the video, read a summary of it, and take a quiz on what it covers.',
                detail: 'YouTube link · chat · summary · quiz',
                onOpen: () => setActiveView('videoSummarizer'),
              },
            ]}
          />
        </>
      )}

      {activeView === 'videoLibrary' && <VideoLibraryInlineView />}
      {activeView === 'videoSummarizer' && <VideoSummarizerInlineView />}
    </AppShell>
  );
};

export default Video;
