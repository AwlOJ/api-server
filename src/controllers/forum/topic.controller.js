const mongoose = require('mongoose');
const Topic = require('../../models/forum/Topic');
const Category = require('../../models/forum/Category');

// Helper function to avoid duplicating sort logic
const getSortOption = (sort) => {
  switch (sort) {
    case 'newest':
      return { createdAt: -1 };
    case 'popular':
      return { viewCount: -1 };
    case 'replies':
      return { replyCount: -1 };
    default: // 'lastActivity'
      return { lastActivity: -1 };
  }
};

// GET /api/forum/topics
const getTopics = async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = 'lastActivity', categoryId } = req.query;
    
    let query = { category: { $ne: null, $exists: true } };
    if (categoryId) {
      query.category = categoryId;
    }
    
    const sortOption = getSortOption(sort);
    
    const topicsPromise = Topic.find(query)
      .populate('author', 'username')
      .populate('category', 'name slug')
      .sort(sortOption)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean() // Use lean for faster read-only queries
      .exec();

    const countPromise = Topic.countDocuments(query);
    
    const [topics, count] = await Promise.all([topicsPromise, countPromise]);

    res.json({
      success: true,
      data: {
        topics,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit),
        }
      }
    });
  } catch (error) {
    console.error('Get topics error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const getTopicsByCategorySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const { page = 1, limit = 20, sort = 'lastActivity' } = req.query;
    
    const category = await Category.findOne({ slug }).lean();
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    const query = { category: category._id };
    const sortOption = getSortOption(sort);
    
    const topicsPromise = Topic.find(query)
      .populate('author', 'username')
      .populate('category', 'name slug')
      .sort(sortOption)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean()
      .exec();

    const countPromise = Topic.countDocuments(query);
    
    const [topics, count] = await Promise.all([topicsPromise, countPromise]);

    res.json({
      success: true,
      data: {
        category,
        topics,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit),
        }
      }
    });
  } catch (error) {
    console.error('Get topics by category error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const searchTopics = async (req, res) => {
  try {
    const { q, categoryId, tags, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { content: { $regex: q, $options: 'i' } }
      ];
    }
    if (categoryId) {
      query.category = categoryId;
    }
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }
    
    const topicsPromise = Topic.find(query)
      .populate('author', 'username')
      .populate('category', 'name slug')
      .sort({ lastActivity: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();
    
    const countPromise = Topic.countDocuments(query);
    
    const [topics, count] = await Promise.all([topicsPromise, countPromise]);
    
    res.json({
      success: true,
      data: {
        topics,
        searchQuery: { q, categoryId, tags },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Search topics error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const getTopicBySlug = async (req, res) => {
    try {
        const topic = await Topic.findOne({ slug: req.params.slug })
          .populate('author', 'username')
          .populate('category', 'name slug');

        if (!topic) {
            return res.status(404).json({ success: false, message: 'Topic not found' });
        }
        
        // Increment view count without waiting for it to finish for faster response
        Topic.updateOne({ _id: topic._id }, { $inc: { viewCount: 1 } }).exec();
        
        res.json({ success: true, data: topic });
    } catch (error) {
        console.error('Get topic by slug error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const createTopic = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { title, content, categoryId, tags } = req.body;
    const author = req.user.userId;

    const category = await Category.findById(categoryId).session(session);
    if (!category) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'categoryId', message: 'Category not found' }]
      });
    }

    const newTopic = new Topic({
      title,
      content,
      author,
      category: categoryId,
      tags,
    });

    await newTopic.save({ session });
    
    category.topicCount += 1;
    category.lastTopic = newTopic._id;
    await category.save({ session });

    await session.commitTransaction();

    // Populate author for the response
    await newTopic.populate('author', 'username');

    res.status(201).json({ success: true, data: newTopic });
  } catch (error) {
    await session.abortTransaction();
    console.error('Create topic error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Server Error' });
  } finally {
    session.endSession();
  }
};

module.exports = {
  getTopics,
  searchTopics,
  getTopicBySlug,
  getTopicsByCategorySlug,
  createTopic,
};