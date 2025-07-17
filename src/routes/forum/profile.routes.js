const express = require('express');
const router = express.Router();
const { 
  getProfileByUserId, 
  updateMyProfile, 
  getLeaderboard 
} = require('../../controllers/forum/profile.controller');
const { auth } = require('../../middleware/auth');
const { validateProfile } = require('../../middleware/forum/validation');

// Get leaderboard (public)
router.get('/leaderboard', getLeaderboard);

// Get profile by userId (public)
router.get('/:userId', getProfileByUserId);

// Update my profile (authenticated)
router.put('/me', auth, validateProfile, updateMyProfile);

module.exports = router;