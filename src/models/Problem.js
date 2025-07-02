const mongoose = require('mongoose');

const problemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    required: true,
  },
  timeLimit: {
    type: Number,
    required: true,
    min: 0,
  },
  memoryLimit: {
    type: Number,
    required: true,
    min: 0,
  },
  testCases: [{
    input: {
      type: String,
      required: true,
    },
    output: {
      type: String,
      required: true,
    },
  }, ],
}, {
  timestamps: true,
});

const Problem = mongoose.model('Problem', problemSchema);

module.exports = Problem;