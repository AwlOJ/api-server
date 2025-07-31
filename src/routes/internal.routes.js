const express = require('express');
const router = express.Router();
const { judgeCallbackController } = require('../controllers/internal.controller');
const internalAuth = require('../middleware/internalAuth');

// This route is called by the Judge Service after it finishes judging a submission.
router.post('/judge-callback', internalAuth, judgeCallbackController);

module.exports = router;
