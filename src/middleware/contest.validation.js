const { body, param, query, validationResult } = require('express-validator');
const Contest = require('../models/Contest');
const Problem = require('../models/Problem');
const mongoose = require('mongoose');

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

// ✅ Enhanced contest creation validation
const validateContest = [
  body('title')
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters')
    .trim()
    .escape(),
  
  body('description')
    .isLength({ min: 10, max: 10000 })
    .withMessage('Description must be between 10 and 10000 characters')
    .trim(),
  
  body('startTime')
    .isISO8601()
    .withMessage('Invalid start time format')
    .custom((value) => {
      const startDate = new Date(value);
      const now = new Date();
      const minFutureTime = new Date(now.getTime() + 5 * 60 * 1000); // At least 5 minutes in future
      
      if (startDate <= minFutureTime) {
        throw new Error('Start time must be at least 5 minutes in the future');
      }
      return true;
    }),
  
  body('endTime')
    .isISO8601()
    .withMessage('Invalid end time format')
    .custom((value, { req }) => {
      const startDate = new Date(req.body.startTime);
      const endDate = new Date(value);
      const minDuration = 30 * 60 * 1000; // 30 minutes
      const maxDuration = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      if (endDate <= startDate) {
        throw new Error('End time must be after start time');
      }
      
      const duration = endDate - startDate;
      if (duration < minDuration) {
        throw new Error('Contest must be at least 30 minutes long');
      }
      
      if (duration > maxDuration) {
        throw new Error('Contest cannot be longer than 7 days');
      }
      
      return true;
    }),
  
  body('registrationDeadline')
    .optional()
    .isISO8601()
    .withMessage('Invalid registration deadline format')
    .custom((value, { req }) => {
      if (value) {
        const regDeadline = new Date(value);
        const startDate = new Date(req.body.startTime);
        const now = new Date();
        
        if (regDeadline <= now) {
          throw new Error('Registration deadline must be in the future');
        }
        
        if (regDeadline > startDate) {
          throw new Error('Registration deadline cannot be after contest start');
        }
      }
      return true;
    }),
  
  body('problems')
    .isArray({ min: 1, max: 20 })
    .withMessage('Contest must have between 1 and 20 problems'),
  
  body('problems.*.problemId')
    .isMongoId()
    .withMessage('Invalid problem ID')
    .custom(async (value, { req }) => {
      // Check if all problems exist
      const problemIds = req.body.problems.map(p => p.problemId);
      const existingProblems = await Problem.find({ _id: { $in: problemIds } });
      
      if (existingProblems.length !== problemIds.length) {
        throw new Error('One or more problems do not exist');
      }
      return true;
    }),
  
  body('problems.*.label')
    .matches(/^[A-Z]$/)
    .withMessage('Problem label must be a single uppercase letter (A-Z)')
    .custom((value, { req }) => {
      // Check for duplicate labels
      const labels = req.body.problems.map(p => p.label);
      const uniqueLabels = [...new Set(labels)];
      
      if (labels.length !== uniqueLabels.length) {
        throw new Error('Problem labels must be unique within the contest');
      }
      return true;
    }),
  
  body('problems.*.points')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Points must be between 1 and 1000'),
  
  body('type')
    .isIn(['public', 'private', 'rated'])
    .withMessage('Contest type must be public, private, or rated'),
  
  body('scoringSystem')
    .isIn(['ICPC', 'IOI', 'AtCoder'])
    .withMessage('Scoring system must be ICPC, IOI, or AtCoder'),
  
  body('allowedLanguages')
    .optional()
    .isArray()
    .withMessage('Allowed languages must be an array')
    .custom((languages) => {
      const validLanguages = ['cpp', 'java', 'python', 'javascript', 'go', 'rust'];
      const invalidLanguages = languages.filter(lang => !validLanguages.includes(lang));
      
      if (invalidLanguages.length > 0) {
        throw new Error(`Invalid languages: ${invalidLanguages.join(', ')}`);
      }
      return true;
    }),
  
  body('maxSubmissions')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Max submissions must be between 0 and 100 (0 = unlimited)'),
  
  body('freezeTime')
    .optional()
    .isInt({ min: 0, max: 300 })
    .withMessage('Freeze time must be between 0 and 300 minutes'),
  
  body('isRated')
    .optional()
    .isBoolean()
    .withMessage('isRated must be a boolean'),
  
  body('password')
    .optional()
    .isLength({ min: 6, max: 50 })
    .withMessage('Password must be between 6 and 50 characters')
    .custom((value, { req }) => {
      if (req.body.type === 'private' && !value) {
        throw new Error('Password is required for private contests');
      }
      return true;
    }),
  
  body('settings.showOthersCode')
    .optional()
    .isBoolean()
    .withMessage('showOthersCode must be a boolean'),
  
  body('settings.allowClarifications')
    .optional()
    .isBoolean()
    .withMessage('allowClarifications must be a boolean'),
  
  body('settings.penaltyPerWrongSubmission')
    .optional()
    .isInt({ min: 0, max: 120 })
    .withMessage('Penalty per wrong submission must be between 0 and 120 minutes'),
  
  handleValidationErrors,
];

