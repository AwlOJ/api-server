const { Queue } = require('bullmq');
const config = require('../config');

const submissionQueue = new Queue('submission_queue', {
  connection: {
    host: new URL(config.redisURL).hostname,
    port: new URL(config.redisURL).port,
    password: new URL(config.redisURL).password,
  },
});

const addSubmissionJob = async (submissionId) => {
  await submissionQueue.add('processSubmission', {
    submissionId
  });
  console.log(`Added submission ${submissionId} to queue`);
};

module.exports = {
  addSubmissionJob,
};