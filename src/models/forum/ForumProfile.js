const mongoose = require('mongoose');

const forumProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  signature: { type: String, maxlength: 500 },
  avatar: { type: String },
  title: { type: String, maxlength: 50 },
  location: { type: String, maxlength: 100 },
  website: { type: String },
  githubProfile: { type: String },
  postCount: { type: Number, default: 0 },
  topicCount: { type: Number, default: 0 },
  reputation: { type: Number, default: 0 },
  lastSeen: { type: Date, default: Date.now },
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    showOnlineStatus: { type: Boolean, default: true },
  }
}, { timestamps: true });

module.exports = mongoose.model('ForumProfile', forumProfileSchema);
