const mongoose = require('mongoose');
const { generateUniqueSlug, generateVietnameseSlug } = require('../../utils/forum/slugGenerator');

const topicSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 5, maxlength: 200 },
  slug: { type: String, unique: true },
  content: { type: String, required: true, minlength: 10, maxlength: 10000 },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  viewCount: { type: Number, default: 0 },
  replyCount: { type: Number, default: 0 },
  isPinned: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
  tags: [{ type: String, trim: true }],
  lastActivity: { type: Date, default: Date.now },
  lastPost: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
}, { timestamps: true });

// Generate unique slug before saving
topicSchema.pre('save', async function(next) {
  if (!this.isModified('title')) {
    return next();
  }
  
  try {
    // Use Vietnamese slug generator for Vietnamese text
    const baseSlug = generateVietnameseSlug(this.title);
    this.slug = await generateUniqueSlug(baseSlug, mongoose.model('Topic'));
    next();
  } catch (error) {
    next(error);
  }
});

// Index for better search performance
topicSchema.index({ title: 'text', content: 'text' });
topicSchema.index({ tags: 1 });
topicSchema.index({ category: 1, lastActivity: -1 });
topicSchema.index({ author: 1 });

module.exports = mongoose.model('Topic', topicSchema);