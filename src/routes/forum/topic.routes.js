const express = require('express');
const router = express.Router();
const { getTopics, getTopicBySlug, createTopic } = require('../../controllers/forum/topic.controller');
const { auth } = require('../../middleware/auth');
const { validateTopic } = require('../../middleware/forum/validation');
const { createTopicLimiter } = require('../../middleware/forum/rateLimit');

router.get('/', getTopics);
router.get('/:slug', getTopicBySlug);
router.post('/', auth, createTopicLimiter, validateTopic, createTopic);

module.exports = router;
