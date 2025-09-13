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

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '2rem'
    },
    loginCard: {
      backgroundColor: 'white',
      borderRadius: '20px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
      padding: '3rem',
      width: '100%',
      maxWidth: '400px',
      textAlign: 'center'
    },
    title: {
      fontSize: '2.5rem',
      fontWeight: 'bold',
      color: '#333',
      marginBottom: '0.5rem'
    },
    subtitle: {
      fontSize: '1.1rem',
      color: '#666',
      marginBottom: '2rem'
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem'
    },
    inputGroup: {
      display: 'flex',
      flexDirection: 'column',
      textAlign: 'left'
    },
    label: {
      fontSize: '1rem',
      fontWeight: '600',
      color: '#333',
      marginBottom: '0.5rem'
    },
    input: {
      padding: '1rem',
      border: '2px solid #e1e5e9',
      borderRadius: '10px',
      fontSize: '1rem',
      transition: 'border-color 0.3s ease',
      outline: 'none'
    },
    inputFocus: {
      borderColor: '#667eea'
    },
    button: {
      backgroundColor: '#667eea',
      color: 'white',
      border: 'none',
      padding: '1rem 2rem',
      borderRadius: '10px',
      fontSize: '1.1rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'background-color 0.3s ease',
      marginTop: '1rem'
    },
    error: {
      color: '#e74c3c',
      fontSize: '0.9rem',
      marginTop: '0.5rem'
    },
    backButton: {
      position: 'absolute',
      top: '2rem',
      left: '2rem',
      backgroundColor: 'rgba(255,255,255,0.2)',
      color: 'white',
      border: 'none',
      padding: '0.8rem 1.5rem',
      borderRadius: '25px',
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: '600',
      transition: 'background-color 0.3s ease'
    }
  };

  return (
    <>
      <Navigationinner title={"TEACHER LOGIN"} />
      <div style={styles.container}>
        <button 
          style={styles.backButton}
          onClick={() => navigate('/video')}
        >
          ← Back to Video
        </button>
        
        <div style={styles.loginCard}>
          <h1 style={styles.title}>Teacher Login</h1>
          <p style={styles.subtitle}>Access your teaching dashboard</p>
          
          <form style={styles.form} onSubmit={handleSubmit}>
            <div style={styles.inputGroup}>
              <label style={styles.label} htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                style={styles.input}
                placeholder="Enter your email"
                required
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
              />
            </div>
            
            {error && <div style={styles.error}>{error}</div>}
            
            <button type="submit" style={styles.button}>
              Login as Teacher
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default TeacherLogin;
