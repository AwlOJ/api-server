const mongoose = require('mongoose');
const { generateUniqueSlug } = require('../../utils/forum/slugGenerator');

const topicSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true, 
    minlength: 5, 
    maxlength: 200 
  },
  slug: { 
    type: String, 
    unique: true, 
    index: true 
  },
  content: { 
    type: String, 
    required: true, 
    minlength: 10, 
    maxlength: 10000 
  },
  author: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  category: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category', 
    required: true,
    index: true
  },
  viewCount: { type: Number, default: 0 },
  replyCount: { type: Number, default: 0 },
  isPinned: { type: Boolean, default: false, index: true },
  isLocked: { type: Boolean, default: false },
  tags: [{ type: String, trim: true, lowercase: true }],
  lastActivity: { type: Date, default: Date.now, index: true },
  lastPost: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
}, { timestamps: true });

// Generate a unique slug before saving the document
topicSchema.pre('save', async function(next) {
  // Only generate a slug if the title has changed or if it's a new topic
  if (this.isModified('title') || this.isNew) {
    try {
      // Use the new, robust unique slug generator
      this.slug = await generateUniqueSlug(this.constructor, this.title, this._id);
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Define a method to be called when a new post is added to the topic
topicSchema.statics.updateLastActivity = async function(topicId, lastPostId) {
  return this.findByIdAndUpdate(topicId, {
    $set: {
      lastActivity: new Date(),
      lastPost: lastPostId,
    },
    $inc: {
      replyCount: 1
    }
  });
};

// Ensure text index is created for searching
topicSchema.index({ title: 'text', content: 'text' });

// Compound index for the most common query: finding topics in a category, sorted by activity
topicSchema.index({ category: 1, lastActivity: -1 });

module.exports = mongoose.model('Topic', topicSchema);