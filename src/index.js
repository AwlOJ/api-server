const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const config = require('./config');
const authRoutes = require('./routes/auth.routes');
const problemRoutes = require('./routes/problem.routes');
const submissionRoutes = require('./routes/submission.routes');
const forumRoutes = require('./routes/forum'); // Updated path
const cors = require('cors'); 

const app = express();

// Middleware

app.use(helmet()); // Add security headers
app.use(cors({
  origin: config.clientOrigin,
  credentials: true
}));

app.use(bodyParser.json());


// Connect to MongoDB
mongoose.connect(config.mongoURI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

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


// Start the server
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
