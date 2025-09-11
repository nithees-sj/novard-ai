import React from 'react';
import { useNavigate } from 'react-router-dom';
import careerImage from '../images/career.jpg';
import doubtsImage from '../images/doubts.jpg';
import aiForumImage from '../images/ai-forum.jpg';
import videoImage from '../images/video.jpg';
import { Navigationinner } from "../components/navigationinner";
import ChatbotButton from '../components/ChatbotButton';

const features = [
  {
    title: 'CAREER',
    description: 'Navigate your career with a customized roadmap, detailing milestones and actionable strategies for success.',
    imageUrl: careerImage,
    route: '/career',
    icon: '🎯',
    color: '#3B82F6'
  },
  {
    title: 'DOUBTS',
    description: 'Get answers to your career-related questions and clear your doubts with our AI-powered assistance.',
    imageUrl: doubtsImage,
    route: '/doubts',
    icon: '❓',
    color: '#10B981'
  },
  {
    title: 'AI FORUM',
    description: 'Connect with like-minded individuals and share experiences in our AI-powered community forum.',
    imageUrl: aiForumImage,
    route: '/forum',
    icon: '🤖',
    color: '#8B5CF6'
  },
  {
    title: 'VIDEO SESSIONS',
    description: 'Access exclusive video sessions with industry experts and get personalized career guidance.',
    imageUrl: videoImage,
    route: '/video',
    icon: '🎥',
    color: '#F59E0B'
  },
];

const HomePage = () => {
  const navigate = useNavigate();

  const handleLearnMore = (feature) => {
    navigate(feature.route);
  };


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
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '3rem',
      maxWidth: '900px',
      width: '100%',
      justifyContent: 'center',
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
      height: '340px',
      maxWidth: '350px'
    },
    featureCardHover: {
      transform: 'translateY(-10px) scale(1.02)',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
    },
    featureImage: {
      width: '100%',
      height: '180px',
      objectFit: 'cover',
      transition: 'transform 0.3s ease'
    },
    featureImageHover: {
      transform: 'scale(1.05)'
    },
    featureContent: {
      padding: '1.2rem 1rem 1rem 1rem',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      flex: '1',
      justifyContent: 'space-between'
    },
    featureIcon: {
      fontSize: '2rem',
      marginBottom: '0.5rem',
      display: 'block'
    },
    featureTitle: {
      fontSize: '1.1rem',
      fontWeight: '700',
      color: '#1a202c',
      marginBottom: '0.5rem',
      letterSpacing: '0.3px'
    },
    featureDescription: {
      fontSize: '0.85rem',
      color: '#4a5568',
      marginBottom: '0',
      lineHeight: '1.4',
      flex: '1'
    },
    featureButton: {
      background: 'linear-gradient(45deg, #667eea, #764ba2)',
      color: 'white',
      border: 'none',
      padding: '10px 20px',
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
    },
    featureButtonHover: {
      transform: 'translateY(-2px)',
      boxShadow: '0 6px 20px rgba(102, 126, 234, 0.6)'
    }
  };
  

  return (
    <>
      <Navigationinner title={"HOME"} />
      <div style={styles.container}>
        <h1 style={styles.welcomeText}>Welcome to NOVARD-AI</h1>
        <p style={styles.welcomeSubtext}>
            Explore our comprehensive suite of Novard
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
                  onClick={() => handleLearnMore(feature)}
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

export default HomePage;
