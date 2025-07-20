const mongoose = require('mongoose');
const { generateUniqueSlug } = require('../../utils/forum/slugGenerator');

const categorySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Category name is required.'], 
    unique: true, 
    trim: true 
  },
  description: { 
    type: String, 
    required: [true, 'Category description is required.'], 
    trim: true 
  },
  slug: { 
    type: String, 
    unique: true, 
    index: true // Add index to slug as it will be queried often
  },
  icon: { type: String },
  color: { type: String, default: '#007bff' },
  order: { 
    type: Number, 
    default: 0, 
    index: true // Add index for sorting performance
  },
  topicCount: { type: Number, default: 0 },
  postCount: { type: Number, default: 0 },
  moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  lastTopic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
}, { timestamps: true });

// Use the dedicated unique slug generator for robust slug creation
categorySchema.pre('save', async function(next) {
  // Only generate a new slug if the name is modified or it's a new document
  if (this.isModified('name') || this.isNew) {
    this.slug = await generateUniqueSlug(this.constructor, this.name, this._id);
  }
  next();
});

module.exports = mongoose.model('Category', categorySchema);
