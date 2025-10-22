import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigationinner } from "../components/navigationinner";
import ChatbotButton from '../components/ChatbotButton';
import notesImage from '../images/notes.jpg';
import doubtClearanceImage from '../images/doubt-clearance.jpg';

const features = [
  {
    title: 'NOTES (Q/A) / (QUIZ)',
    description: 'Access comprehensive notes, practice with Q&A sessions, and test your knowledge with interactive quizzes.',
    imageUrl: notesImage,
    icon: '📚',
    route: '/notes'
  },
  {
    title: 'DOUBT CLEARANCE',
    description: 'Get personalized doubt clearance sessions and participate in quiz-based learning to strengthen your understanding.',
    imageUrl: doubtClearanceImage,
    icon: '❓',
    route: '/doubt-clearance'
  },
];

const Doubts = () => {
  const navigate = useNavigate();

  const getResponsiveStyles = () => {
    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
    
    return {
      container: {
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: '#fff',
        justifyContent: 'flex-start',
        alignItems: 'center',
        overflowY: 'auto',
        padding: isMobile ? '1rem 1rem 2rem' : isTablet ? '1.5rem 1.5rem 2.5rem' : '2rem 2rem 3rem'
      },
      welcomeText: {
        color: '#111827',
        fontSize: isMobile ? '1.2rem' : isTablet ? '1.4rem' : '1.6rem',
        fontWeight: 'bold',
        marginBottom: isMobile ? '0.5rem' : isTablet ? '0.6rem' : '0.8rem',
        textAlign: 'center',
        textShadow: 'none'
      },
      welcomeSubtext: {
        color: '#374151',
        fontSize: isMobile ? '0.7rem' : isTablet ? '0.8rem' : '0.9rem',
        marginBottom: isMobile ? '1.2rem' : isTablet ? '1.5rem' : '1.8rem',
        textAlign: 'center',
        maxWidth: isMobile ? '100%' : isTablet ? '400px' : '450px',
        padding: isMobile ? '0 1rem' : '0'
      },
      featuresContainer: {
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(2, 1fr)',
        gap: isMobile ? '1.5rem' : isTablet ? '2rem' : '2.5rem',
        maxWidth: isMobile ? '100%' : isTablet ? '600px' : '700px',
        width: '100%',
        margin: '0 auto',
        padding: isMobile ? '0 1rem 2rem' : isTablet ? '0 1.5rem 2.5rem' : '0 2rem 3rem'
      },
      featureCard: {
        backgroundColor: 'rgba(255,255,255,0.98)',
        borderRadius: isMobile ? '16px' : isTablet ? '20px' : '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        textAlign: 'center',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(0,0,0,0.08)',
        position: 'relative',
        width: '100%',
        height: isMobile ? '280px' : isTablet ? '300px' : '320px',
        maxWidth: isMobile ? '100%' : isTablet ? '100%' : '320px',
        transform: 'translateY(0)',
        '&:hover': {
          transform: 'translateY(-8px)',
          boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
          border: '1px solid rgba(0,0,0,0.12)'
        }
      },
      featureImage: {
        width: '100%',
        height: isMobile ? '80px' : isTablet ? '90px' : '100px',
        objectFit: 'cover',
        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        borderRadius: isMobile ? '16px 16px 0 0' : isTablet ? '20px 20px 0 0' : '24px 24px 0 0'
      },
      featureContent: {
        padding: isMobile ? '0.8rem 0.6rem 0.8rem 0.6rem' : isTablet ? '1rem 0.8rem 1rem 0.8rem' : '1.2rem 1rem 1.2rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flex: '1',
        justifyContent: 'space-between',
        minHeight: '120px'
      },
      featureIcon: {
        fontSize: isMobile ? '1.2rem' : isTablet ? '1.4rem' : '1.6rem',
        marginBottom: isMobile ? '0.3rem' : '0.4rem',
        display: 'block'
      },
      featureTitle: {
        fontSize: isMobile ? '0.9rem' : isTablet ? '1rem' : '1.1rem',
        fontWeight: '700',
        color: '#111827',
        marginBottom: isMobile ? '0.3rem' : '0.4rem',
        letterSpacing: '0.4px',
        lineHeight: '1.3'
      },
      featureDescription: {
        fontSize: isMobile ? '0.7rem' : isTablet ? '0.75rem' : '0.8rem',
        color: '#4a5568',
        marginBottom: isMobile ? '0.5rem' : '0.6rem',
        lineHeight: '1.3',
        flex: '1'
      },
      featureButton: {
        marginTop: 'auto',
        alignSelf: 'center',
        background: '#111827',
        color: 'white',
        border: 'none',
        padding: isMobile ? '8px 18px' : isTablet ? '10px 20px' : '12px 24px',
        borderRadius: '20px',
        cursor: 'pointer',
        fontSize: isMobile ? '0.75rem' : isTablet ? '0.8rem' : '0.9rem',
        fontWeight: '700',
        transition: 'all 0.3s ease',
        boxShadow: '0 3px 12px rgba(0,0,0,0.15)',
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
        width: 'fit-content',
        position: 'relative',
        bottom: '0',
        zIndex: 10
      }
    };
  };

  const styles = getResponsiveStyles();


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
      <Navigationinner title={"DOUBTS"} />
      <div style={styles.container}>
        <h1 style={styles.welcomeText}>Doubts & Learning</h1>
        <p style={styles.welcomeSubtext}>
          Clear your doubts and enhance your knowledge with our interactive learning tools
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

export default Doubts;
