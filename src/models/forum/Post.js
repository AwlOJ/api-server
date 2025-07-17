const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  content: { type: String, required: true, trim: true, minlength: 1, maxlength: 10000 },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  likeCount: { type: Number, default: 0 },
  position: { type: Number },
}, { timestamps: true });

// When a new post is created, update topic and category stats
postSchema.post('save', async function(doc) {
  const Topic = mongoose.model('Topic');
  const Category = mongoose.model('Category');
  
  const topic = await Topic.findById(doc.topic);
  if (topic) {
    topic.replyCount += 1;
    topic.lastActivity = doc.createdAt;
    topic.lastPost = doc._id;
    await topic.save();

    const category = await Category.findById(topic.category);
    if (category) {
      category.postCount += 1;
      await category.save();
    }
  }
});

module.exports = mongoose.model('Post', postSchema);
