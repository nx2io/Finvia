import { createClient } from 'redis';
import { REDIS_URL, NODE_ENV } from './env.js';

let redisClient = null;

const getRedisClient = async () => {
  if (!redisClient) {
    redisClient = createClient({ url: REDIS_URL });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error', err);
    });

    redisClient.on('connect', () => {
      console.log(`Connected to Redis in ${NODE_ENV} mode`);
    });

    await redisClient.connect();
  }

  return redisClient;
};

export default getRedisClient;
