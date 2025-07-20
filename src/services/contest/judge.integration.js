const ContestSubmission = require('../../models/ContestSubmission');
const StandingsService = require('./standings.service');
const mongoose = require('mongoose');

// ✅ Distributed lock for handling concurrent judge results
class JudgeIntegration {
  constructor() {
    this.redis = require('ioredis').createClient(process.env.REDIS_URL);
    this.processingSubmissions = new Set();
  }

  // ✅ Main handler with proper locking and error handling
  async handleJudgeResult(submissionId, result) {
    const lockKey = `judge_lock:${submissionId}`;
    const lockValue = `${Date.now()}_${Math.random()}`;
    
    try {
      // ✅ Acquire distributed lock
      const lockAcquired = await this.redis.set(
        lockKey, 
        lockValue, 
        'EX', 30, 'NX' // 30 second expiry, only if not exists
      );
      
      if (!lockAcquired) {
        console.log(`Judge result for submission ${submissionId} already being processed`);
        return;
      }

      // ✅ Prevent duplicate processing
      if (this.processingSubmissions.has(submissionId)) {
        return;
      }
      this.processingSubmissions.add(submissionId);

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Find contest submission with proper population
        const contestSubmission = await ContestSubmission.findOne({
          submission: submissionId
        })
        .populate('contest')
        .populate('user', 'username')
        .session(session);
        
        if (!contestSubmission) {
          console.log(`No contest submission found for submission ${submissionId}`);
          return; // Not a contest submission, normal behavior
        }
        
        // ✅ Validate contest is still active or in grace period
        const now = new Date();
        const contest = contestSubmission.contest;
        const graceEndTime = new Date(contest.endTime.getTime() + 5 * 60 * 1000); // 5 min grace
        
        if (now > graceEndTime) {
          console.log(`Contest ${contest._id} ended, ignoring late judge result`);
          return;
        }
        
        // ✅ Prevent double processing of same result
        if (contestSubmission.isProcessed) {
          console.log(`Contest submission ${contestSubmission._id} already processed`);
          return;
        }
        
        // ✅ Update contest submission with detailed result tracking
        const updateData = {
          isProcessed: true,
          processedAt: new Date(),
          judgeResult: result
        };
        
        if (result.status === 'Accepted') {
          updateData.isAccepted = true;
          
          // ✅ Calculate points based on scoring system
          const problemConfig = contest.problems.find(
            p => p.problem.toString() === contestSubmission.problem.toString()
          );
          
          if (contest.scoringSystem === 'IOI') {
            updateData.points = problemConfig?.points || 100;
          } else if (contest.scoringSystem === 'ICPC') {
            updateData.points = 1;
          } else if (contest.scoringSystem === 'AtCoder') {
            // AtCoder scoring with time penalty
            updateData.points = problemConfig?.points || 100;
          }
          
          // ✅ Calculate penalty based on scoring system
          if (contest.scoringSystem === 'ICPC') {
            const wrongAttempts = contestSubmission.attemptNumber - 1;
            updateData.penalty = contestSubmission.submissionTime + 
              (wrongAttempts * contest.settings.penaltyPerWrongSubmission);
          } else if (contest.scoringSystem === 'AtCoder') {
            const wrongAttempts = contestSubmission.attemptNumber - 1;
            updateData.penalty = contestSubmission.submissionTime + (wrongAttempts * 5);
          } else {
            updateData.penalty = 0; // IOI typically no penalty
          }
        } else {
          updateData.isAccepted = false;
          updateData.points = 0;
          updateData.penalty = 0;
        }
        
        // ✅ Update contest submission atomically
        await ContestSubmission.findByIdAndUpdate(
          contestSubmission._id,
          updateData,
          { session, new: true }
        );
        
        await session.commitTransaction();
        
        // ✅ Update contest statistics
        await this.updateContestStats(contest._id, result.status === 'Accepted');
        
        // ✅ Update standings asynchronously to avoid blocking
        setImmediate(async () => {
          try {
            await StandingsService.updateStandings(contest._id, result);
          } catch (error) {
            console.error('Error updating standings:', error);
            // Don't throw here to avoid affecting the main flow
          }
        });
        
        // ✅ Emit real-time updates
        await this.emitSubmissionUpdate(submissionId, contestSubmission, updateData, result);
        
        // ✅ Handle special achievements (first AC, etc.)
        await this.handleAchievements(contestSubmission, updateData, contest);
        
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
      
    } catch (error) {
      console.error('Error handling judge result for contest:', error);
      
      // ✅ Dead letter queue for failed processing
      await this.redis.lpush(
        `failed_judge_results:${new Date().toISOString().split('T')[0]}`,
        JSON.stringify({ submissionId, result, error: error.message, timestamp: new Date() })
      );
      
    } finally {
      // ✅ Cleanup
      this.processingSubmissions.delete(submissionId);
      
      // Release lock only if we own it
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await this.redis.eval(script, 1, lockKey, lockValue);
    }
  }

