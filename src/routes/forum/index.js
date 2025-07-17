const express = require('express');
const router = express.Router();

const categoryRoutes = require('./category.routes');
const topicRoutes = require('./topic.routes');
const postRoutes = require('./post.routes');
const profileRoutes = require('./profile.routes');
const { getForumStats } = require('../../controllers/forum/stats.controller');

// Stats route (before other routes to avoid conflicts)
router.get('/stats', getForumStats);

// Mount sub-routes
router.use('/categories', categoryRoutes);
router.use('/topics', topicRoutes);
router.use('/posts', postRoutes);
router.use('/profiles', profileRoutes);

module.exports = router;