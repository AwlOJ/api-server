import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProblems } from '../api';

const ProblemList = () => {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProblems = async () => {
      try {
        const response = await getProblems();
        setProblems(response.data);
      } catch (err) {
        console.error('Error fetching problems:', err);
        setError('Failed to load problems. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchProblems();
  }, []);

  if (loading) {
    return <div style={styles.container}>Loading problems...</div>;
  }

  if (error) {
    return <div style={{ ...styles.container, color: 'red' }}>{error}</div>;
  }

  return (
    <div style={styles.container}>
      <h1>Available Problems</h1>
      <ul style={styles.problemList}>
        {problems.map((problem) => (
          <li key={problem._id} style={styles.problemItem}>
            <Link to={`/problems/${problem._id}`} style={styles.problemLink}>
              <h3>{problem.title}</h3>
              <p>Difficulty: {problem.difficulty}</p>
              <p>Time Limit: {problem.timeLimit}s | Memory Limit: {problem.memoryLimit}MB</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    maxWidth: '800px',
    margin: '20px auto',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  problemList: {
    listStyle: 'none',
    padding: 0,
  },
  problemItem: {
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '5px',
    marginBottom: '10px',
    padding: '15px',
    transition: 'transform 0.2s ease-in-out',
  },
  problemLink: {
    textDecoration: 'none',
    color: '#333',
    display: 'block',
  },
};

export default ProblemList;