  // ✅ Update contest statistics atomically
  async updateContestStats(contestId, isAccepted) {
    try {
      const updateQuery = { $inc: { totalSubmissions: 1 } };
      if (isAccepted) {
        updateQuery.$inc.acceptedSubmissions = 1;
      }
      
      await require('../../models/Contest').findByIdAndUpdate(contestId, updateQuery);
    } catch (error) {
      console.error('Error updating contest stats:', error);
    }
  }

  // ✅ Enhanced real-time emission with proper error handling
  async emitSubmissionUpdate(submissionId, contestSubmission, updateData, result) {
    try {
      const io = require('../../sockets');
      
      // Emit to submission subscriber
      io.to(`submission_${submissionId}`).emit('submission_result', {
        submissionId,
        contestSubmissionId: contestSubmission._id,
        result,
        points: updateData.points,
        penalty: updateData.penalty,
        isAccepted: updateData.isAccepted,
        timestamp: new Date()
      });
      
      // Emit to contest room (limited info for privacy)
      io.to(`contest_${contestSubmission.contest._id}`).emit('contest_submission_update', {
        contestId: contestSubmission.contest._id,
        problemLabel: contestSubmission.problemLabel,
        username: contestSubmission.user.username,
        status: result.status,
        submissionTime: contestSubmission.submissionTime,
        isAccepted: updateData.isAccepted,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('Error emitting submission update:', error);
    }
  }

  // ✅ Handle special achievements and milestones
  async handleAchievements(contestSubmission, updateData, contest) {
    if (!updateData.isAccepted) return;
    
    try {
      // Check if this is the first AC for this problem
      const firstAC = await ContestSubmission.findOne({
        contest: contest._id,
        problem: contestSubmission.problem,
        isAccepted: true,
        submissionTime: { $lt: contestSubmission.submissionTime }
      });
      
      if (!firstAC) {
        // This is first AC for this problem!
        const io = require('../../sockets');
        io.to(`contest_${contest._id}`).emit('first_blood', {
          contestId: contest._id,
          problemLabel: contestSubmission.problemLabel,
          username: contestSubmission.user.username,
          submissionTime: contestSubmission.submissionTime
        });
      }
      
    } catch (error) {
      console.error('Error handling achievements:', error);
    }
  }

  // ✅ Cleanup method for failed submissions
  async cleanupFailedResults(days = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const keys = await this.redis.keys(`failed_judge_results:*`);
      for (const key of keys) {
        const date = key.split(':')[1];
        if (new Date(date) < cutoffDate) {
          await this.redis.del(key);
        }
      }
    } catch (error) {
      console.error('Error cleaning up failed results:', error);
    }
  }

  // ✅ Retry failed submissions
  async retryFailedSubmissions(date) {
    try {
      const key = `failed_judge_results:${date}`;
      const failedResults = await this.redis.lrange(key, 0, -1);
      
      for (const resultStr of failedResults) {
        const { submissionId, result } = JSON.parse(resultStr);
        console.log(`Retrying failed submission: ${submissionId}`);
        
        // Retry with exponential backoff
        setTimeout(() => {
          this.handleJudgeResult(submissionId, result);
        }, Math.random() * 5000); // Random delay 0-5 seconds
      }
      
    } catch (error) {
      console.error('Error retrying failed submissions:', error);
    }
  }
}

const judgeIntegration = new JudgeIntegration();

// ✅ Export the enhanced handler
module.exports = {
  handleJudgeResult: judgeIntegration.handleJudgeResult.bind(judgeIntegration),
  cleanupFailedResults: judgeIntegration.cleanupFailedResults.bind(judgeIntegration),
  retryFailedSubmissions: judgeIntegration.retryFailedSubmissions.bind(judgeIntegration)
};