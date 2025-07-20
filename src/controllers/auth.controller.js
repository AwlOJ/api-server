const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');

const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    let user = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    if (user) {
      const field = user.email === email ? 'email' : 'username';
      return res.status(400).json({ 
        message: `${field === 'email' ? 'Email' : 'Username'} already exists` 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user = new User({
      username,
      email,
      password: hashedPassword,
    });

    await user.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
/*
// ADD: Password validation function
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  
  if (password.length < minLength) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!hasUpperCase) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!hasLowerCase) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!hasNumbers) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  
  return { valid: true };
};

const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // ✅ ADD: Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        message: passwordValidation.message 
      });
    }

    // ✅ ADD: Check username uniqueness
    let user = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    if (user) {
      const field = user.email === email ? 'email' : 'username';
      return res.status(400).json({ 
        message: `${field === 'email' ? 'Email' : 'Username'} already exists` 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12); // ✅ Increase salt rounds

    const user = new User({
      username,
      email,
      password: hashedPassword,
    });

    await user.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};*/

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, config.jwtSecret, {
      expiresIn: '1h'
    });

    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getLoggedInUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password'); // Exclude password from the response
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  signup,
  login,
  getLoggedInUser,
};