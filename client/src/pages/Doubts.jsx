import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { readParam, clearParam } from '../lib/openParam';
import AppShell from '../components/layout/AppShell';
import ToolIndex, { ToolAside } from '../components/layout/ToolIndex';
import { PageHeader } from '../components/ui/Headers';
import Button from '../components/ui/Button';
import NotesInlineView from '../components/NotesInlineView';
import DoubtClearanceInlineView from '../components/DoubtClearanceInlineView';
import FeatureNotice from '../components/FeatureNotice';

const SUGGEST_TOPICS_PROMPT = 'Suggest new topics I should explore next, based on what I have been learning so far.';

const Doubts = () => {
  const navigate = useNavigate();
  // ?tool=<name> opens a section directly (links from the Novard Agent and the profile page).
  const [activeView, setActiveView] = useState(() => ({ notes: 'notes', doubts: 'doubtClearance' })[readParam('tool')] || 'landing'); // 'landing', 'notes', 'doubtClearance'
  useEffect(() => clearParam('tool'), []);

  const tool = activeView === 'landing' ? undefined : { key: activeView, onBack: () => setActiveView('landing') };

  return (
    <AppShell page="doubts" tool={tool} width={tool ? 'full' : 'default'}>
      <FeatureNotice tool={{ notes: 'notes', doubtClearance: 'doubts' }[activeView]} className="mb-4" />

      {activeView === 'landing' && (
        <>
          <PageHeader title="Doubts & Notes" description="Work through what you are stuck on, or study your own notes with chat, summaries and quizzes." />
          <ToolIndex
            tools={[
              {
                key: 'notes',
                description: 'Upload a PDF of your notes. Ask questions about it, read a summary, and test yourself with quizzes made from it.',
                detail: 'PDF upload · chat · summary · quizzes',
                onOpen: () => setActiveView('notes'),
              },
              {
                key: 'doubtClearance',
                description: 'Describe a doubt in your own words and work through it in a chat, then check you have it with a quiz and suggested videos.',
                detail: 'Chat · summary · quiz · video suggestions',
                onOpen: () => setActiveView('doubtClearance'),
              },
            ]}
          />
          <ToolAside
            title="Not sure what to study next?"
            text="Novard Agent suggests topics to explore, based on what you have been learning so far."
            action={(
              <Button icon="idea" onClick={() => navigate('/chatbot', { state: { prompt: SUGGEST_TOPICS_PROMPT } })}>
                Suggest topics
              </Button>
            )}
          />
        </>
      )}

      {activeView === 'notes' && <NotesInlineView />}
      {activeView === 'doubtClearance' && <DoubtClearanceInlineView />}
    </AppShell>
  );
};

export default Doubts;
