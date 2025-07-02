require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  mongoURI: process.env.MONGO_URI,
  redisURL: process.env.REDIS_URL,
  jwtSecret: process.env.JWT_SECRET,
};