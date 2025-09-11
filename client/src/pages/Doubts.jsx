import React from 'react';
import { Navigationinner } from "../components/navigationinner";
import ChatbotButton from '../components/ChatbotButton';

const Doubts = () => {
  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: '#f7fafc',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '2rem',
    },
    content: {
      backgroundColor: '#fff',
      borderRadius: '8px',
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
      padding: '3rem',
      textAlign: 'center',
      maxWidth: '600px',
      width: '100%',
    },
    title: {
      fontSize: '2rem',
      fontWeight: 'bold',
      color: '#2d3748',
      marginBottom: '1rem',
    },
    description: {
      fontSize: '1.1rem',
      color: '#4a5568',
      lineHeight: '1.6',
    },
  };

  return (
    <>
      <Navigationinner title={"DOUBTS"} />
      <div style={styles.container}>
        <div style={styles.content}>
          <h1 style={styles.title}>Doubts & Questions</h1>
          <p style={styles.description}>
            Get answers to your career-related doubts and questions. Our AI-powered system 
            is here to help you clarify your path and make informed decisions about your future.
          </p>
        </div>
        <ChatbotButton />
      </div>
    </>
  );
};

export default Doubts;
