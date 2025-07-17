const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

const validateTopic = [
  body('title').isLength({ min: 5, max: 200 }).withMessage('Title must be between 5 and 200 characters'),
  body('content').isLength({ min: 10, max: 10000 }).withMessage('Content must be between 10 and 10000 characters'),
  body('categoryId').isMongoId().withMessage('Invalid category ID'),
  body('tags').isArray({ max: 5 }).withMessage('You can have a maximum of 5 tags'),
  body('tags.*').isLength({ min: 2, max: 20 }).withMessage('Tags must be between 2 and 20 characters'),
  handleValidationErrors,
];

const validatePost = [
  body('content').isLength({ min: 1, max: 10000 }).withMessage('Content must be between 1 and 10000 characters'),
  body('topicId').isMongoId().withMessage('Invalid topic ID'),
  body('replyToPostId').optional().isMongoId().withMessage('Invalid reply ID'),
  handleValidationErrors,
];

const validateProfile = [
    body('signature').optional().isLength({ max: 500 }).withMessage('Signature cannot exceed 500 characters'),
    body('title').optional().isLength({ max: 50 }).withMessage('Title cannot exceed 50 characters'),
    body('location').optional().isLength({ max: 100 }).withMessage('Location cannot exceed 100 characters'),
    handleValidationErrors,
];


module.exports = {
  validateTopic,
  validatePost,
  validateProfile,
};
