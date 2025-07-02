import { useState, useEffect } from 'react';
import { getSubmissionById } from '../api';

const useSubmissionStatus = (submissionId, interval = 3000) => {
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    if (!submissionId) {
      setLoading(false);
      setError('No submission ID provided.');
      setIsPolling(false);
      return;
    }

    const fetchSubmission = async () => {
      try {
        const response = await getSubmissionById(submissionId);
        const fetchedSubmission = response.data;
        setSubmission(fetchedSubmission);

        // Stop polling if status is final
        const finalStatuses = ['Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Memory Limit Exceeded', 'Runtime Error', 'Compilation Error', 'Internal Error'];
        if (finalStatuses.includes(fetchedSubmission.status)) {
          setIsPolling(false);
        }
      } catch (err) {
        console.error(`Error fetching submission ${submissionId}:`, err);
        setError('Failed to load submission. It might not exist or you lack permissions.');
        setIsPolling(false);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchSubmission();

    // Set up polling
    let intervalId;
    if (isPolling) {
      intervalId = setInterval(fetchSubmission, interval);
    }

    // Cleanup on unmount or if polling stops
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [submissionId, interval, isPolling]);

  return { submission, loading, error, isPolling };
};

export default useSubmissionStatus;