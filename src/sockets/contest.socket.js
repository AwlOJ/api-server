const Contest = require('../models/Contest');
const StandingsService = require('../services/contest/standings.service');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Join contest room
    socket.on('join_contest', async (contestId) => {
      try {
        const contest = await Contest.findById(contestId);
        if (contest) {
          socket.join(`contest_${contestId}`);
          console.log(`Socket ${socket.id} joined contest ${contestId}`);
          
          // Send current standings
          const standings = await StandingsService.getStandings(contestId, { limit: 50 });
          socket.emit('standings_update', {
            contestId,
            ...standings
          });
        }
      } catch (error) {
        console.error('Error joining contest:', error);
        socket.emit('error', { message: 'Failed to join contest' });
      }
    });
    
    // Leave contest room
    socket.on('leave_contest', (contestId) => {
      socket.leave(`contest_${contestId}`);
      console.log(`Socket ${socket.id} left contest ${contestId}`);
    });
    
    // Subscribe to submission updates
    socket.on('subscribe_submission', (submissionId) => {
      socket.join(`submission_${submissionId}`);
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
};