import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { REDIS_URL } from '../config/env.js';

// Create a separate Redis client for rate limiting
const redisClient = createClient({ url: REDIS_URL });

redisClient.on('error', (err) => {
    console.error('Rate Limiter Redis Error:', err);
});

redisClient.on('connect', () => {
    console.log('✅ Rate Limiter Redis Connected');
});

// Initialize Redis connection
(async () => {
    try {
        await redisClient.connect();
    } catch (error) {
        console.error('Failed to connect to Redis for rate limiting:', error);
    }
})();

const createLimiter = async ({ windowMs, max, keyPrefix, message }) => {
    return rateLimit({
        store: new RedisStore({
            sendCommand: (...args) => redisClient.sendCommand(args),
            prefix: keyPrefix
        }),
        windowMs,
        max,
        message: { success: false, message }
    });
};

// Create different rate limiters
export const authLimiter = await createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    keyPrefix: 'auth:',
    message: 'Too many login attempts, please try again after 15 minutes'
});


export const rateLimitLow = await createLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 100 requests per windowMs
  keyPrefix: 'rl:low:',
  message: { error: 'Rate limit exceeded' },
});

export const rateLimitMedium = await createLimiter({
  windowMs: 1 * 60 * 1000, 
  max: 30,
  keyPrefix: 'rl:medium:',
  message: { error: 'Rate limit exceeded' },
});

export const rateLimitHigh = await createLimiter({
  windowMs: 1 * 60 * 1000,
  max: 10,
  keyPrefix: 'rl:high:',
  message: { error: 'Rate limit exceeded' },
});

export const rateLimitSensitive = await createLimiter({
  windowMs: 1 * 60 * 1000,
  max: 3,
  keyPrefix: 'rl:sensitive:',
  message: { error: 'Rate limit exceeded' },
});

process.on('SIGTERM', async () => {
  await redisClient.quit();
});
process.on('SIGINT', async () => {
  await redisClient.quit();
});
