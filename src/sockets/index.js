const contestSocket = require('./contest.socket');

module.exports = (io) => {
  // Contest-related socket events
  contestSocket(io);
  
  // You can add more socket modules here
  // submissionSocket(io);
  // chatSocket(io);
};