const mongoose = require('mongoose');

const forumAnalyticsSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  type: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'daily' },
  
  pageViews: {
    total: { type: Number, default: 0 },
    topics: { type: Number, default: 0 },
    categories: { type: Number, default: 0 },
    profiles: { type: Number, default: 0 }
  },
  
  actions: {
    topics: { type: Number, default: 0 },
    posts: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    searches: { type: Number, default: 0 }
  },
  
  uniqueUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  topSearches: [{
    query: String,
    count: Number
  }],
  
  popularTopics: [{
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
    views: Number
  }]
}, { timestamps: true });

// Compound index for efficient queries
forumAnalyticsSchema.index({ date: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('ForumAnalytics', forumAnalyticsSchema);