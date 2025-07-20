const { body, param, query, validationResult } = require('express-validator');
const Contest = require('../models/Contest');
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

// --- REFACTORED ---
// This middleware now only performs basic format and presence checks.
// It trusts the Model and Controller to handle the detailed business logic validation.
// This ELIMINATES LOGIC DUPLICATION.
const validateContest = [
  body('title').notEmpty().withMessage('Title is required').trim().escape(),
  body('description').notEmpty().withMessage('Description is required').trim(),
  body('startTime').isISO8601().withMessage('Invalid start time format (must be ISO8601).'),
  body('endTime').isISO8601().withMessage('Invalid end time format (must be ISO8601).'),
  body('registrationDeadline').optional().isISO8601().withMessage('Invalid deadline format.'),
  
  body('problems').isArray({ min: 1 }).withMessage('Contest must have at least one problem.'),
  body('problems.*.problemId').isMongoId().withMessage('Each problem must have a valid problemId.'),
  body('problems.*.label').matches(/^[A-Z]$/).withMessage('Problem label must be a single uppercase letter (A-Z).'),
  
  body('type').isIn(['public', 'private', 'rated']).withMessage('Contest type is invalid.'),
  body('scoringSystem').isIn(['ICPC', 'IOI', 'AtCoder']).withMessage('Scoring system is invalid.'),
  
  body('password').if(body('type').equals('private')).notEmpty().withMessage('Password is required for private contests.'),

  handleValidationErrors,
];

// --- REFACTORED & OPTIMIZED ---
// This middleware now fetches the contest object ONCE and attaches it to the request.
// Subsequent validators reuse this object, avoiding multiple database queries.
const validateContestSubmission = [
  param('id')
    .isMongoId().withMessage('Invalid contest ID.')
    .custom(async (contestId, { req }) => {
      // Fetch the contest once and attach to the request object
      const contest = await Contest.findById(contestId);
      if (!contest) {
        throw new Error('Contest not found.');
      }
      if (!contest.isPublished) {
        throw new Error('Contest is not published yet.');
      }
      req.contest = contest; // Attach for reuse
      return true;
    }),

  body('problemLabel')
    .matches(/^[A-Z]$/).withMessage('Invalid problem label.')
    .custom((label, { req }) => {
      // Reuse the contest object from the request
      if (!req.contest.problems.some(p => p.label === label)) {
        throw new Error('Problem not found in this contest.');
      }
      return true;
    }),
  
  body('code').notEmpty().withMessage('Code cannot be empty.').trim(),
  
  body('language')
    .isIn(['cpp', 'java', 'python', 'javascript', 'go', 'rust']).withMessage('Invalid programming language.')
    .custom((language, { req }) => {
      // Reuse the contest object from the request
      const { contest } = req;
      if (contest.allowedLanguages && contest.allowedLanguages.length > 0 && !contest.allowedLanguages.includes(language)) {
        throw new Error(`Language ${language} is not allowed in this contest.`);
      }
      return true;
    }),
  
  // Custom validation to check contest status and registration
  (req, res, next) => {
    const { contest } = req; // Reuse the contest object
    const userId = req.user?.userId;

    if (contest.status !== 'running') {
        return res.status(403).json({ success: false, message: `Contest is not running. Current status: ${contest.status}` });
    }
    if (!contest.isParticipant(userId)) {
        return res.status(403).json({ success: false, message: 'You are not registered for this contest.' });
    }
    next();
  },

  handleValidationErrors,
];

const validateContestRegistration = [
  param('id').isMongoId().withMessage('Invalid contest ID'),
  body('password').optional().isString(),
  handleValidationErrors,
];

const validateContestQuery = [
  query('status').optional().isIn(['all', 'upcoming', 'running', 'ended', 'registering']).withMessage('Invalid status filter'),
  query('type').optional().isIn(['all', 'public', 'private', 'rated']).withMessage('Invalid type filter'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  handleValidationErrors,
];

const validateStandingsQuery = [
  param('id').isMongoId().withMessage('Invalid contest ID'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  handleValidationErrors,
];

const validateContestUpdate = [
  param('id').isMongoId().withMessage('Invalid contest ID'),
  // The logic for who can edit and when is complex, better handled in the controller.
  // This middleware can just validate the data format if any.
  body('title').optional().isLength({ min: 5, max: 200 }).trim().escape(),
  body('description').optional().isLength({ min: 10, max: 10000 }).trim(),
  handleValidationErrors,
];

const validateContestDeletion = [
  param('id').isMongoId().withMessage('Invalid contest ID'),
  // Authorization logic (who can delete) is best handled in the controller/service.
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
};