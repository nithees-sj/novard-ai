import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { readParam, clearParam } from '../lib/openParam';
import AppShell from '../components/layout/AppShell';
import ToolIndex, { ToolAside } from '../components/layout/ToolIndex';
import { PageHeader } from '../components/ui/Headers';
import Button from '../components/ui/Button';
import RoadmapInlineView from '../components/RoadmapInlineView';
import SkillsInlineView from '../components/SkillsInlineView';
import FeatureNotice from '../components/FeatureNotice';

const MOCK_INTERVIEW_PROMPT = 'I want to practise a mock interview. First ask me which role and level I am interviewing for, then interview me one question at a time and give me feedback on each answer.';

const Career = () => {
  const navigate = useNavigate();
  // ?tool=<name> opens a section directly (links from the Novard Agent and the profile page).
  const [activeView, setActiveView] = useState(() => ({ roadmap: 'roadmap', skills: 'skills' })[readParam('tool')] || 'landing'); // 'landing', 'roadmap', 'skills'
  useEffect(() => clearParam('tool'), []);

  const back = () => setActiveView('landing');
  const tool = activeView === 'landing' ? undefined : { key: activeView, onBack: back };

  return (
    <AppShell page="career" tool={tool} width={tool ? 'full' : 'default'}>
      <FeatureNotice tool={{ roadmap: 'roadmap', skills: 'skillGap' }[activeView]} className="mb-4" />

      {activeView === 'landing' && (
        <>
          <PageHeader title="Career" description="Plan the route to the role you want, and find out which skills are missing on the way." />
          <ToolIndex
            tools={[
              {
                key: 'roadmap',
                description: 'Name the role and how much time you have. You get a step-by-step roadmap with milestones and resources, saved here to come back to.',
                detail: 'Roadmap · milestone diagram · resources',
                onOpen: () => setActiveView('roadmap'),
              },
              {
                key: 'skills',
                description: 'A short conversation compares the skills you have with what a target role asks for, then ranks the gaps and what to learn first.',
                detail: 'Ranked gaps · what to learn first',
                onOpen: () => setActiveView('skills'),
              },
            ]}
          />
          <ToolAside
            title="Practise an interview"
            text="Novard Agent asks which role and level you are interviewing for, then asks one question at a time and gives feedback on every answer."
            action={(
              <Button icon="mic" onClick={() => navigate('/chatbot', { state: { prompt: MOCK_INTERVIEW_PROMPT } })}>
                Start a mock interview
              </Button>
            )}
          />
        </>
      )}

      {activeView === 'roadmap' && <RoadmapInlineView />}
      {activeView === 'skills' && <SkillsInlineView />}
    </AppShell>
  );
};

export default Career;
