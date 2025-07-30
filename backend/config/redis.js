import { createClient } from 'redis';
import { REDIS_URL, NODE_ENV } from './env.js';

const redisClient = createClient({ 
    url: REDIS_URL,
    socket: {
        reconnectStrategy: (retries) => {
            // Exponential backoff: 2^retries * 100ms
            const delay = Math.min(2 ** retries * 100, 3000);
            console.log(`Redis reconnecting in ${delay}ms...`);
            return delay;
        }
    }
});

redisClient.on('error', (err) => {
    console.error('❌ Redis Client Error:', err);
});

redisClient.on('connect', () => {
    console.log(`✅ Connected to Redis in ${NODE_ENV} mode`);
});

redisClient.on('reconnecting', () => {
    console.log('🔄 Reconnecting to Redis...');
});

// Ensure connection is established before exporting
const connectRedis = async () => {
    try {
        await redisClient.connect();
    } catch (error) {
        console.error('Failed to connect to Redis:', error);
        process.exit(1);
    }
};

export { redisClient, connectRedis };
