const express = require('express');
const router = express.Router();

const categoryRoutes = require('./category.routes');
const topicRoutes = require('./topic.routes');
const postRoutes = require('./post.routes');
// const profileRoutes = require('./profile.routes'); // Will be added later

router.use('/categories', categoryRoutes);
router.use('/topics', topicRoutes);
router.use('/posts', postRoutes);
// router.use('/profiles', profileRoutes);

module.exports = router;
