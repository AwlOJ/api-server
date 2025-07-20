const Redis = require('ioredis');
const config = require('../config');

let redisClient;

const createRedisConnection = () => {
  try {
    const redisUrl = new URL(config.redisURL);
    redisClient = new Redis({
      host: redisUrl.hostname,
      port: redisUrl.port ? parseInt(redisUrl.port, 10) : 6379,
      password: redisUrl.password,
      retryStrategy: function (times) {
        const delay = Math.min(times * 50, 2000); 
        console.log(`Redis: Trying reconnect ${times}, ping ${delay}ms`);
        return delay;
      },
      maxRetriesPerRequest: null, 
      enableReadyCheck: true, 
      keepAlive: 30000, 
      connectTimeout: 10000, 
    });

    redisClient.on('connect', () => console.log('Redis client connected for queue service.'));
    redisClient.on('error', (err) => console.error('Redis client error in queue service:', err));

    return redisClient;
  } catch (error) {
    console.error('Failed to initialize Redis client for queue service:', error);
    process.exit(1);
  }
};

redisClient = createRedisConnection();

const gracefulShutdown = async () => {
  if (redisClient) {
    console.log('Closing Redis connection...');
    await redisClient.quit();
    console.log('Redis connection closed.');
  }
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

const addSubmissionJob = async (submissionId) => {
  if (!redisClient) {
    console.error('Redis client not initialized.');
    return;
  }
  const jobPayload = JSON.stringify({ submissionId: submissionId.toString() });
  
  await redisClient.rpush('submission_queue', jobPayload);
  console.log(`Added submission ${submissionId} to Redis list 'submission_queue'`);
};

module.exports = {
  addSubmissionJob,
  gracefulShutdown, 
};
