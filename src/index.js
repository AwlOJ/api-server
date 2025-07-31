const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const config = require('./config');
const authRoutes = require('./routes/auth.routes');
const problemRoutes = require('./routes/problem.routes');
const submissionRoutes = require('./routes/submission.routes');
const contestRoutes = require('./routes/contest.routes');
const forumRoutes = require('./routes/forum');
const internalRoutes = require('./routes/internal.routes'); // Import internal routes
const cors = require('cors');
const { gracefulShutdown: queueGracefulShutdown } = require('./services/queue.service');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: config.clientOrigin,
    credentials: true
  }
});

// Make io instance available to routes
app.set('io', io);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Join rooms based on subscription
  socket.on('subscribe_submission', (submissionId) => {
    socket.join(`submission_${submissionId}`);
  });
  
  socket.on('subscribe_contest', (contestId) => {
    socket.join(`contest_${contestId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.use(helmet());
app.use(cors({
  origin: config.clientOrigin,
  credentials: true
}));
app.use(bodyParser.json());

mongoose.connect(config.mongoURI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Setup routes
app.use('/api/auth', authRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/contests', contestRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/internal', internalRoutes); // Use internal routes

app.get('/', (req, res) => {
  res.send([
    'AwlOJ API is running!',
    'fromlowngwithluv!',
    'iukhuenn&haanhh!',
    'Contest system enabled!'
  ].join('\n'));
});

const serverInstance = server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

const shutdown = async () => {
  console.log('Shutting down gracefully...');
  try {
    serverInstance.close(() => {
        console.log('HTTP server closed.');
    });

    io.close();

    await mongoose.connection.close();
    console.log('MongoDB connection closed.');

    await queueGracefulShutdown();

  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};


process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
