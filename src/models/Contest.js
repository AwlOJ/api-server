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
    required: true,
    validate: {
      validator: function(v) {
        return v > new Date();
      },
      message: 'Start time must be in the future'
    }
  },
  endTime: {
    type: Date,
    required: true,
    validate: {
      validator: function(v) {
        return v > this.startTime;
      },
      message: 'End time must be after start time'
    }
  },
  duration: {
    type: Number, // minutes
    required: true,
    min: 30, // ✅ Minimum contest duration
    max: 10080 // ✅ Maximum 7 days
  },
  problems: [{
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      required: true
    },
    label: {
      type: String, // A, B, C, D...
      required: true,
      match: /^[A-Z]$/ // ✅ Validation for single letter
    },
    points: {
      type: Number,
      default: 100,
      min: 1,
      max: 1000
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
    enum: ['cpp', 'java', 'python', 'javascript', 'go', 'rust'],
    default: ['cpp', 'java', 'python'] // ✅ Default allowed languages
  }],
  maxSubmissions: {
    type: Number,
    default: 0, // 0 = unlimited
    min: 0,
    max: 50
  },
  freezeTime: {
    type: Number, // minutes before end
    default: 60,
    min: 0,
    max: 300 // ✅ Max 5 hours
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
  // ✅ Contest settings with proper defaults
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
      default: 20, // minutes for ICPC
      min: 0,
      max: 60
    },
    enablePlagiarismCheck: {
      type: Boolean,
      default: true
    },
    autoPublishResults: {
      type: Boolean,
      default: true
    }
  },
  // ✅ Add missing fields
  registrationDeadline: {
    type: Date,
    default: function() {
      return this.startTime; // Default to contest start time
    }
  },
  // ✅ Contest access control
  password: {
    type: String,
    default: null // For private contests
  },
  // ✅ Contest status tracking
  isPublished: {
    type: Boolean,
    default: false
  },
  // ✅ Statistics
  totalParticipants: {
    type: Number,
    default: 0
  },
  totalSubmissions: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// ✅ Indexes for better performance
contestSchema.index({ startTime: 1, endTime: 1 });
contestSchema.index({ 'participants.user': 1 });
contestSchema.index({ createdBy: 1 });
contestSchema.index({ type: 1, isVisible: 1 });
contestSchema.index({ isPublished: 1, startTime: 1 });

// ✅ Compound index for unique problem labels per contest
contestSchema.index({ '_id': 1, 'problems.label': 1 }, { unique: true });

// ✅ Virtual for contest status (Fixed logic)
contestSchema.virtual('status').get(function() {
  const now = new Date();
  if (!this.isPublished) return 'draft';
  if (now < this.startTime) return 'upcoming';
  if (now >= this.startTime && now <= this.endTime) return 'running';
  return 'ended';
});

// ✅ Virtual for time calculations
contestSchema.virtual('timeLeft').get(function() {
  const now = new Date();
  if (this.status === 'upcoming') {
    return Math.max(0, this.startTime - now);
  }
  if (this.status === 'running') {
    return Math.max(0, this.endTime - now);
  }
  return 0;
});

// ✅ Virtual for registration status
contestSchema.virtual('canRegister').get(function() {
  const now = new Date();
  return this.isPublished && 
         now < this.registrationDeadline && 
         this.status !== 'ended';
});

// ✅ Pre-save middleware to ensure data consistency
contestSchema.pre('save', function(next) {
  // Auto-calculate duration
  this.duration = Math.floor((this.endTime - this.startTime) / (1000 * 60));
  
  // Validate problem labels are unique
  const labels = this.problems.map(p => p.label);
  const uniqueLabels = [...new Set(labels)];
  if (labels.length !== uniqueLabels.length) {
    return next(new Error('Problem labels must be unique within a contest'));
  }
  
  // Update participant count
  this.totalParticipants = this.participants.length;
  
  next();
});

// ✅ Instance methods
contestSchema.methods.addParticipant = function(userId) {
  if (this.participants.some(p => p.user.toString() === userId.toString())) {
    throw new Error('User already registered');
  }
  
  if (!this.canRegister) {
    throw new Error('Registration is closed');
  }
  
  this.participants.push({ user: userId });
  return this.save();
};

contestSchema.methods.removeParticipant = function(userId) {
  this.participants = this.participants.filter(
    p => p.user.toString() !== userId.toString()
  );
  return this.save();
};

contestSchema.methods.isParticipant = function(userId) {
  return this.participants.some(p => p.user.toString() === userId.toString());
};

// ✅ Static methods
contestSchema.statics.findUpcoming = function() {
  return this.find({
    isPublished: true,
    isVisible: true,
    startTime: { $gt: new Date() }
  }).sort({ startTime: 1 });
};

contestSchema.statics.findRunning = function() {
  const now = new Date();
  return this.find({
    isPublished: true,
    isVisible: true,
    startTime: { $lte: now },
    endTime: { $gt: now }
  });
};

module.exports = mongoose.model('Contest', contestSchema);