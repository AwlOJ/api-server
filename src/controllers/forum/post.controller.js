const Post = require('../../models/forum/Post');
const Topic = require('../../models/forum/Topic');
const PostLike = require('../../models/forum/PostLike');

// GET /api/forum/posts/topic/:topicId
const getPostsByTopic = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { topicId } = req.params;

    const posts = await Post.find({ topic: topicId })
      .populate('author', 'username')
      .sort({ createdAt: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Post.countDocuments({ topic: topicId });

    res.json({
      success: true,
      data: {
        posts,
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

    const topic = await Topic.findById(topicId);
    if (!topic || topic.isLocked) {
        return res.status(403).json({ success: false, message: 'Topic is locked or does not exist.'});
    }

    const newPost = new Post({
      content,
      author,
      topic: topicId,
      replyTo: replyToPostId,
    });

    await newPost.save();
    res.status(201).json({ success: true, data: newPost });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /api/forum/posts/:id/like
const likePost = async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user.userId;
        const { type } = req.body;

        const existingLike = await PostLike.findOne({ post: postId, user: userId });

        if (existingLike) {
            // User wants to remove the like or change it
            if (existingLike.type === type) {
                await existingLike.remove();
                await Post.findByIdAndUpdate(postId, { $inc: { likeCount: -1 } });
                return res.json({ success: true, message: 'Like removed' });
            } else {
                existingLike.type = type;
                await existingLike.save();
                return res.json({ success: true, data: existingLike, message: 'Like type changed' });
            }
        } else {
            // New like
            const newLike = new PostLike({ post: postId, user: userId, type });
            await newLike.save();
            await Post.findByIdAndUpdate(postId, { $inc: { likeCount: 1 } });
            return res.status(201).json({ success: true, data: newLike, message: 'Post liked' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};


module.exports = {
  getPostsByTopic,
  createPost,
  likePost,
};
