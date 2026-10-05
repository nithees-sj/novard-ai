import React, { useEffect, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import { readOpenParam, clearOpenParam } from '../lib/openParam';
import IssueForm from '../components/IssueForm';
import ForumGrid from '../components/ForumGrid';
import IssueDetail from '../components/IssueDetail';
import Notification from '../components/Notification';
import { apiJson } from '../lib/api';
import logger from '../lib/logger';

const Forum = () => {
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [notification, setNotification] = useState(null);
  // Bumped whenever the list may be stale (new post, deletion, returning from a thread).
  const [listVersion, setListVersion] = useState(0);

  const handleIssueSelect = (issue) => {
    setSelectedIssue(issue);
  };

  const handleBackToList = () => {
    setSelectedIssue(null);
    setListVersion((v) => v + 1); // reply counts and status may have changed
  };

  const handleIssueDeleted = (issue) => {
    setSelectedIssue(null);
    setListVersion((v) => v + 1);
    setNotification({ message: `Deleted "${issue.title}".`, type: 'success' });
  };

  // Opened from the Novard Agent's "Open discussion" link.
  useEffect(() => {
    const id = readOpenParam();
    if (!id) return;
    clearOpenParam();
    apiJson(`/api/forum/issues/${encodeURIComponent(id)}`)
      .then((issue) => setSelectedIssue(issue))
      .catch(() => setNotification({ message: 'That discussion could not be found.', type: 'error' }));
  }, []);

  const handleCreateIssue = () => {
    setShowIssueForm(true);
  };

  const handleIssueSubmit = async (issueData) => {
    try {
      const newIssue = await apiJson('/api/forum/issues', { method: 'POST', body: issueData });
      setSelectedIssue(newIssue);
      setListVersion((v) => v + 1);
      setShowIssueForm(false);
      setNotification({
        message: 'Issue created successfully!',
        type: 'success'
      });
    } catch (error) {
      logger.error('Error creating issue', error);
      setNotification({
        message: error.message || 'Failed to create issue. Please try again.',
        type: 'error'
      });
      throw error;
    }
  };

  const handleFormCancel = () => {
    setShowIssueForm(false);
  };

  const handleNotificationClose = () => {
    setNotification(null);
  };

  return (
    <>
      <AppShell page="forum" width={selectedIssue ? 'full' : 'default'} crumbs={selectedIssue ? [{ label: 'Home', to: '/home' }, { label: 'Forum', onClick: handleBackToList }, { label: selectedIssue.title }] : undefined} title={selectedIssue ? `${selectedIssue.title} · Forum` : undefined}>
          {selectedIssue ? (
            <IssueDetail
              issue={selectedIssue}
              onBack={handleBackToList}
              onDeleted={handleIssueDeleted}
            />
          ) : (
              <ForumGrid
                onIssueSelect={handleIssueSelect}
                onCreateIssue={handleCreateIssue}
                refreshKey={listVersion}
              />
          )}
      </AppShell>

      <IssueForm
        onSubmit={handleIssueSubmit}
        onCancel={handleFormCancel}
        isVisible={showIssueForm}
      />

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={handleNotificationClose}
        />
      )}
    </>
  );
};

export default Forum;
