const express = require('express');
const { createProblem, getProblems, getProblemById } = require('../controllers/problem.controller');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Admin only route to create a problem
router.post('/', auth, authorize(['admin']), createProblem);

// Public route to get all problems
router.get('/', getProblems);

// Public route to get a single problem by ID
router.get('/:id', getProblemById);

module.exports = router;