const mongoose = require('mongoose');
const slugify = require('slugify');

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

topicSchema.pre('save', function(next) {
  if (!this.isModified('title')) {
    return next();
  }
  this.slug = slugify(this.title, { lower: true, strict: true });
  next();
});

module.exports = mongoose.model('Topic', topicSchema);
