import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigationinner } from "../components/navigationinner";
import ChatbotButton from '../components/ChatbotButton';
import videoImage from '../images/video.jpg';
import aiForumImage from '../images/ai-forum.jpg';

const features = [
  {
    title: 'YOUTUBE VIDEOS',
    description: 'Access curated YouTube videos with industry experts, tutorials, and educational content to enhance your learning journey.',
    imageUrl: videoImage,
    icon: '🎥',
    route: '/youtube-videos'
  },
  {
    title: 'VIDEO DOUBTS - YOUTUBE SUMMARIZER AND QUIZ',
    description: 'Add video doubts with YouTube video links and interact with them through chat, summarization, and quiz features powered by AI.',
    imageUrl: aiForumImage,
    icon: '📝',
    route: '/youtube-video-summarizer'
  },
];

const Video = () => {
  const navigate = useNavigate();
  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      background: '#f8fafc',
      justifyContent: 'flex-start',
      alignItems: 'center',
      overflowY: 'auto', 
      padding: '10px 1rem 2rem'
    },
    welcomeText: {
      color: '#2d3748',
      fontSize: '2.5rem',
      fontWeight: 'bold',
      marginBottom: '1rem',
      textAlign: 'center',
      textShadow: 'none'
    },
    welcomeSubtext: {
      color: '#718096',
      fontSize: '1.2rem',
      marginBottom: '3rem',
      textAlign: 'center',
      maxWidth: '600px'
    },
    featuresContainer: {
      display: 'flex',
      justifyContent: 'center',
      gap: '3rem',
      maxWidth: '900px',
      width: '100%',
      margin: '0 auto',
      padding: '0 2rem',
    },
    featureCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '20px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      textAlign: 'center',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      position: 'relative',
      width: '100%',
      height: '360px',
      maxWidth: '350px'
    },
    featureImage: {
      width: '100%',
      height: '180px',
      objectFit: 'cover',
      transition: 'transform 0.3s ease'
    },
    featureContent: {
      padding: '1.5rem 1rem',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      flex: '1',
      justifyContent: 'space-between'
    },
    featureIcon: {
      fontSize: '2.5rem',
      marginBottom: '0.8rem',
      display: 'block'
    },
    featureTitle: {
      fontSize: '1.1rem',
      fontWeight: '700',
      color: '#1a202c',
      marginBottom: '0.8rem',
      letterSpacing: '0.3px',
      lineHeight: '1.3'
    },
    featureDescription: {
      fontSize: '0.9rem',
      color: '#4a5568',
      marginBottom: '0',
      lineHeight: '1.5',
      flex: '1'
    },
    featureButton: {
      background: 'linear-gradient(45deg, #667eea, #764ba2)',
      color: 'white',
      border: 'none',
      padding: '12px 24px',
      borderRadius: '25px',
      cursor: 'pointer',
      fontSize: '0.9rem',
      fontWeight: '600',
      transition: 'all 0.3s ease',
      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      width: 'fit-content',
      alignSelf: 'center',
      marginTop: '1rem'
    }
  };

  const handleExplore = (feature) => {
    if (feature.route) {
      navigate(feature.route);
    } else {
      // Add navigation logic here when the actual pages are created
      console.log('Exploring:', feature.title);
    }
  };

  return (
    <>
      <Navigationinner title={"VIDEO SESSIONS"} />
      <div style={styles.container}>
        <h1 style={styles.welcomeText}>Video Sessions & Learning</h1>
        <p style={styles.welcomeSubtext}>
          Access curated videos and get AI-powered summaries to enhance your learning experience
        </p>
        
        <div style={styles.featuresContainer}>
          {features.map((feature, index) => (
            <div 
              key={index} 
              style={styles.featureCard}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)';
                e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.3)';
                const img = e.currentTarget.querySelector('img');
                if (img) img.style.transform = 'scale(1.05)';
                const btn = e.currentTarget.querySelector('button');
                if (btn) {
                  btn.style.transform = 'translateY(-2px)';
                  btn.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.2)';
                const img = e.currentTarget.querySelector('img');
                if (img) img.style.transform = 'scale(1)';
                const btn = e.currentTarget.querySelector('button');
                if (btn) {
                  btn.style.transform = 'translateY(0)';
                  btn.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
                }
              }}
            >
              <img 
                src={feature.imageUrl} 
                alt={feature.title} 
                style={styles.featureImage}
              />
              <div style={styles.featureContent}>
                <span style={styles.featureIcon}>{feature.icon}</span>
                <h2 style={styles.featureTitle}>{feature.title}</h2>
                <p style={styles.featureDescription}>{feature.description}</p>
                <button 
                  style={styles.featureButton} 
                  onClick={() => handleExplore(feature)}
                >
                  Explore Now
                </button>
              </div>
            </div>
          ))}
        </div>
        <ChatbotButton />
      </div>
    </>
  );
};

export default Video;
