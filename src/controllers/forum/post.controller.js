const mongoose = require('mongoose');
const Post = require('../../models/forum/Post');
const Topic = require('../../models/forum/Topic');
const Category = require('../../models/forum/Category');
const PostLike = require('../../models/forum/PostLike');
const { processPostNotifications } = require('../../services/forum/notification.service');
const { updateUserActivity } = require('./profile.controller');

const getPostsByTopic = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { topicId } = req.params;
    const userId = req.user?.userId;

    const postsPromise = Post.find({ topic: topicId })
      .populate('author', 'username')
      .sort({ createdAt: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const countPromise = Post.countDocuments({ topic: topicId });
    const [posts, count] = await Promise.all([postsPromise, countPromise]);

    let userLikes = [];
    if (userId) {
      userLikes = await PostLike.find({
        post: { $in: posts.map(p => p._id) },
        user: userId
      }).lean();
    }
    const userLikesMap = new Map(userLikes.map(like => [like.post.toString(), like]));

    const postsWithLikes = posts.map(post => ({
      ...post,
      userLiked: userLikesMap.has(post._id.toString()),
      userLikeType: userLikesMap.get(post._id.toString())?.type || null
    }));

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
    console.error('Get posts error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// --- REBUILT FROM SCRATCH ---
const createPost = async (req, res) => {
  const { content, topicId, replyToPostId } = req.body;
  const authorId = req.user.userId;
  
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const topic = await Topic.findById(topicId).session(session);
    if (!topic) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Topic not found' });
    }
    
    if (topic.isLocked) {
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: 'This topic is locked and does not accept new replies.' });
    }

    // 1. Create the new post within the transaction
    const post = new Post({
      content,
      author: authorId,
      topic: topicId,
      replyTo: replyToPostId,
      position: topic.replyCount + 2 // +1 for 0-index, +1 for the new post itself
    });
    await post.save({ session });

    // 2. Update Topic stats using the atomic method we created
    // This increments replyCount and updates lastActivity/lastPost
    await Topic.updateLastActivity(topicId, post._id, { session });
    
    // 3. Update Category post count atomically
    await Category.updateOne({ _id: topic.category }, { $inc: { postCount: 1 } }, { session });

    // 4. If all database operations succeed, commit the transaction
    await session.commitTransaction();

    // 5. After committing, perform non-essential tasks (notifications, etc.)
    await post.populate('author', 'username');
    
    updateUserActivity(authorId).catch(err => console.error('Failed to update user activity:', err));
    processPostNotifications(post, topic).catch(err => console.error('Failed to process notifications:', err));

    res.status(201).json({ success: true, data: post, message: 'Post created successfully.' });

  } catch (error) {
    // If anything fails, abort the entire transaction
    await session.abortTransaction();
    console.error('Create post error:', error);
    if (error.name === 'ValidationError') {
        return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'An unexpected error occurred while creating the post.' });
  } finally {
    // Always end the session
    session.endSession();
  }
};

const likePost = async (req, res) => {
    const postId = req.params.id;
    const userId = req.user.userId;
    const { type = 'like' } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const post = await Post.findById(postId).session(session);
        if(!post) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: 'Post not found.' });
        }

        const existingLike = await PostLike.findOne({ post: postId, user: userId }).session(session);

        let liked = false;
        let message = '';
        let likeType = null;
        
        if (existingLike) {
            if (existingLike.type === type) { // Unlike
                await existingLike.deleteOne({ session });
                post.likeCount -= 1;
                message = 'Like removed';
            } else { // Change like type
                existingLike.type = type;
                await existingLike.save({ session });
                liked = true;
                likeType = type;
                message = 'Like type changed';
            }
        } else { // New like
            await PostLike.create([{ post: postId, user: userId, type }], { session });
            post.likeCount += 1;
            liked = true;
            likeType = type;
            message = 'Post liked';
        }

        await post.save({ session });
        await session.commitTransaction();

        res.json({ success: true, message, liked, likeType, likeCount: post.likeCount });

    } catch (error) {
        await session.abortTransaction();
        console.error('Like post error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    } finally {
        session.endSession();
    }
};

const deletePost = async (req, res) => {
    const postId = req.params.id;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const post = await Post.findById(postId).session(session);
        if (!post) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: 'Post not found' });
        }

        if (post.author.toString() !== userId && !['admin', 'moderator'].includes(userRole)) {
            await session.abortTransaction();
            return res.status(403).json({ success: false, message: 'You do not have permission to delete this post.' });
        }

        // Atomically update topic and category stats
        const topic = await Topic.findById(post.topic).session(session);
        await Topic.updateOne({ _id: post.topic }, { $inc: { replyCount: -1 } }).session(session);
        await Category.updateOne({ _id: topic.category }, { $inc: { postCount: -1 } }).session(session);

        // Delete associated likes
        await PostLike.deleteMany({ post: postId }).session(session);
        
        // Delete the post itself
        await post.deleteOne({ session });

        await session.commitTransaction();

        res.json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
        await session.abortTransaction();
        console.error('Delete post error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    } finally {
        session.endSession();
    }
};

module.exports = {
  getPostsByTopic,
  createPost,
  likePost,
  deletePost
};