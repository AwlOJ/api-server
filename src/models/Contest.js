const mongoose = require('mongoose');

const contestSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    minlength: 5,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 10000
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // minutes
    required: true
  },
  problems: [{
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      required: true
    },
    label: {
      type: String, // A, B, C, D...
      required: true
    },
    points: {
      type: Number,
      default: 100
    }
  }],
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    registeredAt: {
      type: Date,
      default: Date.now
    },
    isVisible: {
      type: Boolean,
      default: true
    }
  }],
  type: {
    type: String,
    enum: ['public', 'private', 'rated'],
    default: 'public'
  },
  scoringSystem: {
    type: String,
    enum: ['ICPC', 'IOI', 'AtCoder'],
    default: 'ICPC'
  },
  allowedLanguages: [{
    type: String,
    enum: ['cpp', 'java', 'python', 'javascript', 'go', 'rust']
  }],
  maxSubmissions: {
    type: Number,
    default: 0 // 0 = unlimited
  },
  freezeTime: {
    type: Number, // minutes before end
    default: 60
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  isRated: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Contest settings
  settings: {
    showOthersCode: {
      type: Boolean,
      default: false
    },
    allowClarifications: {
      type: Boolean,
      default: true
    },
    penaltyPerWrongSubmission: {
      type: Number,
      default: 20 // minutes for ICPC
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
contestSchema.index({ startTime: 1, endTime: 1 });
contestSchema.index({ 'participants.user': 1 });
contestSchema.index({ createdBy: 1 });

// Virtual for contest status
contestSchema.virtual('status').get(function() {
  const now = new Date();
  if (now < this.startTime) return 'upcoming';
  if (now > this.endTime) return 'ended';
  return 'running';
});

contestSchema.virtual('timeLeft').get(function() {
  const now = new Date();
  if (this.status === 'upcoming') {
    return this.startTime - now;
  }
  if (this.status === 'running') {
    return this.endTime - now;
  }
  return 0;
});

module.exports = mongoose.model('Contest', contestSchema);