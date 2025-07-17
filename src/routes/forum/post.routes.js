const express = require('express');
const router = express.Router();
const { getPostsByTopic, createPost, likePost } = require('../../controllers/forum/post.controller');
const { auth } = require('../../middleware/auth');
const { validatePost } = require('../../middleware/forum/validation');
const { createPostLimiter, likeLimiter } = require('../../middleware/forum/rateLimit');

router.get('/topic/:topicId', getPostsByTopic);
router.post('/', auth, createPostLimiter, validatePost, createPost);
router.post('/:id/like', auth, likeLimiter, likePost);

module.exports = router;
