const rateLimit = require('express-rate-limit');

const createTopicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { success: false, message: 'Too many topics created from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const createPostLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { success: false, message: 'Too many posts created from this IP, please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const likeLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: { success: false, message: 'Too many like actions from this IP, please try again after a minute.' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
  createTopicLimiter,
  createPostLimiter,
  likeLimiter,
};
