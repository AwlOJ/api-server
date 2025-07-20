const express = require('express');
const { 
  createProblem, 
  getProblems, 
  getProblemById,
  updateProblem,
  deleteProblem,
  getProblemStats,
  bulkDeleteProblems
} = require('../controllers/problem.controller');
const { auth, authorize } = require('../middleware/auth');
const {
  validateCreateProblem,
  validateUpdateProblem,
  validateBulkDelete,
  validateGetProblems,
  validateProblemId
} = require('../middleware/problem.validation');

const router = express.Router();

// Stats route (before /:id to avoid conflicts)
router.get('/stats', auth, authorize(['admin']), getProblemStats);

// Bulk delete route (before /:id to avoid conflicts)
router.delete('/bulk', auth, authorize(['admin']), validateBulkDelete, bulkDeleteProblems);

// Admin only route to create a problem
// router.post('/', auth, authorize(['admin']), validateCreateProblem, createProblem);
router.post('/', auth, validateCreateProblem, createProblem);
router.get('/', validateGetProblems, getProblems);
router.get('/:id', validateProblemId, getProblemById);
router.put('/:id', auth, authorize(['admin']), validateUpdateProblem, updateProblem);
router.delete('/:id', auth, authorize(['admin']), validateProblemId, deleteProblem);

module.exports = router;