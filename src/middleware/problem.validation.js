const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: 'Validation error',
      errors: errors.array()
    });
  }
  next();
};

const validateCreateProblem = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('description')
    .isLength({ min: 10 })
    .withMessage('Description must be at least 10 characters'),
  body('difficulty')
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be easy, medium, or hard'),
  body('timeLimit')
    .isInt({ min: 100, max: 60000 })
    .withMessage('Time limit must be between 100ms and 60000ms'),
  body('memoryLimit')
    .isInt({ min: 16, max: 1024 })
    .withMessage('Memory limit must be between 16MB and 1024MB'),
  body('testCases')
    .isArray({ min: 1 })
    .withMessage('At least one test case is required'),
  body('testCases.*.input')
    .isString()
    .withMessage('Test case input must be a string'),
  body('testCases.*.output')
    .isString()
    .withMessage('Test case output must be a string'),
  handleValidationErrors,
];

const validateUpdateProblem = [
  param('id')
    .isMongoId()
    .withMessage('Invalid problem ID'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('description')
    .optional()
    .isLength({ min: 10 })
    .withMessage('Description must be at least 10 characters'),
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be easy, medium, or hard'),
  body('timeLimit')
    .optional()
    .isInt({ min: 100, max: 60000 })
    .withMessage('Time limit must be between 100ms and 60000ms'),
  body('memoryLimit')
    .optional()
    .isInt({ min: 16, max: 1024 })
    .withMessage('Memory limit must be between 16MB and 1024MB'),
  body('testCases')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one test case is required'),
  body('testCases.*.input')
    .optional()
    .isString()
    .withMessage('Test case input must be a string'),
  body('testCases.*.output')
    .optional()
    .isString()
    .withMessage('Test case output must be a string'),
  handleValidationErrors,
];

const validateBulkDelete = [
  body('problemIds')
    .isArray({ min: 1, max: 50 })
    .withMessage('problemIds must be an array with 1-50 items'),
  body('problemIds.*')
    .isMongoId()
    .withMessage('Each problem ID must be a valid MongoDB ObjectId'),
  handleValidationErrors,
];

const validateGetProblems = [
  query('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be easy, medium, or hard'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters'),
  handleValidationErrors,
];

const validateProblemId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid problem ID'),
  handleValidationErrors,
];

module.exports = {
  validateCreateProblem,
  validateUpdateProblem,
  validateBulkDelete,
  validateGetProblems,
  validateProblemId,
};