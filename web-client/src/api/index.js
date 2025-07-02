import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['x-auth-token'] = token; // Use x-auth-token as per backend
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth calls
export const registerUser = (userData) => api.post('/auth/signup', userData);
export const loginUser = (credentials) => api.post('/auth/login', credentials);

// Problem calls
export const getProblems = () => api.get('/problems');
export const getProblemById = (id) => api.get(`/problems/${id}`);
export const createProblem = (problemData) => api.post('/problems', problemData);

// Submission calls
export const submitCode = (submissionData) => api.post('/submissions', submissionData);
export const getSubmissionById = (id) => api.get(`/submissions/${id}`);
export const getUserSubmissions = () => api.get('/submissions/user-submissions');