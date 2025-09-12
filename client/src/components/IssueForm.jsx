import React, { useState } from 'react';

const IssueForm = ({ onSubmit, onCancel, isVisible }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      alert('Please fill in both title and description');
      return;
    }

    setIsSubmitting(true);
    try {
      const userEmail = localStorage.getItem('email') || 'anonymous@example.com';
      const userName = localStorage.getItem('name') || 'Anonymous User';
      
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      await onSubmit({
        ...formData,
        userEmail,
        userName,
        tags: tagsArray
      });

      // Reset form
      setFormData({
        title: '',
        description: '',
        tags: ''
      });
    } catch (error) {
      console.error('Error submitting issue:', error);
      alert('Failed to create issue. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isVisible) return null;

  const styles = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    modal: {
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '2rem',
      width: '90%',
      maxWidth: '600px',
      maxHeight: '80vh',
      overflowY: 'auto',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1.5rem',
    },
    title: {
      fontSize: '2rem', // Further increased from 1.75rem
      fontWeight: 'bold',
      color: '#2d3748',
      margin: 0,
    },
    closeButton: {
      background: 'none',
      border: 'none',
      fontSize: '1.5rem',
      cursor: 'pointer',
      color: '#718096',
      padding: '0.25rem',
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
    },
    inputGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    },
    label: {
      fontWeight: '600',
      color: '#4a5568',
      fontSize: '1.2rem', // Further increased from 1rem
    },
    input: {
      padding: '1.25rem', // Further increased padding
      border: '1px solid #e2e8f0',
      borderRadius: '10px', // Increased border radius
      fontSize: '1.3rem', // Further increased from 1.1rem
      transition: 'border-color 0.2s',
    },
    textarea: {
      padding: '1.25rem', // Further increased padding
      border: '1px solid #e2e8f0',
      borderRadius: '10px', // Increased border radius
      fontSize: '1.3rem', // Further increased from 1.1rem
      minHeight: '180px', // Further increased from 150px
      resize: 'vertical',
      fontFamily: 'inherit',
      transition: 'border-color 0.2s',
    },
    buttonGroup: {
      display: 'flex',
      gap: '1rem',
      justifyContent: 'flex-end',
      marginTop: '1rem',
    },
    button: {
      padding: '1.25rem 2.5rem', // Further increased padding
      borderRadius: '10px', // Increased border radius
      fontSize: '1.3rem', // Further increased from 1.1rem
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s',
      border: 'none',
    },
    submitButton: {
      backgroundColor: '#3182ce',
      color: 'white',
    },
    cancelButton: {
      backgroundColor: '#e2e8f0',
      color: '#4a5568',
    },
    disabledButton: {
      opacity: 0.6,
      cursor: 'not-allowed',
    },
  };

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Create New Issue</h2>
          <button style={styles.closeButton} onClick={onCancel}>
            ×
          </button>
        </div>
        
        <form style={styles.form} onSubmit={handleSubmit}>
          <div style={styles.inputGroup}>
            <label style={styles.label} htmlFor="title">
              Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              style={styles.input}
              placeholder="Enter a descriptive title for your issue"
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label} htmlFor="description">
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              style={styles.textarea}
              placeholder="Describe your issue in detail. Include any relevant information, steps to reproduce, or context that might help others understand and help with your issue."
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label} htmlFor="tags">
              Tags (optional)
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              style={styles.input}
              placeholder="Enter tags separated by commas (e.g., javascript, react, bug)"
            />
          </div>

          <div style={styles.buttonGroup}>
            <button
              type="button"
              onClick={onCancel}
              style={{...styles.button, ...styles.cancelButton}}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                ...styles.button,
                ...styles.submitButton,
                ...(isSubmitting ? styles.disabledButton : {})
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IssueForm;
