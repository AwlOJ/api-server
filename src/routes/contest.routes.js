const express = require('express');
const router = express.Router();
const {
  getContests,
  getContest,
  createContest,
  registerForContest,
  getStandings,
  submitToContest,
  publishContest,
  getUserSubmissionsInContest
} = require('../controllers/contest.controller');
const { auth, authorize } = require('../middleware/auth');
const { validateContest, validateContestSubmission } = require('../middleware/contest.validation');

// Public routes
router.get('/', getContests);
router.get('/:id', auth, getContest); // Added auth here to check registration status
router.get('/:id/standings', getStandings);
router.get('/:id/submissions', auth, getUserSubmissionsInContest); // New route

// Authenticated routes
router.post('/:id/register', auth, registerForContest);
router.post('/:id/submit', auth, validateContestSubmission, submitToContest);
router.post('/:id/publish', auth, authorize(['admin']), publishContest);

// Admin routes
router.post('/', auth, authorize(['admin']), validateContest, createContest);

module.exports = router;