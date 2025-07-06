const express = require('express');
const { signup, login, getLoggedInUser } = require('../controllers/auth.controller');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', auth, getLoggedInUser);

module.exports = router;