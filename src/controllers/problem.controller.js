const Problem = require('../models/Problem');

const createProblem = async (req, res) => {
  try {
    // In a real application, maybe would add authentication and authorization here
    // to ensure only admins can create problems.
    const newProblem = new Problem(req.body);
    await newProblem.save();
    res.status(201).json(newProblem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};


const getProblems = async (req, res) => {
  try {
    const problems = await Problem.find({});
    res.status(200).json(problems);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
/*
const getProblems = async (req, res) => {
  try {
    const { difficulty, search, page = 1, limit = 20 } = req.query;
    let query = {};

    if (difficulty && ['easy', 'medium', 'hard'].includes(difficulty)) {
      query.difficulty = difficulty;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const problems = await Problem.find(query)
      .select('-testCases')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const count = await Problem.countDocuments(query);
    
    res.status(200).json({
      problems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};*/

const getProblemById = async (req, res) => {
  try {
    const problem = await Problem.findById(req.params.id);
    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }
    res.status(200).json(problem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// NEW: Update problem (Admin only)
const updateProblem = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const problem = await Problem.findById(id);
    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }
    
    // Update the problem
    const updatedProblem = await Problem.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      message: 'Problem updated successfully',
      problem: updatedProblem
    });
  } catch (error) {
    console.error(error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// NEW: Delete problem (Admin only)
const deleteProblem = async (req, res) => {
  try {
    const { id } = req.params;
    
    const problem = await Problem.findById(id);
    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }
    
    const submissionCount = await Submission.countDocuments({ problemId: id });
    if (submissionCount > 0) {
      return res.status(409).json({ 
        message: `Cannot delete problem. There are ${submissionCount} submissions associated with this problem.`,
        submissionCount
      });
    }
    
    await Problem.findByIdAndDelete(id);
    
    res.status(200).json({ 
      message: 'Problem deleted successfully',
      deletedProblemId: id
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// NEW: Get problem statistics (Admin only)
const getProblemStats = async (req, res) => {
  try {
    const [
      totalProblems,
      easyCount,
      mediumCount,
      hardCount,
      recentProblems,
      totalSubmissions
    ] = await Promise.all([
      Problem.countDocuments(),
      Problem.countDocuments({ difficulty: 'easy' }),
      Problem.countDocuments({ difficulty: 'medium' }),
      Problem.countDocuments({ difficulty: 'hard' }),
      Problem.find().sort({ createdAt: -1 }).limit(5).select('title difficulty createdAt'),
      Submission.countDocuments()
    ]);
    
    // Get submission stats by problem
    const submissionStats = await Submission.aggregate([
      {
        $group: {
          _id: '$problemId',
          totalSubmissions: { $sum: 1 },
          acceptedSubmissions: {
            $sum: { $cond: [{ $eq: ['$status', 'Accepted'] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'problems',
          localField: '_id',
          foreignField: '_id',
          as: 'problem'
        }
      },
      {
        $unwind: '$problem'
      },
      {
        $project: {
          title: '$problem.title',
          difficulty: '$problem.difficulty',
          totalSubmissions: 1,
          acceptedSubmissions: 1,
          acceptanceRate: {
            $multiply: [
              { $divide: ['$acceptedSubmissions', '$totalSubmissions'] },
              100
            ]
          }
        }
      },
      { $sort: { totalSubmissions: -1 } },
      { $limit: 10 }
    ]);
    
    res.status(200).json({
      overview: {
        totalProblems,
        totalSubmissions,
        difficultyBreakdown: {
          easy: easyCount,
          medium: mediumCount,
          hard: hardCount
        }
      },
      recentProblems,
      popularProblems: submissionStats
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// NEW: Bulk delete problems (Admin only)
const bulkDeleteProblems = async (req, res) => {
  try {
    const { problemIds } = req.body;
    
    if (!Array.isArray(problemIds) || problemIds.length === 0) {
      return res.status(400).json({ 
        message: 'problemIds must be a non-empty array' 
      });
    }
    
    // Check if problems exist
    const existingProblems = await Problem.find({ _id: { $in: problemIds } });
    if (existingProblems.length !== problemIds.length) {
      const foundIds = existingProblems.map(p => p._id.toString());
      const notFoundIds = problemIds.filter(id => !foundIds.includes(id));
      return res.status(404).json({ 
        message: 'Some problems not found',
        notFoundIds
      });
    }
    
    // Check for submissions
    const submissionsCount = await Submission.countDocuments({ 
      problemId: { $in: problemIds } 
    });
    
    if (submissionsCount > 0) {
      return res.status(409).json({ 
        message: `Cannot delete problems. There are ${submissionsCount} submissions associated with these problems.`,
        submissionsCount
      });
    }
    
    // Delete problems
    const deleteResult = await Problem.deleteMany({ _id: { $in: problemIds } });
    
    res.status(200).json({ 
      message: `Successfully deleted ${deleteResult.deletedCount} problems`,
      deletedCount: deleteResult.deletedCount,
      deletedProblemIds: problemIds
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createProblem,  
  getProblems,
  getProblemById,
  updateProblem,
  deleteProblem,
  getProblemStats,
  bulkDeleteProblems,
};