import React, { useState } from 'react';
import { Navigationinner } from "../components/navigationinner";
import ChatbotButton from '../components/ChatbotButton';
import IssueForm from '../components/IssueForm';
import IssueList from '../components/IssueList';
import IssueDetail from '../components/IssueDetail';
import Notification from '../components/Notification';

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
      const response = await fetch('http://localhost:5000/api/forum/issues', {
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

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: '#f7fafc',
    },
    mainContent: {
      display: 'flex',
      flex: 1,
      height: 'calc(100vh - 80px)', // Subtract header height
      overflow: 'hidden', // Prevent main content from scrolling
    },
    leftPanel: {
      flex: 2.5, // Increased from 1 to give more space to main content
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid #e2e8f0',
      overflow: 'auto', // Allow left panel to scroll
      height: '100%', // Take full height
      position: 'relative', // For proper centering
    },
    rightPanel: {
      flex: 1, // Decreased from 1 to make sidebar narrower
      display: 'flex',
      flexDirection: 'column',
      minWidth: '320px', // Increased minimum width for better readability
      maxWidth: '450px', // Increased maximum width for better content display
      overflow: 'hidden', // Keep right panel fixed - no scrolling
      height: '100%', // Take full height
      position: 'sticky', // Make it sticky
      top: 0, // Stick to top
    },
    welcomeMessage: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      width: '100%',
      padding: '2rem',
      textAlign: 'center',
      minHeight: 'calc(100vh - 80px)', // Ensure it takes full height
    },
    welcomeContent: {
      backgroundColor: '#fff',
      borderRadius: '12px', // Increased border radius
      boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)', // Enhanced shadow
      padding: '4rem', // Increased padding
      maxWidth: '700px', // Increased max width
      width: '100%',
      margin: '0 auto', // Center horizontally
    },
    title: {
      fontSize: '3rem', // Further increased from 2.5rem
      fontWeight: 'bold',
      color: '#2d3748',
      marginBottom: '2rem', // Increased margin
    },
    description: {
      fontSize: '1.5rem', // Further increased from 1.3rem
      color: '#4a5568',
      lineHeight: '1.8', // Increased line height
      marginBottom: '3rem', // Increased margin
    },
    getStartedButton: {
      padding: '1.25rem 3rem', // Further increased padding
      backgroundColor: '#3182ce',
      color: 'white',
      border: 'none',
      borderRadius: '10px', // Increased border radius
      cursor: 'pointer',
      fontSize: '1.4rem', // Further increased font size
      fontWeight: '600',
    },
  };

  return (
    <>
      <Navigationinner title={"AI FORUM"} />
      <div style={styles.container}>
        <div style={styles.mainContent}>
          <div style={styles.leftPanel}>
            {selectedIssue ? (
              <IssueDetail 
                issue={selectedIssue} 
                onBack={handleBackToList}
              />
            ) : (
              <div style={styles.welcomeMessage}>
                <div style={styles.welcomeContent}>
                  <h1 style={styles.title}>AI Forum</h1>
                  <p style={styles.description}>
                    Connect with like-minded individuals in our AI-powered forum. Share experiences, 
                    ask questions, and learn from the community about career development, technology, 
                    and professional growth.
                  </p>
                  <button 
                    onClick={handleCreateIssue}
                    style={styles.getStartedButton}
                  >
                    Get Started - Create Your First Issue
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div style={styles.rightPanel}>
            <IssueList 
              onIssueSelect={handleIssueSelect}
              selectedIssueId={selectedIssue?.issueId}
              onCreateIssue={handleCreateIssue}
            />
          </div>
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
