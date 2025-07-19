const Topic = require('../models/forum/Topic');
const Category = require('../models/forum/Category');
const Post = require('../models/forum/Post');

class DatabaseCleanup {
  // Find and fix orphaned topics
  static async cleanupOrphanedTopics() {
    try {
      // Get all valid category IDs
      const validCategoryIds = await Category.distinct('_id');
      
      // Find topics with invalid categories
      const orphanedTopics = await Topic.find({
        $or: [
          { category: null },
          { category: { $exists: false } },
          { category: { $nin: validCategoryIds } }
        ]
      });

      if (orphanedTopics.length > 0) {
        console.log(`Found ${orphanedTopics.length} orphaned topics`);
        
        // Get default category or create one
        let defaultCategory = await Category.findOne({ slug: 'general' });
        if (!defaultCategory) {
          defaultCategory = await Category.create({
            name: 'General',
            description: 'General discussions',
            order: 0
          });
        }

        // Move orphaned topics to default category
        const result = await Topic.updateMany(
          { _id: { $in: orphanedTopics.map(t => t._id) } },
          { $set: { category: defaultCategory._id } }
        );

        console.log(`Moved ${result.modifiedCount} topics to default category`);
        return result;
      }
      
      console.log('No orphaned topics found');
      return { modifiedCount: 0 };
    } catch (error) {
      console.error('Cleanup error:', error);
      throw error;
    }
  }

  // Recalculate category stats
  static async recalculateCategoryStats() {
    try {
      const categories = await Category.find();
      
      for (const category of categories) {
        const topicCount = await Topic.countDocuments({ 
          category: category._id 
        });
        
        const postCount = await Post.countDocuments({
          topic: { $in: await Topic.distinct('_id', { category: category._id }) }
        });

        const lastTopic = await Topic.findOne({ 
          category: category._id 
        }).sort({ createdAt: -1 });

        await Category.findByIdAndUpdate(category._id, {
          topicCount,
          postCount,
          lastTopic: lastTopic?._id || null
        });
      }
      
      console.log('Category stats recalculated');
    } catch (error) {
      console.error('Stats recalculation error:', error);
      throw error;
    }
  }
}

module.exports = DatabaseCleanup;