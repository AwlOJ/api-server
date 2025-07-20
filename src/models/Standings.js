const mongoose = require('mongoose');

const problemResultSchema = new mongoose.Schema({
  problemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Problem',
    required: true
  },
  label: {
    type: String,
    required: true
  },
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
  solvedAt: {
    type: Date 
  },
  submissionTime: { // Minutes from contest start for first AC
    type: Number
  }
}, { _id: false });

const rankingEntrySchema = new mongoose.Schema({
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
  problems: [problemResultSchema]
}, { _id: false });


const standingsSchema = new mongoose.Schema({
  contest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contest',
    required: true,
    unique: true,
    index: true
  },
  rankings: [rankingEntrySchema],
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

// Index to efficiently find and update a user's entry in the rankings array.
standingsSchema.index({ "rankings.user": 1 });

module.exports = mongoose.model('Standings', standingsSchema);