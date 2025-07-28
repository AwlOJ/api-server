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
    let filter = { isVisible: true, isPublished: true };
    
    const now = new Date();
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
    
    if (type !== 'all') {
      filter.type = type;
    }
    
    const contestsPromise = Contest.find(filter)
      .populate('createdBy', 'username role') // Populated createdBy
      .populate({
        path: 'participants',
        populate: {
          path: 'user',
          select: 'username'
        }
       })
      .sort({ startTime: status === 'ended' ? -1 : 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();
      
    const totalPromise = Contest.countDocuments(filter);
    
    const [contests, total] = await Promise.all([contestsPromise, totalPromise]);
    
    const contestsWithStatus = contests.map(contest => {
        const contestObj = { ...contest };
        const now = new Date();
        if (now < contest.startTime) {
            contestObj.status = 'upcoming';
            contestObj.timeLeft = new Date(contest.startTime).getTime() - now.getTime();
        } else if (now <= contest.endTime) {
            contestObj.status = 'running';
            contestObj.timeLeft = new Date(contest.endTime).getTime() - now.getTime();
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
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid contest ID' });
    }
    
    const contest = await Contest.findById(id)
      .populate('createdBy', 'username role email') // Populated createdBy with more fields
      .populate({
         path: 'problems',
         populate: {
           path: 'problem',
           select: 'title difficulty'
         }
      })
      .populate({
        path: 'participants',
        populate: {
          path: 'user',
          select: 'username'
        }
       });
    
    if (!contest) {
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }
    
    const isCreator = userId === contest.createdBy._id.toString();

    if (!contest.isVisible && !isCreator) {
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }
    
    if (!contest.isPublished && !isCreator) {
      return res.status(404).json({ success: false, message: 'Contest not published yet' });
    }
    
    const isRegistered = contest.isParticipant(userId);
    
    let contestData = contest.toObject();
    
    if (contestData.status === 'upcoming' && !isCreator && !isRegistered) {
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
    
    contestData.isRegistered = isRegistered;
    contestData.isCreator = isCreator;
    
    if (!isCreator) {
      delete contestData.password;
    }
    
    res.json({ success: true, data: contestData });
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
    const { problems, ...restOfBody } = req.body;
    
    if (!problems || !Array.isArray(problems) || problems.length === 0) {
        return res.status(400).json({
            success: false, message: 'Contest must have at least one problem.'
        });
    }

    const problemIds = problems.map(p => p.problemId);
    const foundProblems = await Problem.countDocuments({ _id: { $in: problemIds } });
    if (foundProblems !== problemIds.length) {
        return res.status(400).json({
            success: false, message: 'One or more problem IDs are invalid.'
        });
    }

    const contest = new Contest({
      ...restOfBody,
      createdBy: req.user.userId,
      isPublished: false,
      problems: problems.map(p => ({
        problem: p.problemId,
        label: p.label,
        points: p.points
      })),
    });

    await contest.save({ session });
    
    const standings = new Standings({
      contest: contest._id,
      rankings: []
    });
    await standings.save({ session });
    
    await session.commitTransaction();
    
    await contest.populate('createdBy', 'username role email');
    await contest.populate('problems.problem', 'title difficulty');
    
    res.status(201).json({
      success: true,
      data: contest,
      message: 'Contest created successfully as a draft. Remember to publish it when ready.'
    });
  } catch (error) {
    await session.abortTransaction();
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Contest validation failed',
        errors: Object.values(error.errors).map(e => ({ field: e.path, message: e.message }))
      });
    }
    
    console.error('Create contest error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'An unexpected server error occurred.'
    });
  } finally {
    session.endSession();
  }
};

