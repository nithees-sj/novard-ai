import React from 'react';
import { Navigationinner } from '../components/navigationinner';
import ChatbotButton from '../components/ChatbotButton';
import SkillGapWorkspace from '../components/skillgap/SkillGapWorkspace';

/** Stand-alone Skill Gap Analysis page (/skills-required). */
const SkillsPage = () => (
  <>
    <Navigationinner title={"SKILL GAP COACH"} hideLogo={true} hasSidebar={false} />
    <div className="min-h-screen bg-gray-50 pt-14">
      <div className="p-6">
        <SkillGapWorkspace heightClass="h-[calc(100vh-104px)]" />
      </div>
      <ChatbotButton />
    </div>
  </>
);

export default SkillsPage;
