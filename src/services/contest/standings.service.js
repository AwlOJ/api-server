const Contest = require('../../models/Contest');
const ContestSubmission = require('../../models/ContestSubmission');
const Standings = require('../../models/Standings');
const User = require('../../models/User');
const Redis = require('ioredis');

class StandingsService {
  constructor() {
    // ✅ Initialize Redis for caching
    this.redis = new Redis(process.env.REDIS_URL);
    this.CACHE_TTL = 300; // 5 minutes cache
  }

  // ✅ Optimized standings calculation with caching
  async calculateStandings(contestId) {
    const cacheKey = `standings:${contestId}`;
    
    try {
      // Check cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const contest = await Contest.findById(contestId).populate('problems.problem').lean();
      if (!contest) throw new Error('Contest not found');
      
      // ✅ Optimized query with aggregation pipeline
      const submissions = await ContestSubmission.aggregate([
        {
          $match: { contest: contestId }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $lookup: {
            from: 'submissions',
            localField: 'submission',
            foreignField: '_id',
            as: 'submission'
          }
        },
        {
          $unwind: '$user'
        },
        {
          $unwind: '$submission'
        },
        {
          $sort: { submissionTime: 1 }
        }
      ]);
      
      // ✅ Process submissions more efficiently
      const userResults = new Map();
      const problemMap = new Map(contest.problems.map(p => [p.problem._id.toString(), p]));
      
      for (const sub of submissions) {
        const userId = sub.user._id.toString();
        const problemId = sub.problem.toString();
        
        if (!userResults.has(userId)) {
          userResults.set(userId, {
            user: sub.user,
            problems: new Map(),
            totalScore: 0,
            totalPenalty: 0,
            totalSubmissions: 0,
            solvedProblems: 0,
            lastSubmissionTime: 0
          });
        }
        
        const userResult = userResults.get(userId);
        userResult.totalSubmissions++;
        userResult.lastSubmissionTime = Math.max(userResult.lastSubmissionTime, sub.submissionTime);
        
        if (!userResult.problems.has(problemId)) {
          const contestProblem = problemMap.get(problemId);
          userResult.problems.set(problemId, {
            problemId,
            label: sub.problemLabel,
            attempts: 0,
            status: 'Not Attempted',
            score: 0,
            penalty: 0,
            solvedAt: null,
            submissionTime: null,
            maxPoints: contestProblem?.points || 100
          });
        }
        
        const problemResult = userResult.problems.get(problemId);
        problemResult.attempts++;
        
        // ✅ Handle different scoring systems efficiently
        if (sub.submission.status === 'Accepted' && problemResult.status !== 'AC') {
          problemResult.status = 'AC';
          problemResult.solvedAt = sub.createdAt;
          problemResult.submissionTime = sub.submissionTime;
          
          // Calculate score and penalty based on scoring system
          const scoreResult = this.calculateProblemScore(
            contest.scoringSystem,
            problemResult,
            contest.settings.penaltyPerWrongSubmission
          );
          
          problemResult.score = scoreResult.score;
          problemResult.penalty = scoreResult.penalty;
          
          userResult.solvedProblems++;
        } else if (sub.submission.status !== 'Accepted' && problemResult.status !== 'AC') {
          problemResult.status = this.getStatusFromSubmission(sub.submission.status);
        }
      }
      
      // ✅ Calculate final scores and sort
      const rankings = Array.from(userResults.values()).map(userData => {
        userData.totalScore = 0;
        userData.totalPenalty = 0;
        
        for (const [, problem] of userData.problems) {
          userData.totalScore += problem.score;
          userData.totalPenalty += problem.penalty;
        }
        
        return {
          user: userData.user._id,
          username: userData.user.username,
          totalScore: userData.totalScore,
          totalPenalty: userData.totalPenalty,
          totalSubmissions: userData.totalSubmissions,
          solvedProblems: userData.solvedProblems,
          lastSubmissionTime: userData.lastSubmissionTime,
          problems: Array.from(userData.problems.values())
        };
      });
      
      // ✅ Sort based on scoring system
      this.sortRankings(rankings, contest.scoringSystem);
      
      // Assign ranks with tie handling
      this.assignRanks(rankings, contest.scoringSystem);
      
      // ✅ Cache results
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(rankings));
      
      return rankings;
    } catch (error) {
      console.error('Error calculating standings:', error);
      throw error;
    }
  }
  
  // ✅ Helper method for problem score calculation
  calculateProblemScore(scoringSystem, problemResult, penaltyPerWrong) {
    switch (scoringSystem) {
      case 'ICPC':
        return {
          score: 1,
          penalty: problemResult.submissionTime + 
                  (problemResult.attempts - 1) * penaltyPerWrong
        };
      case 'IOI':
        return {
          score: problemResult.maxPoints,
          penalty: 0
        };
      case 'AtCoder':
        // AtCoder style with time penalty
        return {
          score: problemResult.maxPoints,
          penalty: problemResult.submissionTime + 
                  (problemResult.attempts - 1) * 5 // 5 min penalty per wrong
        };
      default:
        return { score: 1, penalty: 0 };
    }
  }
  
  // ✅ Helper method for status mapping
  getStatusFromSubmission(status) {
    const statusMap = {
      'Wrong Answer': 'WA',
      'Time Limit Exceeded': 'TLE',
      'Memory Limit Exceeded': 'MLE',
      'Runtime Error': 'RE',
      'Compilation Error': 'CE',
      'Pending': 'Pending',
      'In Queue': 'Pending',
      'Judging': 'Pending'
    };
    return statusMap[status] || 'WA';
  }
  
  // ✅ Optimized sorting method
  sortRankings(rankings, scoringSystem) {
    rankings.sort((a, b) => {
      if (scoringSystem === 'ICPC') {
        // ICPC: More solved problems first, then less penalty
        if (a.solvedProblems !== b.solvedProblems) {
          return b.solvedProblems - a.solvedProblems;
        }
        if (a.totalPenalty !== b.totalPenalty) {
          return a.totalPenalty - b.totalPenalty;
        }
        return a.lastSubmissionTime - b.lastSubmissionTime;
      } else {
        // IOI/AtCoder: Higher score first, then less penalty
        if (a.totalScore !== b.totalScore) {
          return b.totalScore - a.totalScore;
        }
        if (a.totalPenalty !== b.totalPenalty) {
          return a.totalPenalty - b.totalPenalty;
        }
        return a.lastSubmissionTime - b.lastSubmissionTime;
      }
    });
  }
  
  // ✅ Assign ranks with proper tie handling
  assignRanks(rankings, scoringSystem) {
    let currentRank = 1;
    
    for (let i = 0; i < rankings.length; i++) {
      if (i > 0 && !this.areEqual(rankings[i], rankings[i-1], scoringSystem)) {
        currentRank = i + 1;
      }
      rankings[i].rank = currentRank;
    }
  }
  
  // ✅ Check if two rankings are equal for tie handling
  areEqual(a, b, scoringSystem) {
    if (scoringSystem === 'ICPC') {
      return a.solvedProblems === b.solvedProblems && a.totalPenalty === b.totalPenalty;
    } else {
      return a.totalScore === b.totalScore && a.totalPenalty === b.totalPenalty;
    }
  }
  
  // ✅ Optimized standings update with debouncing
  async updateStandings(contestId, submissionResult) {
    try {
      // ✅ Debounce updates to prevent too frequent recalculation
      const debounceKey = `standings_update:${contestId}`;
      const isUpdating = await this.redis.get(debounceKey);
      
      if (isUpdating) {
        // Queue this update for later
        await this.redis.lpush(`standings_queue:${contestId}`, JSON.stringify(submissionResult));
        return;
      }
      
      // Mark as updating
      await this.redis.setex(debounceKey, 10, '1'); // 10 second debounce
      
      const rankings = await this.calculateStandings(contestId);
      
      await Standings.findOneAndUpdate(
        { contest: contestId },
        {
          rankings,
          lastUpdated: new Date()
        },
        { upsert: true }
      );
      
      // ✅ Emit real-time update with limited data
      const io = require('../../sockets');
      io.to(`contest_${contestId}`).emit('standings_update', {
        contestId,
        rankings: rankings.slice(0, 100), // Send top 100 only
        lastUpdated: new Date(),
        totalParticipants: rankings.length
      });
      
      // Process any queued updates
      const queuedUpdates = await this.redis.lrange(`standings_queue:${contestId}`, 0, -1);
      if (queuedUpdates.length > 0) {
        await this.redis.del(`standings_queue:${contestId}`);
        await this.redis.del(debounceKey);
        // Recursively process if there were queued updates
        setTimeout(() => this.updateStandings(contestId, null), 1000);
      } else {
        await this.redis.del(debounceKey);
      }
      
      return rankings;
    } catch (error) {
      console.error('Error updating standings:', error);
      await this.redis.del(`standings_update:${contestId}`);
      throw error;
    }
  }
  
  // ✅ Get standings with enhanced caching and pagination
  async getStandings(contestId, options = {}) {
    const { page = 1, limit = 50, isFrozen = false } = options;
    
    try {
      const cacheKey = `standings_page:${contestId}:${page}:${limit}:${isFrozen}`;
      
      // Check cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      let standings = await Standings.findOne({ contest: contestId })
        .populate('rankings.user', 'username')
        .lean();
      
      if (!standings || !standings.rankings.length) {
        // Generate standings if not exists
        const rankings = await this.calculateStandings(contestId);
        standings = await Standings.findOneAndUpdate(
          { contest: contestId },
          { rankings, lastUpdated: new Date() },
          { upsert: true, new: true }
        ).populate('rankings.user', 'username').lean();
      }
      
      let rankings = standings.rankings;
      
      // ✅ Apply freeze if needed
      if (isFrozen) {
        const contest = await Contest.findById(contestId).lean();
        const freezeStartTime = new Date(contest.endTime.getTime() - (contest.freezeTime * 60 * 1000));
        
        rankings = rankings.map(ranking => ({
          ...ranking,
          problems: ranking.problems.map(problem => {
            if (problem.solvedAt && new Date(problem.solvedAt) > freezeStartTime) {
              return {
                ...problem,
                status: 'Frozen',
                score: 0,
                penalty: 0
              };
            }
            return problem;
          })
        }));
        
        // Recalculate totals after freeze
        rankings.forEach(ranking => {
          ranking.totalScore = ranking.problems.reduce((sum, p) => sum + p.score, 0);
          ranking.totalPenalty = ranking.problems.reduce((sum, p) => sum + p.penalty, 0);
          ranking.solvedProblems = ranking.problems.filter(p => p.status === 'AC').length;
        });
        
        // Re-sort after freeze
        this.sortRankings(rankings, contest.scoringSystem);
        this.assignRanks(rankings, contest.scoringSystem);
      }
      
      // ✅ Pagination
      const total = rankings.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedRankings = rankings.slice(startIndex, endIndex);
      
      const result = {
        rankings: paginatedRankings,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        lastUpdated: standings.lastUpdated,
        isFrozen
      };
      
      // Cache for 1 minute
      await this.redis.setex(cacheKey, 60, JSON.stringify(result));
      
      return result;
    } catch (error) {
      console.error('Error getting standings:', error);
      throw error;
    }
  }
  
  // ✅ Clear standings cache
  async clearStandingsCache(contestId) {
    const keys = await this.redis.keys(`standings*:${contestId}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

module.exports = new StandingsService();