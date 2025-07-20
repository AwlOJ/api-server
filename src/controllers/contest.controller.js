const Contest = require('../models/Contest');
const Problem = require('../models/Problem');
const ContestSubmission = require('../models/ContestSubmission');
const Standings = require('../models/Standings');
const StandingsService = require('../services/contest/standings.service');

// GET /api/contests
const getContests = async (req, res) => {
  try {
    const { status = 'all', page = 1, limit = 20 } = req.query;
    const now = new Date();
    
    let filter = { isVisible: true };
    
    if (status === 'upcoming') {
      filter.startTime = { $gt: now };
    } else if (status === 'running') {
      filter.startTime = { $lte: now };
      filter.endTime = { $gt: now };
    } else if (status === 'ended') {
      filter.endTime = { $lte: now };
    }
    
    const contests = await Contest.find(filter)
      .populate('createdBy', 'username')
      .populate('problems.problem', 'title difficulty')
      .sort({ startTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Contest.countDocuments(filter);
    
    // Add virtual fields
    const contestsWithStatus = contests.map(contest => ({
      ...contest.toObject(),
      status: contest.status,
      timeLeft: contest.timeLeft,
      participantCount: contest.participants.length
    }));
    
    res.json({
      success: true,
      data: {
        contests: contestsWithStatus,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /api/contests/:id
const getContest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    
    const contest = await Contest.findById(id)
      .populate('createdBy', 'username')
      .populate('problems.problem', 'title description difficulty timeLimit memoryLimit');
    
    if (!contest) {
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }
    
    // Check if user is registered
    const isRegistered = userId ? 
      contest.participants.some(p => p.user.toString() === userId) : false;
    
    // Hide problem details if contest hasn't started (unless user is creator)
    let contestData = contest.toObject();
    if (contest.status === 'upcoming' && contest.createdBy._id.toString() !== userId) {
      contestData.problems = contestData.problems.map(p => ({
        label: p.label,
        points: p.points,
        problem: {
          _id: p.problem._id,
          title: p.problem.title,
          difficulty: p.problem.difficulty
        }
      }));
    }
    
    res.json({
      success: true,
      data: {
        ...contestData,
        status: contest.status,
        timeLeft: contest.timeLeft,
        isRegistered,
        participantCount: contest.participants.length
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /api/contests
const createContest = async (req, res) => {
  try {
    const {
      title,
      description,
      startTime,
      endTime,
      problems, // [{ problemId, label, points }]
      type,
      scoringSystem,
      allowedLanguages,
      maxSubmissions,
      freezeTime,
      isRated,
      settings
    } = req.body;
    
    const createdBy = req.user.userId;
    
    // Validate times
    const start = new Date(startTime);
    const end = new Date(endTime);
    const duration = Math.floor((end - start) / (1000 * 60)); // minutes
    
    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'End time must be after start time'
      });
    }
    
    if (start <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Start time must be in the future'
      });
    }
    
    // Validate problems exist
    const problemIds = problems.map(p => p.problemId);
    const foundProblems = await Problem.find({ _id: { $in: problemIds } });
    
    if (foundProblems.length !== problemIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some problems not found'
      });
    }
    
    // Create contest
    const contest = new Contest({
      title,
      description,
      startTime: start,
      endTime: end,
      duration,
      problems: problems.map(p => ({
        problem: p.problemId,
        label: p.label,
        points: p.points || 100
      })),
      type,
      scoringSystem,
      allowedLanguages,
      maxSubmissions,
      freezeTime,
      isRated,
      settings,
      createdBy
    });
    
    await contest.save();
    
    // Initialize standings
    const standings = new Standings({
      contest: contest._id,
      rankings: []
    });
    await standings.save();
    
    await contest.populate('problems.problem', 'title difficulty');
    
    res.status(201).json({
      success: true,
      data: contest
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /api/contests/:id/register
const registerForContest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const contest = await Contest.findById(id);
    if (!contest) {
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }
    
    // Check if contest is still open for registration
    if (contest.status === 'ended') {
      return res.status(400).json({
        success: false,
        message: 'Contest has already ended'
      });
    }
    
    // Check if already registered
    const isAlreadyRegistered = contest.participants.some(
      p => p.user.toString() === userId
    );
    
    if (isAlreadyRegistered) {
      return res.status(400).json({
        success: false,
        message: 'Already registered for this contest'
      });
    }
    
    // Add participant
    contest.participants.push({
      user: userId,
      registeredAt: new Date()
    });
    
    await contest.save();
    
    res.json({
      success: true,
      message: 'Successfully registered for contest'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /api/contests/:id/standings
const getStandings = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const contest = await Contest.findById(id);
    if (!contest) {
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }
    
    const standings = await StandingsService.getStandings(id, {
      page: parseInt(page),
      limit: parseInt(limit),
      isFrozen: contest.status === 'running' && contest.freezeTime > 0
    });
    
    res.json({
      success: true,
      data: standings
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /api/contests/:id/submit
const submitToContest = async (req, res) => {
  try {
    const { id } = req.params;
    const { problemLabel, code, language } = req.body;
    const userId = req.user.userId;
    
    const contest = await Contest.findById(id).populate('problems.problem');
    if (!contest) {
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }
    
    // Check contest status
    if (contest.status !== 'running') {
      return res.status(400).json({
        success: false,
        message: contest.status === 'upcoming' ? 'Contest has not started' : 'Contest has ended'
      });
    }
    
    // Check if user is registered
    const isRegistered = contest.participants.some(p => p.user.toString() === userId);
    if (!isRegistered) {
      return res.status(400).json({
        success: false,
        message: 'Not registered for this contest'
      });
    }
    
    // Find problem by label
    const contestProblem = contest.problems.find(p => p.label === problemLabel);
    if (!contestProblem) {
      return res.status(400).json({
        success: false,
        message: 'Problem not found in contest'
      });
    }
    
    // Check language restriction
    if (contest.allowedLanguages.length > 0 && !contest.allowedLanguages.includes(language)) {
      return res.status(400).json({
        success: false,
        message: 'Language not allowed in this contest'
      });
    }
    
    // Check submission limit
    if (contest.maxSubmissions > 0) {
      const userSubmissions = await ContestSubmission.countDocuments({
        contest: id,
        user: userId,
        problem: contestProblem.problem._id
      });
      
      if (userSubmissions >= contest.maxSubmissions) {
        return res.status(400).json({
          success: false,
          message: `Maximum ${contest.maxSubmissions} submissions allowed per problem`
        });
      }
    }
    
    // Create regular submission first
    const Submission = require('../models/Submission');
    const { addSubmissionJob } = require('../services/queue.service');
    
    const submission = new Submission({
      userId,
      problemId: contestProblem.problem._id,
      code,
      language,
      status: 'In Queue'
    });
    
    await submission.save();
    await addSubmissionJob(submission._id);
    
    // Calculate submission time
    const submissionTime = Math.floor((new Date() - contest.startTime) / (1000 * 60));
    
    // Get attempt number
    const attemptNumber = await ContestSubmission.countDocuments({
      contest: id,
      user: userId,
      problem: contestProblem.problem._id
    }) + 1;
    
    // Create contest submission
    const contestSubmission = new ContestSubmission({
      contest: id,
      user: userId,
      problem: contestProblem.problem._id,
      problemLabel,
      submission: submission._id,
      submissionTime,
      attemptNumber
    });
    
    await contestSubmission.save();
    
    res.status(202).json({
      success: true,
      data: {
        submissionId: submission._id,
        contestSubmissionId: contestSubmission._id,
        submissionTime,
        attemptNumber
      },
      message: 'Submission received and queued for judging'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = {
  getContests,
  getContest,
  createContest,
  registerForContest,
  getStandings,
  submitToContest
};