// POST /api/contests/:id/register
const registerForContest = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    
    const contest = await Contest.findById(id);
    if (!contest) {
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }
    
    if (!contest.canRegister) {
      return res.status(400).json({ success: false, message: 'Registration is closed for this contest.' });
    }
    
    if (contest.isParticipant(req.user.userId)) {
      return res.status(400).json({ success: false, message: 'You are already registered for this contest.' });
    }
    
    if (contest.type === 'private' && contest.password !== password) {
      return res.status(401).json({ success: false, message: 'Incorrect contest password.' });
    }
    
    await contest.addParticipant(req.user.userId);
    
    res.json({ success: true, message: 'Successfully registered for the contest.' });
  } catch (error) {
    console.error('Register for contest error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

const publishContest = async (req, res) => {
  try {
    const { id } = req.params;
    const contest = await Contest.findOne({ _id: id, createdBy: req.user.userId });
    
    if (!contest) {
      return res.status(404).json({ success: false, message: 'Contest not found or you are not the creator.' });
    }
    
    if (contest.isPublished) {
      return res.status(400).json({ success: false, message: 'Contest is already published.' });
    }
    
    contest.isPublished = true;
    await contest.save();
    
    await contest.populate('createdBy', 'username role email');
    await contest.populate('problems.problem', 'title difficulty');
    
    res.json({ success: true, data: contest, message: 'Contest published successfully.' });
  } catch (error) {
    console.error('Publish contest error:', error);
    if (error.name === 'ValidationError') {
        return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const submitToContest = async (req, res) => {
  const { id: contestId } = req.params;
  const { problemLabel, code, language } = req.body;
  const userId = req.user.userId;
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    const contest = await Contest.findById(contestId).session(session);
    if (!contest || contest.status === 'draft' || contest.status === 'upcoming') {
        await session.abortTransaction();
        return res.status(403).json({ success: false, message: 'Contest is not active.' });
    }
    
    if (contest.status === 'ended') {
        await session.abortTransaction();
        return res.status(403).json({ success: false, message: 'Contest has ended.' });
    }
    
    if (!contest.isParticipant(userId)) {
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: 'You are not registered for this contest.' });
    }
    
    const contestProblem = contest.problems.find(p => p.label.toUpperCase() === problemLabel.toUpperCase());
    if (!contestProblem) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Problem not found in this contest.' });
    }
    
    const submissionTime = Math.floor((new Date() - new Date(contest.startTime)) / (1000 * 60));
    const attemptNumber = await ContestSubmission.countDocuments({ user: userId, contest: contestId, problem: contestProblem.problem }).session(session) + 1;

    const submission = new Submission({
        userId,
        problemId: contestProblem.problem,
        code,
        language,
        status: 'In Queue'
    });
    await submission.save({ session });

    const contestSubmission = new ContestSubmission({
        contest: contestId,
        user: userId,
        problem: contestProblem.problem,
        problemLabel: contestProblem.label,
        submission: submission._id,
        submissionTime,
        attemptNumber
    });
    await contestSubmission.save({ session });

    await contest.constructor.findByIdAndUpdate(contestId, { $inc: { totalSubmissions: 1 } }, { session });

    await session.commitTransaction();

    addSubmissionJob(submission._id, { isContest: true, contestId: contestId, contestSubmissionId: contestSubmission._id })
      .catch(err => console.error(`Failed to add submission ${submission._id} to queue`, err));

    const io = require('../../sockets');
    if (io) {
        io.to(`contest_${contestId}`).emit('new_submission', {
          contestId,
          problemLabel: contestProblem.label,
          username: req.user.username,
          submissionTime,
        });
    }

    res.status(202).json({
      success: true,
      data: { submissionId: submission._id },
      message: 'Submission received.'
    });

  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error('Contest submission error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  } finally {
    await session.endSession();
  }
};


const getStandings = async (req, res) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 50 } = req.query;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid contest ID' });
      }
      
      const contest = await Contest.findById(id).lean();
      if (!contest || !contest.isPublished) {
        return res.status(404).json({ success: false, message: 'Contest not found.' });
      }
      
      const standings = await StandingsService.getStandings(id, {
        page: parseInt(page),
        limit: parseInt(limit),
        isFrozen: contest.status === 'running' && contest.freezeTime > 0
      });
      
      res.json({ success: true, data: standings });
    } catch (error) {
      console.error('Get standings error:', error);
      res.status(500).json({ success: false, message: 'Server Error' });
    }
};

module.exports = {
  getContests,
  getContest,
  createContest,
  registerForContest,
  publishContest,
  getStandings,
  submitToContest
};