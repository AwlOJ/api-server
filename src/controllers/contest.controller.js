const Contest = require('../models/Contest');
const Problem = require('../models/Problem');
const Submission = require('../models/Submission');
const ContestSubmission = require('../models/ContestSubmission');
const Standings = require('../models/Standings');
const StandingsService = require('../services/contest/standings.service');
const mongoose = require('mongoose');
const { addSubmissionJob } = require('../services/queue.service');

// GET /api/contests
const getContests = async (req, res) => {
  try {
    const { status = 'all', page = 1, limit = 20, type = 'all' } = req.query;
    const now = new Date();
    
    let filter = { isVisible: true, isPublished: true }; // ✅ Only show published contests
    
    // ✅ Improved status filtering
    switch (status) {
      case 'upcoming':
        filter.startTime = { $gt: now };
        break;
      case 'running':
        filter.startTime = { $lte: now };
        filter.endTime = { $gt: now };
        break;
      case 'ended':
        filter.endTime = { $lte: now };
        break;
      case 'registering':
        filter.registrationDeadline = { $gt: now };
        filter.startTime = { $gt: now };
        break;
    }
    
    // ✅ Contest type filtering
    if (type !== 'all') {
      filter.type = type;
    }
    
    const contests = await Contest.find(filter)
      .populate('createdBy', 'username')
      .populate('problems.problem', 'title difficulty')
      .sort({ startTime: status === 'ended' ? -1 : 1 }) // ✅ Different sorting for ended contests
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean(); // ✅ Use lean() for better performance
    
    const total = await Contest.countDocuments(filter);
    
    // ✅ Add computed fields more efficiently
    const contestsWithStatus = contests.map(contest => {
      const contestObj = {
        ...contest,
        participantCount: contest.participants?.length || 0,
        problemCount: contest.problems?.length || 0
      };
      
      // Calculate status
      if (now < contest.startTime) {
        contestObj.status = 'upcoming';
        contestObj.timeLeft = contest.startTime - now;
      } else if (now <= contest.endTime) {
        contestObj.status = 'running';
        contestObj.timeLeft = contest.endTime - now;
      } else {
        contestObj.status = 'ended';
        contestObj.timeLeft = 0;
      }
      
      return contestObj;
    });
    
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
    console.error('Get contests error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /api/contests/:id
const getContest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    
    // ✅ Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid contest ID' });
    }
    
    const contest = await Contest.findById(id)
      .populate('createdBy', 'username')
      .populate('problems.problem', 'title description difficulty timeLimit memoryLimit');
    
    if (!contest) {
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }
    
    // ✅ Check if user can access this contest
    if (!contest.isVisible && contest.createdBy._id.toString() !== userId) {
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }
    
    if (!contest.isPublished && contest.createdBy._id.toString() !== userId) {
      return res.status(404).json({ success: false, message: 'Contest not published yet' });
    }
    
    // Check if user is registered
    const isRegistered = userId ? contest.isParticipant(userId) : false;
    const isCreator = userId === contest.createdBy._id.toString();
    
    let contestData = contest.toObject();
    
    // ✅ Better access control for problem details
    const now = new Date();
    const contestStatus = now < contest.startTime ? 'upcoming' : 
                         now <= contest.endTime ? 'running' : 'ended';
    
    // Hide problem details if contest hasn't started and user is not creator/registered
    if (contestStatus === 'upcoming' && !isCreator && !isRegistered) {
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
    
    // ✅ Calculate derived fields
    contestData.status = contestStatus;
    contestData.timeLeft = contestStatus === 'upcoming' ? contest.startTime - now :
                          contestStatus === 'running' ? contest.endTime - now : 0;
    contestData.isRegistered = isRegistered;
    contestData.isCreator = isCreator;
    contestData.canRegister = contest.canRegister && !isRegistered;
    contestData.participantCount = contest.participants.length;
    
    // ✅ Hide sensitive information
    if (!isCreator) {
      delete contestData.password;
      delete contestData.createdBy.email;
    }
    
    res.json({
      success: true,
      data: contestData
    });
  } catch (error) {
    console.error('Get contest error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /api/contests
const createContest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const {
      title,
      description,
      startTime,
      endTime,
      problems, // [{ problemId, label, points }]
      type = 'public',
      scoringSystem = 'ICPC',
      allowedLanguages = ['cpp', 'java', 'python'],
      maxSubmissions = 0,
      freezeTime = 60,
      isRated = false,
      settings = {},
      password,
      registrationDeadline
    } = req.body;
    
    const createdBy = req.user.userId;
    
    // ✅ Enhanced validation
    const start = new Date(startTime);
    const end = new Date(endTime);
    const regDeadline = registrationDeadline ? new Date(registrationDeadline) : start;
    
    if (start <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Start time must be in the future'
      });
    }
    
    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: 'End time must be after start time'
      });
    }
    
    if (regDeadline > start) {
      return res.status(400).json({
        success: false,
        message: 'Registration deadline cannot be after contest start'
      });
    }
    
    const duration = Math.floor((end - start) / (1000 * 60));
    if (duration < 30) {
      return res.status(400).json({
        success: false,
        message: 'Contest must be at least 30 minutes long'
      });
    }
    
    // ✅ Validate problems exist and labels are unique
    const problemIds = problems.map(p => p.problemId);
    const labels = problems.map(p => p.label);
    
    if (new Set(labels).size !== labels.length) {
      return res.status(400).json({
        success: false,
        message: 'Problem labels must be unique'
      });
    }
    
    const foundProblems = await Problem.find({ _id: { $in: problemIds } }).session(session);
    if (foundProblems.length !== problemIds.length) {
      throw new Error('Some problems not found');
    }
    
    // ✅ Enhanced settings with defaults
    const contestSettings = {
      showOthersCode: false,
      allowClarifications: true,
      penaltyPerWrongSubmission: 20,
      enablePlagiarismCheck: true,
      autoPublishResults: true,
      ...settings
    };
    
    // Create contest
    const contest = new Contest({
      title,
      description,
      startTime: start,
      endTime: end,
      duration,
      problems: problems.map(p => ({
        problem: p.problemId,
        label: p.label.toUpperCase(),
        points: p.points || (scoringSystem === 'IOI' ? 100 : 1)
      })),
      type,
      scoringSystem,
      allowedLanguages,
      maxSubmissions,
      freezeTime,
      isRated,
      settings: contestSettings,
      createdBy,
      password: type === 'private' ? password : undefined,
      registrationDeadline: regDeadline,
      isPublished: false // ✅ Start as draft
    });
    
    await contest.save({ session });
    
    // ✅ Initialize standings
    const standings = new Standings({
      contest: contest._id,
      rankings: []
    });
    await standings.save({ session });
    
    await session.commitTransaction();
    
    await contest.populate('problems.problem', 'title difficulty');
    
    res.status(201).json({
      success: true,
      data: contest,
      message: 'Contest created successfully. Remember to publish it when ready.'
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Create contest error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server Error' 
    });
  } finally {
    session.endSession();
  }
};

