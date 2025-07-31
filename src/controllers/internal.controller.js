const { handleJudgeResult } = require('../services/contest/judge.integration');

const judgeCallbackController = async (req, res) => {
  try {
    const { submissionId, result } = req.body;

    if (!submissionId || !result) {
      return res.status(400).json({ success: false, message: 'Missing submissionId or result' });
    }

    // Call the existing logic to handle the judge result
    // This function is asynchronous but we don't need to wait for it.
    // We can respond to the judge service immediately.
    handleJudgeResult(submissionId, result);

    res.status(202).json({ success: true, message: 'Accepted. Result is being processed.' });

  } catch (error) {
    console.error('[JudgeCallback] Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

module.exports = {
  judgeCallbackController,
};
