const jwt = require('jsonwebtoken');
const config = require('../config');

const auth = (req, res, next) => {
  const token = req.header('x-auth-token');

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.userId = decoded.userId; // Set req.userId from the token payload
    req.user = decoded; // Keep req.user for consistency if other parts of the app rely on it
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: You do not have access to this resource' });
    }
    next();
  };
};

module.exports = {
  auth,
  authorize
};