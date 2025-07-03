const Redis = require('ioredis');
const config = require('../config');

let redisClient;

try {
  const redisUrl = new URL(config.redisURL);
  redisClient = new Redis({
    host: redisUrl.hostname,
    port: redisUrl.port ? parseInt(redisUrl.port, 10) : 6379,
    password: redisUrl.password, // This will be empty string if no password in URL
  });

  redisClient.on('connect', () => console.log('Redis client connected for queue service.'));
  redisClient.on('error', (err) => console.error('Redis client error in queue service:', err));

} catch (error) {
  console.error('Failed to initialize Redis client for queue service:', error);
  // Handle scenario where Redis client cannot be initialized, e.g., exit process
  process.exit(1);
}


const addSubmissionJob = async (submissionId) => {
  if (!redisClient) {
    console.error('Redis client not initialized.');
    return;
  }
  const jobPayload = JSON.stringify({ submissionId: submissionId.toString() }); // Ensure ObjectId is converted to string
  
  await redisClient.rpush('submission_queue', jobPayload);
  console.log(`Added submission ${submissionId} to Redis list 'submission_queue'`);
};

module.exports = {
  addSubmissionJob,
};
