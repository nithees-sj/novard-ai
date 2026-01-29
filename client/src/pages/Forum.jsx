import React, { useState } from 'react';
import { Navigationinner } from "../components/navigationinner";
import ChatbotButton from '../components/ChatbotButton';
import IssueForm from '../components/IssueForm';
import IssueList from '../components/IssueList';
import IssueDetail from '../components/IssueDetail';
import Notification from '../components/Notification';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;

const Forum = () => {
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [notification, setNotification] = useState(null);

  const handleIssueSelect = (issue) => {
    setSelectedIssue(issue);
  };

  const handleBackToList = () => {
    setSelectedIssue(null);
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
      <Navigationinner title={"AI FORUM"} />
      <div className="flex min-h-screen bg-gray-50">
        {/* Main Content Area */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {selectedIssue ? (
              <IssueDetail 
                issue={selectedIssue} 
                onBack={handleBackToList}
              />
            ) : (
                <div className="text-center py-16">
                  <div className="max-w-lg mx-auto">
                    <h1 className="text-2xl font-bold text-gray-900 mb-3">
                      AI Forum
                    </h1>
                    <p className="text-sm text-gray-600 mb-6">
                      Connect with peers, share experiences, and learn from the community about
                      career development and professional growth.
                  </p>
                  <button 
                    onClick={handleCreateIssue}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm 
                             font-medium rounded-md transition-colors duration-200"
                  >
                      Create New Issue
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Issue List */}
        <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
          <IssueList
            onIssueSelect={handleIssueSelect}
            selectedIssueId={selectedIssue?.issueId}
            onCreateIssue={handleCreateIssue}
          />
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
