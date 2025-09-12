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
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    background: '#fff', // Pure white for a clean background
    justifyContent: 'flex-start',
    alignItems: 'center',
    overflowY: 'auto',
    padding: '24px 2rem 3rem',
  },
  welcomeText: {
    color: '#111827', // Deep black
    fontSize: '3rem',
    fontWeight: 'bold',
    marginBottom: '1.5rem',
    textAlign: 'center',
    textShadow: 'none'
  },
  welcomeSubtext: {
    color: '#374151', // Subtle dark gray
    fontSize: '1.4rem',
    marginBottom: '3rem',
    textAlign: 'center',
    maxWidth: '650px'
  },
  featuresContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '3rem',
    flexWrap: 'wrap',
    maxWidth: '1000px',
    width: '100%',
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
    textAlign: 'center',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    backdropFilter: 'blur(10px)',
    border: '1.5px solid rgba(0,0,0,0.06)',
    position: 'relative',
    width: '100%',
    height: '370px',
    maxWidth: '350px',
    minWidth: '320px'
  },
  featureImage: {
    width: '100%',
    height: '180px',
    objectFit: 'cover',
    transition: 'transform 0.3s ease'
  },
  featureContent: {
    padding: '1.5rem 1rem 1.25rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: '1',
    justifyContent: 'flex-start',
    minHeight: 0
  },
  featureIcon: {
    fontSize: '2.3rem',
    marginBottom: '0.85rem',
    display: 'block'
  },
  featureTitle: {
    fontSize: '1.24rem',
    fontWeight: '700',
    color: '#111827',
    marginBottom: '0.7rem',
    letterSpacing: '0.4px',
    lineHeight: '1.3'
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
    color: 'white',
    border: 'none',
    padding: '12px 26px',
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
