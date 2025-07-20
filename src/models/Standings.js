const mongoose = require('mongoose');

const standingsSchema = new mongoose.Schema({
  contest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contest',
    required: true,
    unique: true
  },
  rankings: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    rank: {
      type: Number,
      required: true
    },
    totalScore: {
      type: Number,
      default: 0
    },
    totalPenalty: {
      type: Number,
      default: 0
    },
    totalSubmissions: {
      type: Number,
      default: 0
    },
    solvedProblems: {
      type: Number,
      default: 0
    },
    problems: [{
      problemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Problem'
      },
      label: String, // A, B, C, D...
      score: {
        type: Number,
        default: 0
      },
      penalty: {
        type: Number,
        default: 0
      },
      attempts: {
        type: Number,
        default: 0
      },
      status: {
        type: String,
        enum: ['AC', 'WA', 'Pending', 'Not Attempted'],
        default: 'Not Attempted'
      },
      solvedAt: Date, // Time when first AC
      submissionTime: Number // Minutes from contest start
    }]
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  isFrozen: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Standings', standingsSchema);