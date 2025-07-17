const ForumProfile = require('../../models/forum/ForumProfile');
const User = require('../../models/User');
const Topic = require('../../models/forum/Topic');
const Post = require('../../models/forum/Post');

// GET /api/forum/profiles/:userId
const getProfileByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user info
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get or create forum profile
    let profile = await ForumProfile.findOne({ user: userId });
    if (!profile) {
      profile = new ForumProfile({ user: userId });
      await profile.save();
    }

    // Get recent activity
    const recentTopics = await Topic.find({ author: userId })
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentPosts = await Post.find({ author: userId })
      .populate('topic', 'title slug')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        user,
        profile,
        recentActivity: {
          topics: recentTopics,
          posts: recentPosts
        }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// PUT /api/forum/profiles/me
const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { signature, title, location, website, githubProfile, preferences } = req.body;

    let profile = await ForumProfile.findOne({ user: userId });
    if (!profile) {
      profile = new ForumProfile({ user: userId });
    }

    // Update profile fields
    if (signature !== undefined) profile.signature = signature;
    if (title !== undefined) profile.title = title;
    if (location !== undefined) profile.location = location;
    if (website !== undefined) profile.website = website;
    if (githubProfile !== undefined) profile.githubProfile = githubProfile;
    if (preferences !== undefined) {
      profile.preferences = { ...profile.preferences, ...preferences };
    }

    await profile.save();

    res.json({ success: true, data: profile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /api/forum/profiles/leaderboard
const getLeaderboard = async (req, res) => {
  try {
    const { type = 'reputation', page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    let sortField;
    switch (type) {
      case 'posts':
        sortField = 'postCount';
        break;
      case 'topics':
        sortField = 'topicCount';
        break;
      default:
        sortField = 'reputation';
    }

    const profiles = await ForumProfile.find()
      .populate('user', 'username email')
      .sort({ [sortField]: -1 })
      .limit(limit * 1)
      .skip(skip);

    const total = await ForumProfile.countDocuments();

    res.json({
      success: true,
      data: {
        profiles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Update user activity (middleware to be called on actions)
const updateUserActivity = async (userId) => {
  try {
    await ForumProfile.findOneAndUpdate(
      { user: userId },
      { lastSeen: new Date() },
      { upsert: true }
    );
  } catch (error) {
    console.error('Error updating user activity:', error);
  }
};

module.exports = {
  getProfileByUserId,
  updateMyProfile,
  getLeaderboard,
  updateUserActivity
};