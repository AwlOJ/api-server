// This module now assumes that the main socket index file will initialize it.
// It requires the central 'io' instance to attach its listeners.
const io = require('../sockets'); 
const Contest = require('../models/Contest');
const StandingsService = require('../services/contest/standings.service');

// We listen for connections on the main 'io' instance.
// This assumes an authentication middleware has already run and attached `socket.user`.
io.on('connection', (socket) => {
  // A user is only identified if the auth middleware was successful.
  const userId = socket.user?.userId;

  socket.on('join_contest', async (contestId) => {
    try {
      const contest = await Contest.findById(contestId).lean(); // Use .lean() for read-only operation

      if (!contest) {
        return socket.emit('contest_error', { message: 'Contest not found' });
      }

      // --- AUTHORIZATION LOGIC ---
      // Determine if the current user has the right to view this contest's real-time data.
      const isCreator = contest.createdBy.toString() === userId;
      const isParticipant = userId ? contest.participants.some(p => p.user.toString() === userId) : false;
      
      let canJoin = false;
      if (contest.type === 'public' && contest.isPublished) {
        canJoin = true; // Anyone can join a published public contest.
      } else if (isCreator) {
        canJoin = true; // The creator can always join.
      } else if (contest.type === 'private' && isParticipant) {
        canJoin = true; // A registered participant can join a private contest.
      }

      if (!canJoin) {
        return socket.emit('contest_error', { message: 'You are not authorized to join this contest' });
      }

      // If authorized, proceed to join the room.
      socket.join(`contest_${contestId}`);
      console.log(`Socket ${socket.id} (User: ${userId || 'Guest'}) joined contest ${contestId}`);
      
      // Send current standings upon joining.
      const standings = await StandingsService.getStandings(contestId, { limit: 50 });
      socket.emit('standings_update', {
        contestId,
        ...standings
      });

    } catch (error) {
      console.error(`Error joining contest ${contestId} for socket ${socket.id}:`, error);
      socket.emit('contest_error', { message: 'Failed to join contest due to a server error' });
    }
  });
    
  socket.on('leave_contest', (contestId) => {
    socket.leave(`contest_${contestId}`);
    console.log(`Socket ${socket.id} left contest ${contestId}`);
  });
    
  // A user should only be able to subscribe to their own submission.
  socket.on('subscribe_submission', (submissionId) => {
    // In a real scenario, you'd verify that socket.user.userId owns this submission
    // before allowing them to join the room.
    socket.join(`submission_${submissionId}`);
  });
});

// This file no longer exports a function. It's self-executing when required.
// We export a simple object or nothing at all, just to conform to module standards.
module.exports = {};
