// transactions.worker.js
import { Worker } from 'bullmq';
import client from 'prom-client';
import logger from '../logger/winston.logger.js';

import connectToDatabase from '../config/mongodb.js';
import { connectRedis } from '../config/redis.js';
import { transactionQueue } from "../config/queues.js";

import processes from "../services/transactions/process.js";
import AuditLog from '../models/AuditLog.model.js';

let worker;

const jobProcessingTime = new client.Histogram({
    name: 'transaction_job_processing_time',
    help: 'Time taken to process transaction jobs in seconds',
    buckets: [0.1, 0.5, 1, 2, 5]
});

/**
 * @description Processes a job from the transaction queue
 * @param {Object} job - The job object from BullMQ
 * @returns {Promise<Object>} Result of the job processing
 * @throws {Error} If the job type is unknown or processing fails
 */
async function processJob(job) {
    const end = jobProcessingTime.startTimer();
    try {
        console.log(`🔄 Processing job ${job.id}:`, { 
            type: job.data.type, 
            data: job.data.data
        });

        // Process based on transaction type
        let result;
        switch (job.data.type) {
            case 'P2P_TRANSFER':
                logger.debug('📦 Processing P2P transfer:', job.data.data);
                result = await processes.p2pTransfer(job.data.data);
                await AuditLog.create({
                    jobId: job.id,
                    type: job.data.type,
                    userId: job.data.data.senderUserId,
                    status: result.success ? 'completed' : 'failed',
                    details: result
                });
                break;
            default:
                console.warn('❌ Unknown transaction type:', job.data.type);
                throw new Error(`Unknown transaction type: ${job.data.type}`);
        }

        if (result.success) {
            console.log(`✅ Successfully processed job ${job.id}:`, result);
            return result;
        } else {
            console.error(`❌ Job ${job.id} failed:`, result.message);
            throw new Error(result.message || 'Transaction processing failed');
        }
    } catch (err) {
        console.error(`❌ Error processing job ${job.id}:`, err);
        throw err; // Let BullMQ handle the retry
    } finally {
        end();
    }
}

async function startWorker() {
    console.log("🚀 Transaction worker starting...");

    try {
        // Create worker instance
        worker = new Worker('transaction-queue', async (job) => {
            console.log(`📥 Received job ${job.id} of type ${job.name}`);
            return await processJob(job);
        }, {
            connection: transactionQueue.opts.connection,
            concurrency: 1,
            limiter: {
                max: 3,
                duration: 1000
            },
        });

        // Handle worker events
        worker.on('completed', (job) => {
            console.log(`✅ Job ${job.id} completed successfully`);
        });

        worker.on('failed', (job, error) => {
            console.error(`❌ Job ${job.id} failed:`, error);
        });

        worker.on('error', (error) => {
            console.error('❌ Worker error:', error);
        });

        worker.on('active', (job) => {
            console.log(`🔄 Job ${job.id} has started processing`);
        });

        worker.on('stalled', (job) => {
            console.warn(`⚠️ Job ${job.id} has stalled`);
        });

        worker.on('ready', () => {
            console.log('✅ Worker is ready to process jobs');
        });

        worker.on('drained', () => {
            console.log('📭 Queue is empty, waiting for new jobs...');
        });

        // Handle process termination
        process.on('SIGTERM', async () => {
            console.log('🛑 Received SIGTERM signal');
            await cleanup();
        });

        process.on('SIGINT', async () => {
            console.log('🛑 Received SIGINT signal');
            await cleanup();
        });

        // Handle uncaught errors
        process.on('uncaughtException', async (error) => {
            console.error('❌ Uncaught Exception:', error);
            await cleanup();
        });

        process.on('unhandledRejection', async (reason, promise) => {
            console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
            await cleanup();
        });

        console.log("✅ Transaction worker started successfully");
        console.log("👀 Waiting for new jobs...");

    } catch (error) {
        console.error("Fatal worker error:", error);
        await cleanup();
    }
}

async function cleanup() {
    console.log('🧹 Cleaning up...');
    try {
        if (worker) {
            await worker.close();
            console.log('✅ Worker closed successfully');
        }
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
    process.exit(0);
}

(async () => {
    try {
        console.log('🔌 Connecting to database and Redis...');
        await connectToDatabase(); // الاتصال ب MongoDB
        await connectRedis(); // الاتصال بـ Redis
        console.log('✅ All connections established, starting worker...');
        // Start the worker and keep it running
        startWorker().catch(async (err) => {
            console.error("Fatal worker error:", err);
            await cleanup();
        }); 
    } catch (err) {
        console.error('❌ Failed to start worker due to connection error:', err);
        process.exit(1); // الخروج من البرنامج إذا فشل الاتصال
    }
})();
console.log('✅ All connections established');

// export default startWorker;