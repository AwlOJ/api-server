const { body, param, validationResult } = require('express-validator');
const Contest = require('../models/Contest');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

const validateContest = [
  body('title')
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('description')
    .isLength({ min: 10, max: 10000 })
    .withMessage('Description must be between 10 and 10000 characters'),
  body('startTime')
    .isISO8601()
    .withMessage('Invalid start time format')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Start time must be in the future');
      }
      return true;
    }),
  body('endTime')
    .isISO8601()
    .withMessage('Invalid end time format')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.startTime)) {
        throw new Error('End time must be after start time');
      }
      return true;
    }),
  body('problems')
    .isArray({ min: 1 })
    .withMessage('At least one problem is required'),
  body('problems.*.problemId')
    .isMongoId()
    .withMessage('Invalid problem ID'),
  body('problems.*.label')
    .matches(/^[A-Z]$/)
    .withMessage('Problem label must be a single uppercase letter'),
  body('type')
    .isIn(['public', 'private', 'rated'])
    .withMessage('Invalid contest type'),
  body('scoringSystem')
    .isIn(['ICPC', 'IOI', 'AtCoder'])
    .withMessage('Invalid scoring system'),
  handleValidationErrors
];

const validateContestSubmission = [
  param('id')
    .isMongoId()
    .withMessage('Invalid contest ID'),
  body('problemLabel')
    .matches(/^[A-Z]$/)
    .withMessage('Invalid problem label'),
  body('code')
    .isLength({ min: 1, max: 50000 })
    .withMessage('Code must be between 1 and 50000 characters'),
  body('language')
    .isIn(['cpp', 'java', 'python', 'javascript', 'go', 'rust'])
    .withMessage('Invalid programming language'),
  handleValidationErrors
];

module.exports = {
  validateContest,
  validateContestSubmission
};