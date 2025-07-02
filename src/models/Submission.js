const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  problemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Problem',
    required: true,
  },
  code: {
    type: String,
    required: true,
  },
  language: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'In Queue', 'Judging', 'Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Memory Limit Exceeded', 'Runtime Error', 'Compilation Error', 'Internal Error'],
    default: 'Pending',
  },
  executionTime: {
    type: Number,
  },
  memoryUsed: {
    type: Number,
  },
}, {
  timestamps: true,
});

const Submission = mongoose.model('Submission', submissionSchema);

module.exports = Submission;