const Topic = require('../../models/forum/Topic');
const Category = require('../../models/forum/Category');

// GET /api/forum/topics
const getTopics = async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = 'lastActivity', categoryId } = req.query;
    const query = categoryId ? { category: categoryId } : {};
    
    const topics = await Topic.find(query)
      .populate('author', 'username')
      .populate('category', 'name slug')
      .sort({ [sort]: -1 })
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

    const newTopic = new Topic({
      title,
      content,
      author,
      category: categoryId,
      tags,
    });

    await newTopic.save();
    
    // Update category stats
    await Category.findByIdAndUpdate(categoryId, { $inc: { topicCount: 1 }, lastTopic: newTopic._id });

    res.status(201).json({ success: true, data: newTopic });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = {
  getTopics,
  getTopicBySlug,
  createTopic,
};