// POST /api/contests/:id/register
const registerForContest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { password } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid contest ID' });
    }
    
    const contest = await Contest.findById(id);
    if (!contest) {
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }
    
    // ✅ Enhanced validation
    if (!contest.isVisible || !contest.isPublished) {
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }
    
    if (!contest.canRegister) {
      return res.status(400).json({
        success: false,
        message: 'Registration is closed for this contest'
      });
    }
    
    if (contest.isParticipant(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Already registered for this contest'
      });
    }
    
    // ✅ Check password for private contests
    if (contest.type === 'private' && contest.password !== password) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect contest password'
      });
    }
    
    // ✅ Use the model method
    await contest.addParticipant(userId);
    
    res.json({
      success: true,
      message: 'Successfully registered for contest'
    });
  } catch (error) {
    console.error('Register for contest error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server Error' 
    });
  }
};

// ✅ Add publish contest endpoint
const publishContest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const contest = await Contest.findById(id);
    if (!contest) {
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }
    
    if (contest.createdBy.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    if (contest.isPublished) {
      return res.status(400).json({ success: false, message: 'Contest already published' });
    }
    
    contest.isPublished = true;
    await contest.save();
    
    res.json({
      success: true,
      message: 'Contest published successfully'
    });
  } catch (error) {
    console.error('Publish contest error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ✅ Rest of the methods remain similar but with better error handling...
// (submitToContest, getStandings methods would follow similar patterns)

const submitToContest = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    
    const { id: contestId } = req.params;
    const { problemLabel, code, language } = req.body;
    const userId = req.user.userId;
    
    // ✅ Validate contest and get problem details
    const contest = await Contest.findById(contestId)
      .populate('problems.problem')
      .session(session);
    
    if (!contest || !contest.isVisible || !contest.isPublished) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Contest not found'
      });
    }
    
    // ✅ Check contest timing
    const now = new Date();
    if (now < contest.startTime) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Contest has not started yet'
      });
    }
    
    if (now > contest.endTime) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Contest has ended'
      });
    }
    
    // ✅ Check if user is registered
    if (!contest.isParticipant(userId)) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'You are not registered for this contest'
      });
    }
    
    // ✅ Find the problem by label
    const contestProblem = contest.problems.find(p => p.label === problemLabel);
    if (!contestProblem) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Problem not found in this contest'
      });
    }
    
    const problem = contestProblem.problem;
    
    // ✅ Check submission limits
    if (contest.maxSubmissions > 0) {
      const submissionCount = await ContestSubmission.countDocuments({
        user: userId,
        contest: contestId,
        problem: problem._id
      }).session(session);
      
      if (submissionCount >= contest.maxSubmissions) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Maximum submissions (${contest.maxSubmissions}) reached for this problem`
        });
      }
    }
    
    // ✅ Check allowed languages
    if (contest.allowedLanguages.length > 0 && !contest.allowedLanguages.includes(language)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Language ${language} is not allowed in this contest`
      });
    }
    
    // ✅ Calculate submission time (minutes from contest start)
    const submissionTime = Math.floor((now - contest.startTime) / (1000 * 60));
    
    // ✅ Get attempt number for this user+problem in this contest
    const attemptNumber = await ContestSubmission.countDocuments({
      user: userId,
      contest: contestId,
      problem: problem._id
    }).session(session) + 1;
    
    // ✅ Create regular submission first
    const submission = new Submission({
      userId,
      problemId: problem._id,
      code,
      language,
      status: 'In Queue'
    });
    
    await submission.save({ session });
    
    // ✅ Create contest submission
    const contestSubmission = new ContestSubmission({
      contest: contestId,
      user: userId,
      problem: problem._id,
      problemLabel: problemLabel,
      submission: submission._id,
      submissionTime: submissionTime,
      attemptNumber: attemptNumber,
      points: 0,
      penalty: 0,
      isAccepted: false
    });
    
    await contestSubmission.save({ session });
    
    // ✅ Update contest statistics
    await Contest.findByIdAndUpdate(
      contestId,
      { $inc: { totalSubmissions: 1 } },
      { session }
    );
    
    // ✅ Commit transaction before doing external operations
    await session.commitTransaction();
    
    // ✅ Add to judge queue AFTER transaction commits (external operation)
    try {
      await addSubmissionJob(submission._id, {
        isContest: true,
        contestId: contestId,
        contestSubmissionId: contestSubmission._id
      });
    } catch (queueError) {
      console.error('Failed to add to judge queue:', queueError);
      // Don't fail the request if queue fails, just log it
    }
    
    // ✅ Emit real-time update (external operation)
    try {
      if (global.io) {
        global.io.to(`contest_${contestId}`).emit('new_submission', {
          contestId,
          problemLabel,
          username: req.user.username,
          submissionTime,
          language,
          timestamp: now
        });
      }
    } catch (socketError) {
      console.error('Failed to emit socket event:', socketError);
      // Don't fail the request if socket fails
    }
    
    res.status(202).json({
      success: true,
      data: {
        submissionId: submission._id,
        contestSubmissionId: contestSubmission._id,
        problemLabel,
        language,
        submissionTime,
        attemptNumber,
        contest: {
          id: contestId,
          title: contest.title
        },
        problem: {
          id: problem._id,
          title: problem.title
        }
      },
      message: 'Contest submission received and added to judge queue'
    });
    
  } catch (error) {
    // ✅ Only abort if transaction is still active
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    
    console.error('Contest submission error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server Error'
    });
  } finally {
    // ✅ Always end session, no abort here
    await session.endSession();
  }
};

module.exports = {
  getContests,
  getContest,
  createContest,
  registerForContest,
  publishContest,
  getStandings: async (req, res) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 50 } = req.query;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid contest ID' });
      }
      
      const contest = await Contest.findById(id);
      if (!contest || !contest.isVisible || !contest.isPublished) {
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
      console.error('Get standings error:', error);
      res.status(500).json({ success: false, message: 'Server Error' });
    }
  },
  submitToContest
};