import React from 'react';
import { useNavigate } from 'react-router-dom';
import roadmapImage from '../images/roadmap.jpg';
import skillsImage from '../images/skills.jpg';
import projectsImage from '../images/project.avif';
import resumeImage from '../images/resume.avif';
import { Navigationinner } from "../components/navigationinner";
import ChatbotButton from '../components/ChatbotButton';

const features = [
  {
    title: 'ROADMAP',
    description: 'Navigate your career with a customized roadmap, detailing milestones and actionable strategies for success.',
    imageUrl: roadmapImage,
    route: '/roadmap',
    icon: '🗺️'
  },
  {
    title: 'SKILLS REQUIRED',
    description: 'Get personalized insights on essential skills to improve your qualifications and job prospects.',
    imageUrl: skillsImage,
    route: '/skills-required',
    icon: '💪'
  },
  {
    title: 'PROJECT IDEAS',
    description: 'Find project ideas that resonate with your career ambitions and help you develop expertise in your chosen field.',
    imageUrl: projectsImage,
    route: '/project-ideas',
    icon: '💡'
  },
  {
    title: 'RESUME BUILD',
    description: 'Design professional resumes that reflect your unique qualifications and help you stand out in the current job market.',
    imageUrl: resumeImage,
    route: '/resume-build',
    icon: '📄'
  },
];

const Career = () => {
  const navigate = useNavigate();

  const handleLearnMore = (feature) => {
    navigate(feature.route);
  };

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    background: '#ffffff',
    justifyContent: 'flex-start',
    alignItems: 'center',
    overflowY: 'auto',
    padding: '24px 2.5rem 3rem'
  },
  welcomeText: {
    color: '#111827',
    fontSize: '3.2rem',
    fontWeight: 'bold',
    marginBottom: '1.5rem',
    textAlign: 'center',
    textShadow: 'none'
  },
  welcomeSubtext: {
    color: '#374151',
    fontSize: '1.45rem',
    marginBottom: '3.5rem',
    textAlign: 'center',
    maxWidth: '680px'
  },
  featuresContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '2.5rem',
    maxWidth: '800px',
    width: '100%',
    justifyContent: 'center',
    margin: '0 auto',
    padding: '0 2rem'
  },
  featureCard: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: '20px',
    boxShadow: '0 8px 28px rgba(0,0,0,0.08)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    textAlign: 'center',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    backdropFilter: 'blur(11px)',
    border: '1px solid rgba(0,0,0,0.05)',
    position: 'relative',
    width: '100%',
    minHeight: '320px',
    maxWidth: '320px',
    padding: 0
  },
  featureCardHover: {
    boxShadow: '0 20px 48px rgba(0,0,0,0.16)',
    transform: 'translateY(-6px)',
    border: '1.5px solid rgba(0,0,0,0.22)'
  },
  featureImage: {
    width: '100%',
    height: '160px',
    objectFit: 'cover',
    transition: 'transform 0.3s ease'
  },
  featureImageHover: {
    transform: 'scale(1.04)'
  },
  featureContent: {
    padding: '1.2rem 1rem 1rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
    minHeight: 0
  },
  featureIcon: {
    fontSize: '2rem',
    marginBottom: '0.5rem',
    display: 'block'
  },
  featureTitle: {
    fontSize: '1.2rem',
    fontWeight: '700',
    color: '#111827',
    marginBottom: '0.5rem',
    letterSpacing: '0.3px'
  },
  featureDescription: {
    fontSize: '0.95rem',
    color: '#374151',
    marginBottom: '0',
    lineHeight: '1.5',
    flex: '1'
  },
  featureButton: {
    marginTop: '1rem',
    alignSelf: 'center',
    background: '#111827',
    color: 'white',
    border: 'none',
    padding: '10px 24px',
    borderRadius: '25px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: '700',
    transition: 'all 0.3s ease',
    boxShadow: '0 3px 12px rgba(0,0,0,0.08)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    width: 'fit-content',
    position: 'relative',
    bottom: 0
  },
  featureButtonHover: {
    background: '#22262a',
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.13)'
  }
};


  return (
    <>
      <Navigationinner title={"CAREER"} />
      <div style={styles.container}>
        <h1 style={styles.welcomeText}>Career Development Tools</h1>
        <p style={styles.welcomeSubtext}>
          Explore our comprehensive suite of career development resources
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

export default Career;
