const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  content: { 
    type: String, 
    required: true, 
    trim: true, 
    minlength: 1, 
    maxlength: 10000 
  },
  author: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  topic: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Topic', 
    required: true,
    index: true
  },
  replyTo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Post' 
  },
  likeCount: { 
    type: Number, 
    default: 0 
  },
  // The position of the post within the topic, e.g., #1, #2, etc.
  position: { 
    type: Number,
    index: true
  },
}, { timestamps: true });

// The logic that was previously in the post('save') hook has been removed.
// It will now be handled in the Post controller using a transaction 
// to ensure data integrity and better performance.

module.exports = mongoose.model('Post', postSchema);
