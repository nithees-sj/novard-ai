import React from 'react';
import { Navigationinner } from '../components/navigationinner';
import ChatbotButton from '../components/ChatbotButton';
import RoadmapWorkspace from '../components/roadmap/RoadmapWorkspace';

/** Stand-alone Smart Roadmap page (/roadmap). */
const Roadmap = () => (
  <>
    <Navigationinner title={"ROADMAP"} hideLogo={true} hasSidebar={false} />
    <div className="min-h-screen bg-gray-50 pt-14">
      <div className="p-6">
        <RoadmapWorkspace heightClass="h-[calc(100vh-104px)]" />
      </div>
      <ChatbotButton />
    </div>
  </>
);

export default Roadmap;
