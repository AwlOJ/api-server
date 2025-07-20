const Contest = require('../../models/Contest');
const ContestSubmission = require('../../models/ContestSubmission');
const Standings = require('../../models/Standings');
const User = require('../../models/User');

class StandingsService {
  // Calculate standings based on scoring system
  async calculateStandings(contestId) {
    const contest = await Contest.findById(contestId).populate('problems.problem');
    if (!contest) throw new Error('Contest not found');
    
    // Get all contest submissions
    const submissions = await ContestSubmission.find({ contest: contestId })
      .populate('user', 'username')
      .populate('submission', 'status executionTime')
      .sort({ submissionTime: 1 });
    
    // Group by user
    const userSubmissions = {};
    submissions.forEach(sub => {
      const userId = sub.user._id.toString();
      if (!userSubmissions[userId]) {
        userSubmissions[userId] = {
          user: sub.user,
          problems: {},
          totalScore: 0,
          totalPenalty: 0,
          totalSubmissions: 0,
          solvedProblems: 0
        };
      }
      
      const problemId = sub.problem.toString();
      if (!userSubmissions[userId].problems[problemId]) {
        userSubmissions[userId].problems[problemId] = {
          problemId,
          label: sub.problemLabel,
          attempts: 0,
          status: 'Not Attempted',
          score: 0,
          penalty: 0,
          solvedAt: null,
          submissionTime: null
        };
      }
      
      const problemData = userSubmissions[userId].problems[problemId];
      problemData.attempts++;
      userSubmissions[userId].totalSubmissions++;
      
      // Handle based on submission status
      if (sub.submission.status === 'Accepted' && problemData.status !== 'AC') {
        problemData.status = 'AC';
        problemData.solvedAt = sub.createdAt;
        problemData.submissionTime = sub.submissionTime;
        
        // Calculate score based on scoring system
        if (contest.scoringSystem === 'ICPC') {
          problemData.score = 1;
          problemData.penalty = sub.submissionTime + (problemData.attempts - 1) * contest.settings.penaltyPerWrongSubmission;
        } else if (contest.scoringSystem === 'IOI') {
          problemData.score = contest.problems.find(p => p.problem._id.toString() === problemId)?.points || 100;
          problemData.penalty = 0;
        }
        
        userSubmissions[userId].solvedProblems++;
      } else if (sub.submission.status !== 'Accepted' && problemData.status !== 'AC') {
        problemData.status = 'WA';
      }
    });
    
    // Calculate totals and rank
    const rankings = Object.values(userSubmissions).map(userData => {
      userData.totalScore = Object.values(userData.problems).reduce((sum, p) => sum + p.score, 0);
      userData.totalPenalty = Object.values(userData.problems).reduce((sum, p) => sum + p.penalty, 0);
      
      return {
        user: userData.user._id,
        username: userData.user.username,
        totalScore: userData.totalScore,
        totalPenalty: userData.totalPenalty,
        totalSubmissions: userData.totalSubmissions,
        solvedProblems: userData.solvedProblems,
        problems: Object.values(userData.problems)
      };
    });
    
    // Sort based on scoring system
    if (contest.scoringSystem === 'ICPC') {
      rankings.sort((a, b) => {
        if (a.solvedProblems !== b.solvedProblems) {
          return b.solvedProblems - a.solvedProblems;
        }
        return a.totalPenalty - b.totalPenalty;
      });
    } else {
      rankings.sort((a, b) => {
        if (a.totalScore !== b.totalScore) {
          return b.totalScore - a.totalScore;
        }
        return a.totalPenalty - b.totalPenalty;
      });
    }
    
    // Assign ranks
    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1;
    });
    
    return rankings;
  }
  
  // Update standings after submission
  async updateStandings(contestId, submissionResult) {
    try {
      const rankings = await this.calculateStandings(contestId);
      
      await Standings.findOneAndUpdate(
        { contest: contestId },
        {
          rankings,
          lastUpdated: new Date()
        },
        { upsert: true }
      );
      
      // Emit real-time update
      const io = require('../../sockets');
      io.to(`contest_${contestId}`).emit('standings_update', {
        contestId,
        rankings: rankings.slice(0, 50), // Send top 50
        lastUpdated: new Date()
      });
      
      return rankings;
    } catch (error) {
      console.error('Error updating standings:', error);
      throw error;
    }
  }
  
  // Get standings with pagination
  async getStandings(contestId, options = {}) {
    const { page = 1, limit = 50, isFrozen = false } = options;
    
    let standings = await Standings.findOne({ contest: contestId })
      .populate('rankings.user', 'username');
    
    if (!standings) {
      // Generate standings if not exists
      const rankings = await this.calculateStandings(contestId);
      standings = await Standings.create({
        contest: contestId,
        rankings
      });
      await standings.populate('rankings.user', 'username');
    }
    
    // Apply freeze if needed
    let rankings = standings.rankings;
    if (isFrozen) {
      const contest = await Contest.findById(contestId);
      const freezeStartTime = contest.endTime - (contest.freezeTime * 60 * 1000);
      
      // Hide submissions after freeze time
      rankings = rankings.map(ranking => ({
        ...ranking.toObject(),
        problems: ranking.problems.map(problem => {
          if (problem.solvedAt && problem.solvedAt > freezeStartTime) {
            return {
              ...problem,
              status: 'Pending',
              score: 0,
              penalty: 0
            };
          }
          return problem;
        })
      }));
    }
    
    // Pagination
    const total = rankings.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedRankings = rankings.slice(startIndex, endIndex);
    
    return {
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
  }
}

module.exports = new StandingsService();