const mongoose = require('mongoose');

const contestSubmissionSchema = new mongoose.Schema({
  contest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contest',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  problem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Problem',
    required: true
  },
  problemLabel: {
    type: String, // A, B, C...
    required: true
  },
  submission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission',
    required: true,
    unique: true // A regular submission can only be linked to one contest submission
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

// Compound indexes for more specific queries
contestSubmissionSchema.index({ contest: 1, user: 1, problem: 1 });
contestSubmissionSchema.index({ contest: 1, isAccepted: 1, problem: 1 });
contestSubmissionSchema.index({ contest: 1, submissionTime: 1 });


module.exports = mongoose.model('ContestSubmission', contestSubmissionSchema);