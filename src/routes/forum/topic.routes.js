const express = require('express');
const router = express.Router();
const { getTopics, searchTopics, getTopicBySlug, createTopic } = require('../../controllers/forum/topic.controller');
const { auth } = require('../../middleware/auth');
const { validateTopic } = require('../../middleware/forum/validation');
const { createTopicLimiter } = require('../../middleware/forum/rateLimit');

router.get('/', getTopics);
router.get('/search', searchTopics); // Add search route BEFORE /:slug
router.get('/:slug', getTopicBySlug);
router.post('/', auth, createTopicLimiter, validateTopic, createTopic);

module.exports = router;