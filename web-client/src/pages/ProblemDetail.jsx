import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProblemById, submitCode } from '../api';

const ProblemDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('cpp'); // Default language
  const [submissionStatus, setSubmissionStatus] = useState(null);

  useEffect(() => {
    const fetchProblem = async () => {
      try {
        const response = await getProblemById(id);
        setProblem(response.data);
      } catch (err) {
        console.error('Error fetching problem:', err);
        setError('Failed to load problem. Please check the ID.');
      } finally {
        setLoading(false);
      }
    };

    fetchProblem();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmissionStatus(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please login to submit code.');
        navigate('/login');
        return;
      }

      const response = await submitCode({
        problemId: id,
        code,
        language,
      });
      setSubmissionStatus('Submission successful! Redirecting...');
      // Redirect to submission detail page
      navigate(`/submissions/${response.data.submissionId}`);
    } catch (err) {
      console.error('Error submitting code:', err);
      if (err.response && err.response.data && err.response.data.message) {
        setSubmissionStatus(`Submission failed: ${err.response.data.message}`);
      } else {
        setSubmissionStatus('Submission failed. Please try again.');
      }
    }
  };

  if (loading) {
    return <div style={styles.container}>Loading problem details...</div>;
  }

  if (error) {
    return <div style={{ ...styles.container, color: 'red' }}>{error}</div>;
  }

  if (!problem) {
    return <div style={styles.container}>Problem not found.</div>;
  }

  return (
    <div style={styles.container}>
      <h1>{problem.title}</h1>
      <p style={styles.description}>{problem.description}</p>
      <div style={styles.details}>
        <span>Difficulty: {problem.difficulty}</span> |
        <span> Time Limit: {problem.timeLimit}s</span> |
        <span> Memory Limit: {problem.memoryLimit}MB</span>
      </div>

      <h2 style={{ marginTop: '30px' }}>Submit Your Code</h2>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formGroup}>
          <label htmlFor="language">Language:</label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={styles.select}
          >
            <option value="cpp">C++</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            {/* Add more languages as supported by your Judge System */}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label htmlFor="code">Code:</label>
          <textarea
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows="20"
            style={styles.textarea}
            placeholder="Write your code here..."
          ></textarea>
        </div>
        <button type="submit" style={styles.submitButton}>Submit Code</button>
        {submissionStatus && <p style={styles.statusMessage}>{submissionStatus}</p>}
      </form>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    maxWidth: '900px',
    margin: '20px auto',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  description: {
    fontSize: '1.1em',
    lineHeight: '1.6',
    marginBottom: '20px',
  },
  details: {
    fontSize: '0.9em',
    color: '#555',
    marginBottom: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    marginBottom: '5px',
    fontWeight: 'bold',
  },
  select: {
    padding: '10px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '1em',
  },
  textarea: {
    padding: '10px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '0.9em',
    fontFamily: 'monospace',
  },
  submitButton: {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '1em',
    fontWeight: 'bold',
    transition: 'background-color 0.3s ease',
  },
  statusMessage: {
    marginTop: '10px',
    padding: '10px',
    borderRadius: '5px',
    backgroundColor: '#e9ecef',
    color: '#333',
    textAlign: 'center',
  },
};

export default ProblemDetail;