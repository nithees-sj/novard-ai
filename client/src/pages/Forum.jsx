import React, { useState } from 'react';
import { Navigationinner } from "../components/navigationinner";
import Sidebar from '../components/Sidebar';
import ChatbotButton from '../components/ChatbotButton';
import IssueForm from '../components/IssueForm';
import ForumGrid from '../components/ForumGrid';
import IssueDetail from '../components/IssueDetail';
import Notification from '../components/Notification';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;

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

  const handleCreateIssue = () => {
    setShowIssueForm(true);
  };

  const handleIssueSubmit = async (issueData) => {
    try {
      const response = await fetch(`${apiUrl}/api/forum/issues`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(issueData),
      });

      if (!response.ok) {
        throw new Error('Failed to create issue');
      }

      const newIssue = await response.json();
      setSelectedIssue(newIssue);
      setListVersion((v) => v + 1);
      setShowIssueForm(false);
      setNotification({
        message: 'Issue created successfully!',
        type: 'success'
      });
    } catch (error) {
      console.error('Error creating issue:', error);
      setNotification({
        message: 'Failed to create issue. Please try again.',
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
      <Navigationinner title={"AI FORUM"} hideLogo={true} hasSidebar={true} />
      <div className="flex bg-gray-50 min-h-screen pt-14">
        {/* Main Navigation Sidebar - LEFT */}
        <Sidebar />

        {/* Main Content Area - Full Width */}
        <div className="ml-64 flex-1" style={{ height: 'calc(100vh - 56px)' }}>
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
        </div>
        
        <ChatbotButton />
      </div>

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
