const mongoose = require('mongoose');
const slugify = require('slugify');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, required: true, trim: true },
  slug: { type: String, unique: true },
  icon: { type: String },
  color: { type: String },
  order: { type: Number, default: 0 },
  topicCount: { type: Number, default: 0 },
  postCount: { type: Number, default: 0 },
  moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  lastTopic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
}, { timestamps: true });

categorySchema.pre('save', function(next) {
  if (!this.isModified('name')) {
    return next();
  }
  this.slug = slugify(this.name, { lower: true, strict: true });
  next();
});

module.exports = mongoose.model('Category', categorySchema);
