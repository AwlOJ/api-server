const express = require('express');
const { submitCode, getSubmissionById, getSubmissionsByUserId } = require('../controllers/submission.controller');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Authenticated route to submit code
router.post('/', auth, submitCode);

// Authenticated route to get a single submission by ID
router.get('/:id', auth, getSubmissionById);

// Authenticated route to get all submissions by the logged-in user
router.get('/user-submissions', auth, getSubmissionsByUserId);

module.exports = router;