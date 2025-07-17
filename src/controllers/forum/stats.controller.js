const Category = require('../../models/forum/Category');
const Topic = require('../../models/forum/Topic');
const Post = require('../../models/forum/Post');
const User = require('../../models/User');
const ForumProfile = require('../../models/forum/ForumProfile');

// GET /api/forum/stats
const getForumStats = async (req, res) => {
  try {
    const [
      categoriesCount,
      topicsCount,
      postsCount,
      usersCount,
      activeUsers
    ] = await Promise.all([
      Category.countDocuments(),
      Topic.countDocuments(),
      Post.countDocuments(),
      User.countDocuments(),
      ForumProfile.countDocuments({
        lastSeen: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Active in last 24h
      })
    ]);

    // Get trending topics (most active in last 7 days)
    const trendingTopics = await Topic.find({
      lastActivity: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    })
      .populate('author', 'username')
      .populate('category', 'name slug')
      .sort({ replyCount: -1, viewCount: -1 })
      .limit(5);

    // Get top contributors
    const topContributors = await ForumProfile.find()
      .populate('user', 'username')
      .sort({ reputation: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        overview: {
          categories: categoriesCount,
          topics: topicsCount,
          posts: postsCount,
          users: usersCount,
          activeUsers
        },
        trendingTopics,
        topContributors
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = {
  getForumStats
};