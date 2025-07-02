import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import useSubmissionStatus from '../hooks/useSubmissionStatus';

const SubmissionDetail = () => {
  const { id } = useParams();
  const { submission, loading, error } = useSubmissionStatus(id);

  if (loading) {
    return <div style={styles.container}>Loading submission details...</div>;
  }

  if (error) {
    return <div style={{ ...styles.container, color: 'red' }}>{error}</div>;
  }

  if (!submission) {
    return <div style={styles.container}>Submission not found.</div>;
  }

  return (
    <div style={styles.container}>
      <h1>Submission Details #{submission._id}</h1>
      <p><strong>Problem:</strong> {submission.problemId ? submission.problemId.title : 'N/A'}</p>
      <p><strong>User:</strong> {submission.userId ? submission.userId.username : 'N/A'}</p>
      <p><strong>Language:</strong> {submission.language}</p>
      <p><strong>Status:</strong> <span style={{ color: getStatusColor(submission.status), fontWeight: 'bold' }}>{submission.status}</span></p>

      {submission.status === 'Accepted' && (
        <>
          <p><strong>Execution Time:</strong> {submission.executionTime}ms</p>
          <p><strong>Memory Used:</strong> {submission.memoryUsed}MB</p>
        </>
      )}

      {(submission.status === 'Wrong Answer' || submission.status === 'Time Limit Exceeded' || submission.status === 'Runtime Error' || submission.status === 'Compilation Error') && (
        <p><strong>Message:</strong> {submission.message || 'No additional details provided.'}</p>
      )}

      <h2>Your Code</h2>
      <pre style={styles.codeBlock}>{submission.code}</pre>
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
    maxWidth: '900px',
    margin: '20px auto',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  codeBlock: {
    backgroundColor: '#eef',
    border: '1px solid #ddd',
    padding: '15px',
    borderRadius: '5px',
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    fontFamily: 'monospace',
    fontSize: '0.9em',
  },
};

export default SubmissionDetail;