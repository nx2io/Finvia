import { redisClient } from '../../config/redis.js';
import { DEFAULT_EXPIRATION } from '../../config/env.js';

async function getOrSetCache(key, cb, expiration = DEFAULT_EXPIRATION) {
  try {
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
    await redisClient.del(key);
    console.log(`Cache deleted: ${key}`);
  } catch (error) {
    console.error('Cache deletion error:', error);
  }
}

export const acquireLock = async (key, ttl = 5000) => {
  const lockId = `${Date.now()}-${Math.random()}`;
  const isLocked = await redisClient.set(key, lockId, {
    NX: true, // فقط إذا لم يكن موجودًا
    PX: ttl,  // صلاحية القفل
  });

  if (!isLocked) return null;
  return { key, lockId };
};

export const releaseLock = async (lock) => {
  if (!lock) return;
  const current = await redisClient.get(lock.key);
  if (current === lock.lockId) {
    await redisClient.del(lock.key);
  }
};

export { getOrSetCache, clearCache };
