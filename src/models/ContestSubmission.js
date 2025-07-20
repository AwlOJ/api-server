const mongoose = require('mongoose');

const contestSubmissionSchema = new mongoose.Schema({
  contest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contest',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  problem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Problem',
    required: true
  },
  problemLabel: {
    type: String, // A, B, C, D...
    required: true
  },
  submission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission',
    required: true
  },
  // Contest-specific fields
  submissionTime: {
    type: Number, // minutes from contest start
    required: true
  },
  points: {
    type: Number,
    default: 0
  },
  penalty: {
    type: Number,
    default: 0
  },
  isAccepted: {
    type: Boolean,
    default: false
  },
  attemptNumber: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Indexes
contestSubmissionSchema.index({ contest: 1, user: 1, problem: 1 });
contestSubmissionSchema.index({ contest: 1, submissionTime: 1 });

module.exports = mongoose.model('ContestSubmission', contestSubmissionSchema);