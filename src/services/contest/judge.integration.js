const ContestSubmission = require('../../models/ContestSubmission');
const StandingsService = require('./standings.service');
const mongoose = require('mongoose');

class JudgeIntegration {
  constructor() {
    this.redis = require('ioredis').createClient(process.env.REDIS_URL);
    this.processingSubmissions = new Set();
  }

  async handleJudgeResult(submissionId, result) {
    console.log(`[JudgeIntegration] Received result for submissionId: ${submissionId}`, result); // DEBUG
    const lockKey = `judge_lock:${submissionId}`;
    const lockValue = `${Date.now()}_${Math.random()}`;
    
    try {
      const lockAcquired = await this.redis.set(
        lockKey, 
        lockValue, 
        'EX', 30, 'NX'
      );
      
      if (!lockAcquired) {
        console.log(`[JudgeIntegration] Lock not acquired for ${submissionId}, already processing.`);
        return;
      }

      if (this.processingSubmissions.has(submissionId)) {
        console.log(`[JudgeIntegration] Duplicate processing detected for ${submissionId}.`);
        return;
      }
      this.processingSubmissions.add(submissionId);

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const contestSubmission = await ContestSubmission.findOne({
          submission: submissionId
        })
        .populate('contest')
        .populate('user', 'username')
        .session(session);
        
        if (!contestSubmission) {
          console.log(`[JudgeIntegration] No contest submission found for submission ${submissionId}. This might be a regular submission.`);
          await session.abortTransaction(); // Abort transaction if no contest submission found
          return;
        }
        console.log(`[JudgeIntegration] Found contest submission: ${contestSubmission._id}`); // DEBUG

        const now = new Date();
        const contest = contestSubmission.contest;
        const graceEndTime = new Date(contest.endTime.getTime() + 5 * 60 * 1000);
        
        if (now > graceEndTime) {
          console.log(`[JudgeIntegration] Contest ${contest._id} ended, ignoring late judge result.`);
          await session.abortTransaction();
          return;
        }
        
        if (contestSubmission.isProcessed) {
          console.log(`[JudgeIntegration] Contest submission ${contestSubmission._id} already processed.`);
          await session.abortTransaction();
          return;
        }
        
        const updateData = {
          isProcessed: true,
          processedAt: new Date(),
          judgeResult: result
        };
        
        if (result.status === 'Accepted') {
          updateData.isAccepted = true;
          
          const problemConfig = contest.problems.find(
            p => p.problem.toString() === contestSubmission.problem.toString()
          );
          
          if (contest.scoringSystem === 'IOI') {
            updateData.points = problemConfig?.points || 100;
          } else if (contest.scoringSystem === 'ICPC') {
            updateData.points = 1;
          } else if (contest.scoringSystem === 'AtCoder') {
            updateData.points = problemConfig?.points || 100;
          }
          
          if (contest.scoringSystem === 'ICPC') {
            const wrongAttempts = contestSubmission.attemptNumber - 1;
            updateData.penalty = contestSubmission.submissionTime + 
              (wrongAttempts * contest.settings.penaltyPerWrongSubmission);
          } else if (contest.scoringSystem === 'AtCoder') {
            const wrongAttempts = contestSubmission.attemptNumber - 1;
            updateData.penalty = contestSubmission.submissionTime + (wrongAttempts * 5);
          } else {
            updateData.penalty = 0;
          }
        } else {
          updateData.isAccepted = false;
          updateData.points = 0;
          updateData.penalty = 0;
        }
        
        console.log(`[JudgeIntegration] Preparing to update ContestSubmission ${contestSubmission._id} with data:`, updateData); // DEBUG

        const updatedSubmission = await ContestSubmission.findByIdAndUpdate(
          contestSubmission._id,
          updateData,
          { session, new: true }
        );
        
        console.log(`[JudgeIntegration] Successfully updated ContestSubmission:`, updatedSubmission); // DEBUG

        await session.commitTransaction();
        
        await this.updateContestStats(contest._id, result.status === 'Accepted');
        
        setImmediate(async () => {
          try {
            await StandingsService.updateStandings(contest._id, result);
          } catch (error) {
            console.error('[JudgeIntegration] Error updating standings:', error);
          }
        });
        
        await this.emitSubmissionUpdate(submissionId, contestSubmission, updateData, result);
        
        await this.handleAchievements(contestSubmission, updateData, contest);
        
      } catch (error) {
        await session.abortTransaction();
        throw error; // Re-throw to be caught by outer catch block
      } finally {
        session.endSession();
      }
      
    } catch (error) {
      console.error('[JudgeIntegration] Error handling judge result for contest:', error);
      
      await this.redis.lpush(
        `failed_judge_results:${new Date().toISOString().split('T')[0]}`,
        JSON.stringify({ submissionId, result, error: error.message, timestamp: new Date() })
      );
      
    } finally {
      this.processingSubmissions.delete(submissionId);
      
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

  // ... rest of the file is the same
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

  async emitSubmissionUpdate(submissionId, contestSubmission, updateData, result) {
    try {
      const io = require('../../sockets');
      
      io.to(`submission_${submissionId}`).emit('submission_result', {
        submissionId,
        contestSubmissionId: contestSubmission._id,
        result,
        points: updateData.points,
        penalty: updateData.penalty,
        isAccepted: updateData.isAccepted,
        timestamp: new Date()
      });
      
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

  async handleAchievements(contestSubmission, updateData, contest) {
    if (!updateData.isAccepted) return;
    
    try {
      const firstAC = await ContestSubmission.findOne({
        contest: contest._id,
        problem: contestSubmission.problem,
        isAccepted: true,
        submissionTime: { $lt: contestSubmission.submissionTime }
      });
      
      if (!firstAC) {
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

  async retryFailedSubmissions(date) {
    try {
      const key = `failed_judge_results:${date}`;
      const failedResults = await this.redis.lrange(key, 0, -1);
      
      for (const resultStr of failedResults) {
        const { submissionId, result } = JSON.parse(resultStr);
        console.log(`Retrying failed submission: ${submissionId}`);
        
        setTimeout(() => {
          this.handleJudgeResult(submissionId, result);
        }, Math.random() * 5000);
      }
      
    } catch (error) {
      console.error('Error retrying failed submissions:', error);
    }
  }
}

const judgeIntegration = new JudgeIntegration();

module.exports = {
  handleJudgeResult: judgeIntegration.handleJudgeResult.bind(judgeIntegration),
  cleanupFailedResults: judgeIntegration.cleanupFailedResults.bind(judgeIntegration),
  retryFailedSubmissions: judgeIntegration.retryFailedSubmissions.bind(judgeIntegration)
};