// ✅ Contest submission validation
const validateContestSubmission = [
  param('id')
    .isMongoId()
    .withMessage('Invalid contest ID')
    .custom(async (contestId, { req }) => {
      const contest = await Contest.findById(contestId);
      if (!contest) {
        throw new Error('Contest not found');
      }
      
      if (!contest.isVisible || !contest.isPublished) {
        throw new Error('Contest not available');
      }
      
      // Check if user is registered
      const userId = req.user?.userId;
      if (userId && !contest.isParticipant(userId)) {
        throw new Error('You are not registered for this contest');
      }
      
      return true;
    }),
  
  body('problemLabel')
    .matches(/^[A-Z]$/)
    .withMessage('Invalid problem label')
    .custom(async (label, { req }) => {
      const contestId = req.params.id;
      const contest = await Contest.findById(contestId);
      
      if (!contest.problems.some(p => p.label === label)) {
        throw new Error('Problem not found in this contest');
      }
      return true;
    }),
  
  body('code')
    .isLength({ min: 1, max: 100000 })
    .withMessage('Code must be between 1 and 100,000 characters')
    .trim(),
  
  body('language')
    .isIn(['cpp', 'java', 'python', 'javascript', 'go', 'rust'])
    .withMessage('Invalid programming language')
    .custom(async (language, { req }) => {
      const contestId = req.params.id;
      const contest = await Contest.findById(contestId);
      
      if (contest.allowedLanguages.length > 0 && !contest.allowedLanguages.includes(language)) {
        throw new Error(`Language ${language} is not allowed in this contest`);
      }
      return true;
    }),
  
  handleValidationErrors,
];

// ✅ Contest registration validation
const validateContestRegistration = [
  param('id')
    .isMongoId()
    .withMessage('Invalid contest ID'),
  
  body('password')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Password cannot be empty if provided'),
  
  handleValidationErrors,
];

// ✅ Contest query validation
const validateContestQuery = [
  query('status')
    .optional()
    .isIn(['all', 'upcoming', 'running', 'ended', 'registering'])
    .withMessage('Invalid status filter'),
  
  query('type')
    .optional()
    .isIn(['all', 'public', 'private', 'rated'])
    .withMessage('Invalid type filter'),
  
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be between 1 and 1000'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors,
];

// ✅ Standings query validation
const validateStandingsQuery = [
  param('id')
    .isMongoId()
    .withMessage('Invalid contest ID'),
  
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be between 1 and 1000'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('Limit must be between 1 and 200'),
  
  handleValidationErrors,
];

// ✅ Contest update validation (for editors)
const validateContestUpdate = [
  param('id')
    .isMongoId()
    .withMessage('Invalid contest ID')
    .custom(async (contestId, { req }) => {
      const contest = await Contest.findById(contestId);
      if (!contest) {
        throw new Error('Contest not found');
      }
      
      // Check if user can edit
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      
      if (contest.createdBy.toString() !== userId && !['admin', 'moderator'].includes(userRole)) {
        throw new Error('Not authorized to edit this contest');
      }
      
      // Check if contest has started
      if (new Date() >= contest.startTime && !['admin'].includes(userRole)) {
        throw new Error('Cannot edit contest after it has started');
      }
      
      return true;
    }),
  
  body('title')
    .optional()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters')
    .trim()
    .escape(),
  
  body('description')
    .optional()
    .isLength({ min: 10, max: 10000 })
    .withMessage('Description must be between 10 and 10000 characters')
    .trim(),
  
  // Add other optional update fields...
  
  handleValidationErrors,
];

// ✅ Contest deletion validation
const validateContestDeletion = [
  param('id')
    .isMongoId()
    .withMessage('Invalid contest ID')
    .custom(async (contestId, { req }) => {
      const contest = await Contest.findById(contestId);
      if (!contest) {
        throw new Error('Contest not found');
      }
      
      // Check authorization
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      
      if (contest.createdBy.toString() !== userId && userRole !== 'admin') {
        throw new Error('Not authorized to delete this contest');
      }
      
      // Check if contest has submissions
      const ContestSubmission = require('../models/ContestSubmission');
      const submissionCount = await ContestSubmission.countDocuments({ contest: contestId });
      
      if (submissionCount > 0 && userRole !== 'admin') {
        throw new Error('Cannot delete contest with existing submissions');
      }
      
      return true;
    }),
  
  handleValidationErrors,
];

module.exports = {
  validateContest,
  validateContestSubmission,
  validateContestRegistration,
  validateContestQuery,
  validateStandingsQuery,
  validateContestUpdate,
  validateContestDeletion,
  handleValidationErrors
};