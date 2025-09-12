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
    background: '#fff', // Pure white
    justifyContent: 'flex-start',
    alignItems: 'center',
    overflowY: 'auto',
    padding: '24px 2.5rem 3rem'
  },
  welcomeText: {
    color: '#111827', // Deep black
    fontSize: '2.2rem',
    fontWeight: 'bold',
    marginBottom: '1.9rem',
    textAlign: 'center',
    textShadow: 'none'
  },
  welcomeSubtext: {
    color: '#374151', // Muted dark grey
    fontSize: '1.4rem',
    marginBottom: '3.2rem',
    textAlign: 'center',
    maxWidth: '650px'
  },
  featuresContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '2rem',
    maxWidth: '900px',
    width: '100%',
    justifyContent: 'center',
    margin: '0 auto',
    padding: '0 2.5rem'
  },
  featureCard: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: '24px',
    boxShadow: '0 10px 36px rgba(0,0,0,0.12)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    backdropFilter: 'blur(10px)',
    border: '1.5px solid rgba(0,0,0,0.06)',
    width: '100%',
    minHeight: '350px',
    maxWidth: '320px'
  },
  featureCardHover: {
    transform: 'translateY(-10px) scale(1.02)',
    boxShadow: '0 20px 52px rgba(0, 0, 0, 0.14)'
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
    padding: '1.2rem 1rem 1.5rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
    minHeight: 0
  },
  featureIcon: {
    fontSize: '2.2rem',
    marginBottom: '0.6rem',
    display: 'block'
  },
  featureTitle: {
    fontSize: '1.24rem',
    fontWeight: '700',
    color: '#111827',
    marginBottom: '0.5rem',
    letterSpacing: '0.4px'
  },
  featureDescription: {
    fontSize: '1rem',
    color: '#4a5568',
    marginBottom: '0',
    lineHeight: '1.5',
    flex: '1'
  },
  featureButton: {
    marginTop: '1.2rem',
    alignSelf: 'center',
    background: '#111827',
    color: '#fff',
    border: 'none',
    padding: '12px 28px',
    borderRadius: '30px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '700',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 14px rgba(0,0,0,0.09)',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    width: 'fit-content',
    position: 'relative',
    bottom: 0
  },
  featureButtonHover: {
    transform: 'translateY(-2px)',
    background: '#22262a',
    boxShadow: '0 8px 22px rgba(0,0,0,0.15)'
  }
};

  

  return (
    <>
      <Navigationinner title={"HOME"} />
      <div style={styles.container}>
        <h2 style={styles.welcomeText}>Welcome to NOVARD-AI</h2>
        
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
