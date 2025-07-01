const Problem = require('../models/Problem');

const createProblem = async (req, res) => {
  try {
    // In a real application, you would add authentication and authorization here
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

module.exports = {
  createProblem,
  getProblems,
  getProblemById,
};