const Submission = require('../models/Submission');
const { addSubmissionJob } = require('../services/queue.service');

const submitCode = async (req, res) => {
  try {
    const { problemId, code, language } = req.body;
    const userId = req.user.userId; // From auth middleware

    const newSubmission = new Submission({
      userId,
      problemId,
      code,
      language,
      status: 'In Queue',
    });

    await newSubmission.save();

    await addSubmissionJob(newSubmission._id);

    res.status(202).json({ submissionId: newSubmission._id, message: 'Submission received and added to queue' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getSubmissionById = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('userId', 'username') // Populate user info
      .populate('problemId', 'title'); // Populate problem info

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }
    res.status(200).json(submission);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getSubmissionsByUserId = async (req, res) => {
  try {
    const userId = req.user.userId; // From auth middleware
    const submissions = await Submission.find({ userId })
      .populate('problemId', 'title')
      .sort({ createdAt: -1 });

    res.status(200).json(submissions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  submitCode,
  getSubmissionById,
  getSubmissionsByUserId,
};