const mongoose = require('mongoose');

const postLikeSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { 
    type: String, 
    enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'],
    default: 'like'
  },
}, { timestamps: true });

postLikeSchema.index({ post: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('PostLike', postLikeSchema);
