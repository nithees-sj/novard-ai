import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigationinner } from "../components/navigationinner";

const TeacherLogin = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (formData.email === 'teacher@gmail.com' && formData.password === 'teacher123') {
      // Store teacher login state
      localStorage.setItem('teacherLoggedIn', 'true');
      localStorage.setItem('teacherEmail', formData.email);
      navigate('/teacher-dashboard');
    } else {
      setError('Invalid email or password');
    }
  };

  const getResponsiveStyles = () => {
    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
    
    return {
      container: {
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: isMobile ? '0.5rem' : isTablet ? '1rem' : '2rem',
        position: 'relative',
        overflow: 'hidden'
      },
      backgroundPattern: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          radial-gradient(circle at 20% 80%, rgba(0, 0, 0, 0.05) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.8) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(0, 0, 0, 0.03) 0%, transparent 50%)
        `,
        zIndex: 1
      },
      loginCard: {
        backgroundColor: '#ffffff',
        backdropFilter: 'blur(20px)',
        borderRadius: isMobile ? '16px' : '20px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        padding: isMobile ? '1.2rem' : isTablet ? '1.5rem' : '1.8rem',
        width: '100%',
        maxWidth: isMobile ? '90%' : isTablet ? '420px' : '480px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 2,
        border: '1px solid rgba(0,0,0,0.08)',
        transition: 'all 0.3s ease'
      },
      loginCardHover: {
        transform: 'translateY(-5px)',
        boxShadow: '0 35px 70px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.1)'
      },
      title: {
        fontSize: isMobile ? '1.6rem' : isTablet ? '1.9rem' : '2.2rem',
        fontWeight: '800',
        color: '#000000',
        marginBottom: isMobile ? '0.4rem' : '0.6rem',
        letterSpacing: '-0.5px'
      },
      subtitle: {
        fontSize: isMobile ? '0.8rem' : isTablet ? '0.9rem' : '1rem',
        color: '#6b7280',
        marginBottom: isMobile ? '1.2rem' : isTablet ? '1.5rem' : '2rem',
        fontWeight: '500',
        lineHeight: '1.4'
      },
      form: {
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '0.8rem' : isTablet ? '1rem' : '1.2rem'
      },
      inputGroup: {
        display: 'flex',
        flexDirection: 'column',
        textAlign: 'left',
        position: 'relative'
      },
      label: {
        fontSize: isMobile ? '0.8rem' : isTablet ? '0.9rem' : '1rem',
        fontWeight: '700',
        color: '#000000',
        marginBottom: isMobile ? '0.4rem' : '0.6rem',
        letterSpacing: '0.3px'
      },
      input: {
        padding: isMobile ? '0.7rem 0.9rem' : isTablet ? '0.8rem 1rem' : '1rem 1.2rem',
        border: '2px solid rgba(0,0,0,0.1)',
        borderRadius: isMobile ? '8px' : '10px',
        fontSize: isMobile ? '0.8rem' : isTablet ? '0.9rem' : '1rem',
        transition: 'all 0.3s ease',
        outline: 'none',
        backgroundColor: '#ffffff',
        fontWeight: '500',
        color: '#000000'
      },
      inputFocus: {
        borderColor: '#000000',
        boxShadow: '0 0 0 4px rgba(0, 0, 0, 0.1)',
        backgroundColor: '#ffffff',
        transform: 'translateY(-2px)'
      },
      button: {
        background: '#000000',
        color: 'white',
        border: 'none',
        padding: isMobile ? '0.7rem 1.2rem' : isTablet ? '0.8rem 1.5rem' : '1rem 2rem',
        borderRadius: isMobile ? '8px' : '10px',
        fontSize: isMobile ? '0.8rem' : isTablet ? '0.9rem' : '1rem',
        fontWeight: '700',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        marginTop: isMobile ? '0.8rem' : isTablet ? '1rem' : '1.2rem',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
        position: 'relative',
        overflow: 'hidden',
        width: '100%'
      },
      buttonHover: {
        transform: 'translateY(-3px)',
        boxShadow: '0 15px 35px rgba(0, 0, 0, 0.3)',
        background: '#333333'
      },
      error: {
        color: '#e53e3e',
        fontSize: isMobile ? '0.9rem' : '1rem',
        marginTop: '0.8rem',
        fontWeight: '600',
        backgroundColor: 'rgba(229, 62, 62, 0.1)',
        padding: isMobile ? '0.6rem 0.8rem' : '0.8rem 1rem',
        borderRadius: '12px',
        border: '1px solid rgba(229, 62, 62, 0.2)'
      },
      backButton: {
        position: 'absolute',
        top: isMobile ? '0.5rem' : isTablet ? '1rem' : '1.5rem',
        left: isMobile ? '0.5rem' : isTablet ? '1rem' : '1.5rem',
        backgroundColor: 'rgba(0,0,0,0.1)',
        backdropFilter: 'blur(10px)',
        color: '#000000',
        border: '1px solid rgba(0,0,0,0.2)',
        padding: isMobile ? '0.5rem 0.8rem' : isTablet ? '0.6rem 1rem' : '0.7rem 1.2rem',
        borderRadius: '20px',
        cursor: 'pointer',
        fontSize: isMobile ? '0.7rem' : isTablet ? '0.8rem' : '0.9rem',
        fontWeight: '700',
        transition: 'all 0.3s ease',
        zIndex: 3,
        textTransform: 'uppercase',
        letterSpacing: '0.4px'
      },
      backButtonHover: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        transform: 'translateY(-2px)',
        boxShadow: '0 8px 25px rgba(0,0,0,0.2)'
      },
      teacherIcon: {
        fontSize: isMobile ? '2.5rem' : isTablet ? '2.8rem' : '3rem',
        marginBottom: '1rem',
        display: 'block',
        color: '#000000'
      },
      floatingElements: {
        position: 'absolute',
        top: '10%',
        right: isMobile ? '5%' : '10%',
        width: isMobile ? '60px' : '100px',
        height: isMobile ? '60px' : '100px',
        background: 'rgba(0,0,0,0.05)',
        borderRadius: '50%',
        animation: 'float 6s ease-in-out infinite',
        zIndex: 1
      },
      floatingElements2: {
        position: 'absolute',
        bottom: '20%',
        left: isMobile ? '5%' : '15%',
        width: isMobile ? '40px' : '60px',
        height: isMobile ? '40px' : '60px',
        background: 'rgba(0,0,0,0.03)',
        borderRadius: '50%',
        animation: 'float 4s ease-in-out infinite reverse',
        zIndex: 1
      }
    };
  };

  const styles = getResponsiveStyles();

  return (
    <>
      <Navigationinner title={"TEACHER LOGIN"} />
      <div style={styles.container}>
        {/* Background Pattern */}
        <div style={styles.backgroundPattern}></div>
        
        {/* Floating Elements */}
        <div style={styles.floatingElements}></div>
        <div style={styles.floatingElements2}></div>
        
        <button 
          style={styles.backButton}
          onClick={() => navigate('/home')}
          onMouseEnter={(e) => {
            Object.assign(e.currentTarget.style, styles.backButtonHover);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          ← Back to Home
        </button>
        
        <div 
          style={styles.loginCard}
          onMouseEnter={(e) => {
            Object.assign(e.currentTarget.style, styles.loginCardHover);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 25px 50px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.2)';
          }}
        >
          <span style={styles.teacherIcon}>👨‍🏫</span>
          <h1 style={styles.title}>Teacher Login</h1>
          <p style={styles.subtitle}>Access your teaching dashboard and manage your educational content</p>
          
          <form style={styles.form} onSubmit={handleSubmit}>
            <div style={styles.inputGroup}>
              <label style={styles.label} htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                style={styles.input}
                placeholder="teacher@example.com"
                required
                onFocus={(e) => {
                  Object.assign(e.currentTarget.style, styles.inputFocus);
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.8)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              />
            </div>
            
            <div style={styles.inputGroup}>
              <label style={styles.label} htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                style={styles.input}
                placeholder="Enter your password"
                required
                onFocus={(e) => {
                  Object.assign(e.currentTarget.style, styles.inputFocus);
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.8)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              />
            </div>
            
            {error && <div style={styles.error}>{error}</div>}
            
            <button 
              type="submit" 
              style={styles.button}
              onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, styles.buttonHover);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.4)';
                e.currentTarget.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
              }}
            >
              Login as Teacher
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default TeacherLogin;
