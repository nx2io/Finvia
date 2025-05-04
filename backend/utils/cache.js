import getRedisClient from '../config/redis.js';
import { DEFAULT_EXPIRATION } from '../config/env.js';

async function getOrSetCache(key, cb, expiration = DEFAULT_EXPIRATION) {
  try {
    const redisClient = await getRedisClient(); 
    const value = await redisClient.get(key);
    if (value != null) return JSON.parse(value);
    
    const freshData = await cb();
    await redisClient.setEx(key, expiration, JSON.stringify(freshData));
    return freshData;
  } catch (error) {
    console.error('Cache error:', error);
    throw error;
  }
}

async function clearCache(key) {
  try {
    const redisClient = await getRedisClient();
    await redisClient.del(key);
    console.log(`Cache deleted: ${key}`);
  } catch (error) {
    console.error('Cache deletion error:', error);
  }
}

export { getOrSetCache, clearCache };
