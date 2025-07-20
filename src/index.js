const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const config = require('./config');
const authRoutes = require('./routes/auth.routes');
const problemRoutes = require('./routes/problem.routes');
const submissionRoutes = require('./routes/submission.routes');
const forumRoutes = require('./routes/forum');
const cors = require('cors'); 
const { gracefulShutdown } = require('./services/queue.service');

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.clientOrigin,
  credentials: true
}));
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect(config.mongoURI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/forum', forumRoutes);

// Basic route for testing
app.get('/', (req, res) => {
  res.send([
    'AwlOJ API is running!',
    'fromlowngwithluv!',
    'iukhuenn&haanhh!'
  ].join('\n'));
});

const shutdown = async () => {
  console.log('Shutting down gracefully...');
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    await gracefulShutdown();
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

const server = app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('HTTP server closed.');
  });
});