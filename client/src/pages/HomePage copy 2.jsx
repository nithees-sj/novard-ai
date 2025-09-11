import React from 'react';
import { useNavigate } from 'react-router-dom';
import roadmapImage from '../images/roadmap.jpg';
import skillsImage from '../images/skills.jpg';
import projectsImage from '../images/project.avif';
import video from '../images/video.png';
import { Navigationinner } from "../components/navigationinner";
import ChatbotButton from '../components/ChatbotButton';

const features = [
  {
    title: 'CAREER DEVELOPMENT',
    description: 'Access career development tools to build custom roadmaps, discover the skills you need, get project ideas, and create a standout resume—all designed to support your professional growth.',
    imageUrl: roadmapImage,
  },
  {
    title: 'DOUBT RESOLVER',
    description: 'Clear your doubts by uploading PDFs, asking questions, getting notes summarized, taking quizzes, and chatting with a personalized AI assistant.',
    imageUrl: skillsImage,
  },
  {
    title: 'VIDEO SESSIONS',
    description: 'Explore video suggestions tailored to key concepts; ask doubts about any video, get summaries, and take quizzes to reinforce your learning.',
    imageUrl: video,
  },
  {
    title: 'AI FORUM',
    description: 'Join a collaborative forum where users interact to resolve doubts, supported by AI-generated answers alongside community responses for comprehensive help.',
    imageUrl: projectsImage,
  },
];

const HomePage = () => {
  const navigate = useNavigate();

  const handleLearnMore = (featureTitle) => {
    const route = `/${featureTitle.toLowerCase().replace(/\s+/g, '-')}`;
    navigate(route);
  };

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column', // Use column to stack elements naturally
    minHeight: '100vh', // Allow the content to expand if needed
    backgroundColor: '#f7fafc',
    justifyContent: 'flex-start', // Align content to the top
    alignItems: 'center',
    overflowY: 'auto', 
    padding: '30px 1rem 1rem',
    marginTop:'20px'
  },
  featuresContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)', // Exactly two columns for neat fit
    gap: '3rem', // Reduced spacing for better fit
    maxWidth: '1100px', // Increased max width for larger cards
    width: '100%',
  },
  featureCard: {
    backgroundColor: '#fff',
    borderRadius: '12px', // Slightly larger rounded corners
    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.10)', // Deeper shadow for effect
    overflow: 'hidden',
    display: 'flex',
    width:'450px', // Increased width for bigger cards
    height: '390px',  // Increased height for spacing
    flexDirection: 'column',
    textAlign: 'center',
    transition: 'transform 0.3s',
    cursor: 'pointer',
    maxHeight: 'none',
  },
  featureImage: {
    width: '100%',
    height: '180px', // Bigger image area
    objectFit: 'cover',
    maxHeight: 'none',
  },
  featureContent: {
    padding: '2rem', // Roomy but not oversized
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  featureTitle: {
    marginTop: '1rem',
    fontSize: '1.6rem',
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: '0.5rem',
  },
  featureDescription: {
    fontSize: '1.5rem',
    color: '#4a5568',
    marginBottom: '0.8rem',
    flex: 1,
  },
  featureButton: {
    backgroundColor: '#3182ce',
    color: 'white',
    border: 'none',
    padding: '10px 18px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1.5rem',
    margin: '0 auto',
    transition: 'background-color 0.3s',
  },
};

  return (
    <>
      <Navigationinner title={"HOME"} />
      <div style={styles.container}>
        <div style={styles.featuresContainer}>
          {features.map((feature, index) => (
            <div key={index} style={styles.featureCard}>
              <img src={feature.imageUrl} alt={feature.title} style={styles.featureImage} />
              <div style={styles.featureContent}>
                <h2 style={styles.featureTitle}>{feature.title}</h2>
                <p style={styles.featureDescription}>{feature.description}</p>
                <button style={styles.featureButton} onClick={() => handleLearnMore(feature.title)}>
                  Learn More
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
