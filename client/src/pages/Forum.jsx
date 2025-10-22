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

  const getResponsiveStyles = () => {
    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
    
    return {
      container: {
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: '#f7fafc',
      },
      mainContent: {
        display: 'flex',
        flex: 1,
        height: isMobile ? 'calc(100vh - 50px)' : isTablet ? 'calc(100vh - 56px)' : 'calc(100vh - 80px)',
        overflow: 'hidden',
        position: 'relative',
        flexDirection: isMobile ? 'column' : 'row'
      },
      leftPanel: {
        flex: isMobile ? 'none' : 2.5,
        display: 'flex',
        flexDirection: 'column',
        borderRight: isMobile ? 'none' : '1px solid #e2e8f0',
        borderBottom: isMobile ? '1px solid #e2e8f0' : 'none',
        overflow: 'auto',
        height: isMobile ? '50%' : '100%',
        position: 'relative',
        marginRight: isMobile ? '0' : isTablet ? '300px' : '380px',
        order: isMobile ? 2 : 1
      },
      rightPanel: {
        position: isMobile ? 'relative' : 'fixed',
        top: isMobile ? 'auto' : isTablet ? '56px' : '80px',
        right: isMobile ? 'auto' : 0,
        width: isMobile ? '100%' : isTablet ? '300px' : '380px',
        minWidth: isMobile ? '100%' : '280px',
        maxWidth: isMobile ? '100%' : isTablet ? '300px' : '380px',
        height: isMobile ? '50%' : 'calc(100vh - 80px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#fff',
        zIndex: 10,
        borderLeft: isMobile ? 'none' : '1px solid #e2e8f0',
        borderTop: isMobile ? '1px solid #e2e8f0' : 'none',
        order: isMobile ? 1 : 2
      },
      welcomeMessage: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        width: '100%',
        padding: isMobile ? '0.8rem' : isTablet ? '1.2rem' : '1.5rem',
        textAlign: 'center',
        minHeight: isMobile ? 'calc(50vh - 25px)' : isTablet ? 'calc(100vh - 56px)' : 'calc(100vh - 80px)',
      },
      welcomeContent: {
        backgroundColor: '#fff',
        borderRadius: isMobile ? '6px' : '10px',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.12)',
        padding: isMobile ? '1.2rem' : isTablet ? '2rem' : '3rem',
        maxWidth: isMobile ? '100%' : isTablet ? '500px' : '600px',
        width: '100%',
        margin: '0 auto',
      },
      title: {
        fontSize: isMobile ? '1.5rem' : isTablet ? '2rem' : '2.4rem',
        fontWeight: 'bold',
        color: '#2d3748',
        marginBottom: isMobile ? '0.8rem' : isTablet ? '1.2rem' : '1.5rem',
      },
      description: {
        fontSize: isMobile ? '0.9rem' : isTablet ? '1rem' : '1.2rem',
        color: '#4a5568',
        lineHeight: '1.6',
        marginBottom: isMobile ? '1.2rem' : isTablet ? '1.5rem' : '2rem',
      },
      getStartedButton: {
        padding: isMobile ? '0.6rem 1.2rem' : isTablet ? '0.8rem 1.5rem' : '1rem 2rem',
        backgroundColor: '#3182ce',
        color: 'white',
        border: 'none',
        borderRadius: isMobile ? '6px' : '8px',
        cursor: 'pointer',
        fontSize: isMobile ? '0.9rem' : isTablet ? '1rem' : '1.1rem',
        fontWeight: '600',
        width: isMobile ? '100%' : 'auto'
      },
    };
  };

  const styles = getResponsiveStyles();

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
