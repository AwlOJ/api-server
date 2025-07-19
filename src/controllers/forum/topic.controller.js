const Topic = require('../../models/forum/Topic');
const Category = require('../../models/forum/Category');

// GET /api/forum/topics
const getTopics = async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = 'lastActivity', categoryId } = req.query;
    
    let query = {};
    
    if (categoryId) {
      const categoryExists = await Category.findById(categoryId);
      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }
      
      query = { 
        category: categoryId,
        $expr: { $ne: ['$category', null] }
      };
    } else {
      query = { 
        category: { $ne: null, $exists: true }
      };
    }
    
    // Define sort options
    let sortOption = {};
    switch (sort) {
      case 'newest':
        sortOption = { createdAt: -1 };
        break;
      case 'popular':
        sortOption = { viewCount: -1 };
        break;
      case 'replies':
        sortOption = { replyCount: -1 };
        break;
      default:
        sortOption = { lastActivity: -1 };
    }
    
    const topics = await Topic.find(query)
      .populate('author', 'username')
      .populate('category', 'name slug')
      .sort(sortOption)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Topic.countDocuments(query);

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
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const getTopicsByCategorySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const { page = 1, limit = 20, sort = 'lastActivity' } = req.query;
    
    // Find category by slug
    const category = await Category.findOne({ slug });
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    // Define sort options
    let sortOption = {};
    switch (sort) {
      case 'newest':
        sortOption = { createdAt: -1 };
        break;
      case 'popular':
        sortOption = { viewCount: -1 };
        break;
      case 'replies':
        sortOption = { replyCount: -1 };
        break;
      default:
        sortOption = { lastActivity: -1 };
    }
    
    const query = { 
      category: category._id,
      $expr: { $ne: ['$category', null] }
    };
    
    const topics = await Topic.find(query)
      .populate('author', 'username')
      .populate('category', 'name slug')
      .sort(sortOption)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Topic.countDocuments(query);

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

// GET /api/forum/topics/search
const searchTopics = async (req, res) => {
  try {
    const { q, categoryId, tags, page = 1, limit = 20 } = req.query;
    
    // Build search query
    const query = {};
    
    // Text search on title and content
    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { content: { $regex: q, $options: 'i' } }
      ];
    }
    
    // Category filter
    if (categoryId) {
      query.category = categoryId;
    }
    
    // Tags filter
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }
    
    const topics = await Topic.find(query)
      .populate('author', 'username')
      .populate('category', 'name slug')
      .sort({ lastActivity: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const count = await Topic.countDocuments(query);
    
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
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /api/forum/topics/:slug
const getTopicBySlug = async (req, res) => {
    try {
        const topic = await Topic.findOne({ slug: req.params.slug }).populate('author', 'username');
        if (!topic) {
            return res.status(404).json({ success: false, message: 'Topic not found' });
        }
        topic.viewCount += 1;
        await topic.save();
        res.json({ success: true, data: topic });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// POST /api/forum/topics
const createTopic = async (req, res) => {
  try {
    const { title, content, categoryId, tags } = req.body;
    const author = req.user.userId;

    const categoryExists = await Category.findById(categoryId);
    if (!categoryExists) {
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

    await newTopic.save();
    
    await Category.findByIdAndUpdate(categoryId, { 
      $inc: { topicCount: 1 }, 
      lastTopic: newTopic._id 
    });

    res.status(201).json({ success: true, data: newTopic });
  } catch (error) {
    console.error('Create topic error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = {
  getTopics,
  searchTopics,
  getTopicBySlug,
  getTopicsByCategorySlug,
  createTopic,
};