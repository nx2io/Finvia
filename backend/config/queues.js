import { Queue } from 'bullmq';
import { REDIS_URL } from './env.js';

// Create a separate Redis client for BullMQ queues
const redisConfig = {
    url: REDIS_URL,
    enableReadyCheck: true,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
};

/**
 * @description Initializes the transaction queue with BullMQ and Redis
 * @returns {Object} Object containing the transactionQueue instance
 */
export const transactionQueue = new Queue('transaction-queue', {
    connection: redisConfig,
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 10000
        },
        removeOnComplete: { // الاحتفاظ بآخر 1000 مهمة مكتملة
            count: 1000000000, // عدد المهام المكتملة المحتفظ بها
            age: 7 * 24 * 3600 // الاحتفاظ بالمهام لمدة 7 أيام (بالثواني)
        },
        removeOnFail: false
    }
});

// Handle queue events
transactionQueue.on('error', (error) => {
    console.error('❌ Transaction Queue Error:', error);
});

transactionQueue.on('failed', (job, error) => {
    console.error(`❌ Job ${job.id} failed:`, error);
});

transactionQueue.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed successfully`);
});

// Cleanup on process termination
process.on('SIGTERM', async () => {
    await transactionQueue.close();
});

process.on('SIGINT', async () => {
    await transactionQueue.close();
});

// Queue configuration
transactionQueue.on('global:stalled', (jobId) => {
    console.warn(`⚠️ Job ${jobId} stalled`);
});

// Clean up completed jobs after 24 hours
transactionQueue.on('global:completed', () => {
    transactionQueue.clean(24 * 3600 * 1000, 'completed');
});

export default {
    transactionQueue
}; 