import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getUserSubmissions } from '../api';

const MySubmissions = () => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const response = await getUserSubmissions();
        setSubmissions(response.data);
      } catch (err) {
        console.error('Error fetching user submissions:', err);
        setError('Failed to load your submissions. Please ensure you are logged in.');
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, []);

  if (loading) {
    return <div style={styles.container}>Loading your submissions...</div>;
  }

  if (error) {
    return <div style={{ ...styles.container, color: 'red' }}>{error}</div>;
  }

  if (submissions.length === 0) {
    return <div style={styles.container}>You have not made any submissions yet.</div>;
  }

  return (
    <div style={styles.container}>
      <h1>My Submissions</h1>
      <ul style={styles.submissionList}>
        {submissions.map((submission) => (
          <li key={submission._id} style={styles.submissionItem}>
            <Link to={`/submissions/${submission._id}`} style={styles.submissionLink}>
              <h3>Problem: {submission.problemId ? submission.problemId.title : 'N/A'}</h3>
              <p>Language: {submission.language}</p>
              <p>Status: <span style={{ color: getStatusColor(submission.status), fontWeight: 'bold' }}>{submission.status}</span></p>
              <p>Submitted At: {new Date(submission.createdAt).toLocaleString()}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

const getStatusColor = (status) => {
  switch (status) {
    case 'Accepted': return 'green';
    case 'Wrong Answer': return 'red';
    case 'Time Limit Exceeded': return 'orange';
    case 'Memory Limit Exceeded': return 'orange';
    case 'Compilation Error': return 'purple';
    case 'Runtime Error': return 'darkred';
    case 'Pending': return 'gray';
    case 'In Queue': return 'gray';
    case 'Judging': return 'blue';
    default: return 'black';
  }
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
  submissionList: {
    listStyle: 'none',
    padding: 0,
  },
  submissionItem: {
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '5px',
    marginBottom: '10px',
    padding: '15px',
    transition: 'transform 0.2s ease-in-out',
  },
  submissionLink: {
    textDecoration: 'none',
    color: '#333',
    display: 'block',
  },
};

export default MySubmissions;