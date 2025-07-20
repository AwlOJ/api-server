const ContestSubmission = require('../../models/ContestSubmission');
const StandingsService = require('./standings.service');

// Function to be called when judge completes a submission
const handleJudgeResult = async (submissionId, result) => {
  try {
    // Find contest submission
    const contestSubmission = await ContestSubmission.findOne({
      submission: submissionId
    }).populate('contest');
    
    if (!contestSubmission) {
      return; // Not a contest submission
    }
    
    // Update contest submission with result
    if (result.status === 'Accepted') {
      contestSubmission.isAccepted = true;
      
      // Calculate points based on scoring system
      if (contestSubmission.contest.scoringSystem === 'IOI') {
        const problemPoints = contestSubmission.contest.problems.find(
          p => p.problem.toString() === contestSubmission.problem.toString()
        )?.points || 100;
        contestSubmission.points = problemPoints;
      } else {
        contestSubmission.points = 1; // ICPC style
      }
      
      // Calculate penalty
      if (contestSubmission.contest.scoringSystem === 'ICPC') {
        const wrongAttempts = contestSubmission.attemptNumber - 1;
        contestSubmission.penalty = contestSubmission.submissionTime + 
          (wrongAttempts * contestSubmission.contest.settings.penaltyPerWrongSubmission);
      }
    }
    
    await contestSubmission.save();
    
    // Update standings
    await StandingsService.updateStandings(contestSubmission.contest._id, result);
    
    // Emit real-time update to submission subscriber
    const io = require('../../sockets');
    io.to(`submission_${submissionId}`).emit('submission_result', {
      submissionId,
      contestSubmissionId: contestSubmission._id,
      result,
      points: contestSubmission.points,
      penalty: contestSubmission.penalty
    });
    
  } catch (error) {
    console.error('Error handling judge result for contest:', error);
  }
};

module.exports = {
  handleJudgeResult
};
