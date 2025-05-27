import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import jwt from 'jsonwebtoken';

import { JWT_SECRET } from '../config/env.js';
import getRedisClient from '../config/redis.js';

const createLimiter = async ({ windowMs, max, keyPrefix, message }) => {
  const redisClient = await getRedisClient();

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message,
    keyGenerator: (req) => {
      try {
        let token;

        // Get token from Authorization header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
          token = req.headers.authorization.split(' ')[1];
        } 
        // Fallback to checking cookie if header is not present
        else if (req.cookies.token) {
          token = req.cookies.token;
        }
        
        if (!token) return req.ip;

        // تأكد من وجود JWT_SECRET في ملف env
        const payload = jwt.verify(token, JWT_SECRET);
        return `${payload.id}`; // أو payload.sub أو email حسب هيكل التوكن عندك
      } catch (err) {
        return req.ip; // fallback للـ IP إذا فشل التحقق
      }
    },
    store: new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
      prefix: keyPrefix,
    }),

  });
};

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
