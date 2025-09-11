import React from 'react';
import { Navigationinner } from "../components/navigationinner";
import ChatbotButton from '../components/ChatbotButton';

const Forum = () => {
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
      <Navigationinner title={"AI FORUM"} />
      <div style={styles.container}>
        <div style={styles.content}>
          <h1 style={styles.title}>AI Forum</h1>
          <p style={styles.description}>
            Connect with like-minded individuals in our AI-powered forum. Share experiences, 
            ask questions, and learn from the community about career development, technology, 
            and professional growth.
          </p>
        </div>
        <ChatbotButton />
      </div>
    </>
  );
};

export default Forum;
