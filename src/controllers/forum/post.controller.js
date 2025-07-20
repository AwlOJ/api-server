const Post = require('../../models/forum/Post');
const Topic = require('../../models/forum/Topic');
const PostLike = require('../../models/forum/PostLike');
const { processPostNotifications } = require('../../services/forum/notification.service');
const { updateUserActivity } = require('./profile.controller');

// GET /api/forum/posts/topic/:topicId
const getPostsByTopic = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { topicId } = req.params;
    const userId = req.user?.userId;

    const posts = await Post.find({ topic: topicId })
      .populate('author', 'username')
      .sort({ createdAt: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    // If user is logged in, get their likes
    let userLikes = [];
    if (userId) {
      userLikes = await PostLike.find({
        post: { $in: posts.map(p => p._id) },
        user: userId
      });
    }

    // Add user like info to posts
    const postsWithLikes = posts.map(post => {
      const userLike = userLikes.find(like => like.post.toString() === post._id.toString());
      return {
        ...post.toObject(),
        userLiked: !!userLike,
        userLikeType: userLike?.type || null
      };
    });

    const count = await Post.countDocuments({ topic: topicId });

    res.json({
      success: true,
      data: {
        posts: postsWithLikes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit),
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /api/forum/posts
const createPost = async (req, res) => {
  try {
    const { content, topicId, replyToPostId } = req.body;
    const author = req.user.userId;

    const topic = await Topic.findById(topicId).populate('author');
    if (!topic) {
      return res.status(404).json({ success: false, message: 'Topic not found' });
    }
    
    if (topic.isLocked) {
      return res.status(403).json({ success: false, message: 'Topic is locked' });
    }

    const newPost = new Post({
      content,
      author,
      topic: topicId,
      replyTo: replyToPostId,
    });

    await newPost.save();
    
    await newPost.populate('author', 'username');

    await updateUserActivity(author);

    // BETTER ASYNC HANDLING - Use proper error handling
    try {
      await processPostNotifications(newPost, topic);
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
      // Don't fail the request if notifications fail
    }

    res.status(201).json({ success: true, data: newPost });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /api/forum/posts/:id/like
const likePost = async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user.userId;
        const { type = 'like' } = req.body;

        const existingLike = await PostLike.findOne({ post: postId, user: userId });

        if (existingLike) {
            // User wants to remove the like or change it
            if (existingLike.type === type) {
                await existingLike.deleteOne();
                await Post.findByIdAndUpdate(postId, { $inc: { likeCount: -1 } });
                return res.json({ success: true, message: 'Like removed', liked: false });
            } else {
                existingLike.type = type;
                await existingLike.save();
                return res.json({ 
                    success: true, 
                    data: existingLike, 
                    message: 'Like type changed',
                    liked: true,
                    likeType: type
                });
            }
        } else {
            // New like
            const newLike = new PostLike({ post: postId, user: userId, type });
            await newLike.save();
            await Post.findByIdAndUpdate(postId, { $inc: { likeCount: 1 } });
            
            // Update user activity
            await updateUserActivity(userId);
            
            return res.status(201).json({ 
                success: true, 
                data: newLike, 
                message: 'Post liked',
                liked: true,
                likeType: type
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// DELETE /api/forum/posts/:id (for moderators/admins or post owner)
const deletePost = async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user.userId;
        const userRole = req.user.role;

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }

        // Check permissions
        if (post.author.toString() !== userId && userRole !== 'admin' && userRole !== 'moderator') {
            return res.status(403).json({ success: false, message: 'Permission denied' });
        }

        await post.deleteOne();
        
        // Update topic reply count
        await Topic.findByIdAndUpdate(post.topic, { $inc: { replyCount: -1 } });

        res.json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

module.exports = {
  getPostsByTopic,
  createPost,
  likePost,
  deletePost
};