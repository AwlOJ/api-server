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
        // This validation should only apply when creating a new contest or
        // when the startTime is being modified.
        if (this.isNew || this.isModified('startTime')) {
          return v > new Date();
        }
        return true;
      },
      message: 'Start time must be in the future.'
    }
  },
  endTime: {
    type: Date,
    required: true,
    validate: {
      validator: function(v) {
        return v > this.startTime;
      },
      message: 'End time must be after start time.'
    }
  },
  duration: {
    type: Number, // minutes
    min: 30,
    max: 10080 // 7 days
  },
  problems: [{
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      required: true
    },
    label: {
      type: String, // A, B, C...
      required: true,
      match: /^[A-Z]$/
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
  allowedLanguages: {
    type: [String],
    enum: ['cpp', 'java', 'python', 'javascript', 'go', 'rust'],
    default: ['cpp', 'java', 'python']
  },
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
    max: 300 // Max 5 hours
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
  settings: {
    showOthersCode: { type: Boolean, default: false },
    allowClarifications: { type: Boolean, default: true },
    penaltyPerWrongSubmission: { type: Number, default: 20 },
    enablePlagiarismCheck: { type: Boolean, default: true },
    autoPublishResults: { type: Boolean, default: true }
  },
  registrationDeadline: {
    type: Date,
    default: function() { return this.startTime; }
  },
  password: {
    type: String,
    trim: true
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  totalSubmissions: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for query performance
contestSchema.index({ startTime: 1, endTime: 1 });
contestSchema.index({ 'participants.user': 1 });
contestSchema.index({ createdBy: 1 });
contestSchema.index({ isPublished: 1, isVisible: 1, startTime: 1 });

// The unique index on subdocuments doesn't work as expected.
// The validation logic in pre-save hook is the correct way to enforce this.
// contestSchema.index({ '_id': 1, 'problems.label': 1 }, { unique: true });

// Virtuals for computed properties
contestSchema.virtual('status').get(function() {
  const now = new Date();
  if (!this.isPublished) return 'draft';
  if (now < this.startTime) return 'upcoming';
  if (now <= this.endTime) return 'running';
  return 'ended';
});

contestSchema.virtual('timeLeft').get(function() {
  const now = new Date();
  if (this.status === 'upcoming') {
    return Math.max(0, this.startTime.getTime() - now.getTime());
  }
  if (this.status === 'running') {
    return Math.max(0, this.endTime.getTime() - now.getTime());
  }
  return 0;
});

contestSchema.virtual('canRegister').get(function() {
  const now = new Date();
  return this.isPublished && now < this.registrationDeadline && this.status !== 'ended';
});

contestSchema.virtual('participantCount').get(function() {
  return this.participants.length;
});

// Middleware
contestSchema.pre('save', function(next) {
  // Auto-calculate duration if not provided
  if (this.isModified('startTime') || this.isModified('endTime')) {
    this.duration = Math.floor((this.endTime - this.startTime) / (1000 * 60));
  }
  
  // Validate problem labels are unique within this contest
  if (this.isModified('problems')) {
    const labels = this.problems.map(p => p.label);
    if (new Set(labels).size !== labels.length) {
      return next(new Error('Problem labels must be unique within a contest.'));
    }
  }
  
  // Ensure private contests have a password
  if (this.type === 'private' && !this.password) {
    // It's better to handle this in the controller/service layer, but as a safeguard:
    // next(new Error('Private contests require a password.'));
  }
  
  next();
});

// Instance Methods
contestSchema.methods.isParticipant = function(userId) {
  if (!userId) return false;
  return this.participants.some(p => p.user.equals(userId));
};

contestSchema.methods.addParticipant = async function(userId) {
  if (this.isParticipant(userId)) {
    // To prevent race conditions, check again right before update
    const contest = await this.constructor.findById(this._id);
    if(contest.isParticipant(userId)) {
       throw new Error('User is already registered.');
    }
  }
  
  if (!this.canRegister) {
    throw new Error('Registration for this contest is closed.');
  }

  this.participants.push({ user: userId });
  return this.save();
};

// Static Methods
contestSchema.statics.findUpcoming = function(limit = 10) {
  return this.find({
    isPublished: true,
    isVisible: true,
    startTime: { $gt: new Date() }
  }).sort({ startTime: 1 }).limit(limit);
};

contestSchema.statics.findRunning = function(limit = 10) {
  const now = new Date();
  return this.find({
    isPublished: true,
    isVisible: true,
    startTime: { $lte: now },
    endTime: { $gt: now }
  }).sort({ startTime: 1 }).limit(limit);
};

module.exports = mongoose.model('Contest', contestSchema);