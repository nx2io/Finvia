import express from 'express';
import session from "express-session";
import cookieParser from 'cookie-parser';
import requestIp from 'request-ip'; // Import request-ip

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import client from 'prom-client';

import { PORT } from './config/env.js';
import connectToDatabase from './config/mongodb.js'
import { redisClient, connectRedis } from './config/redis.js';
import { transactionQueue } from './config/queues.js';
import passport from './config/google.js';

import authRouter from './routes/auth.routes.js';
import adminRouter from './routes/admin.routes.js';
import depositRouter from './routes/deposit.routes.js';
import transactionRouter from './routes/transaction.routes.js';
import walletRouter from './routes/wallet.routes.js';
import exchangeRouter from './routes/exchange.routes.js';
import userRouter from './routes/user.routes.js';
import subscriptionRouter from './routes/subscription.routes.js';
import workflowRouter from './routes/workflow.routes.js'




import errorMiddleware from './middlewares/error.middleware.js'
// import arcjetMiddleware from './middlewares/arcjet.middleware.js'
import morganMiddleware from "./logger/morgan.logger.js";

// import startWorker from "./workers/transactions.worker.js"
// import { startExchangeRateService } from './services/exchange-rate.js';
// import { startNotiva } from './services/notiva.js';

import { JWT_SECRET } from './config/env.js';

const app = express();
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({
    queues: [new BullMQAdapter(transactionQueue)],
    serverAdapter
});

// Apply request-ip middleware early
app.use(requestIp.mw());

// app.use(arcjetMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(
  session({
    secret: JWT_SECRET,  // 🔑 استبدله بمفتاح سري قوي
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },  // تأكد أن `secure: true` إذا كنت تستخدم HTTPS
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(morganMiddleware);


app.use('/v1/auth', authRouter);
app.use('/v1/admin', adminRouter);
app.use('/v1/deposit', depositRouter);
app.use('/v1/transactions', transactionRouter);
app.use('/v1/wallet', walletRouter);
app.use('/v1/exchange', exchangeRouter);
app.use('/v1/users', userRouter);
app.use('/v1/subscriptions', subscriptionRouter);
app.use('/v1/workflows', workflowRouter);

app.use('/admin/queues', serverAdapter.getRouter());
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
});

app.use(errorMiddleware);

// Initialize connections
async function initializeConnections() {
    try {
        await connectToDatabase();
        await connectRedis();
    } catch (error) {
        console.error('Failed to initialize connections:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
async function cleanup() {
    console.log('Cleaning up...');
    try {
        await redisClient.quit();
        console.log('Redis connection closed');
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
    process.exit(0);
}

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

// Start server
const server = app.listen(PORT, async () => {
    await initializeConnections();
    console.log(`🚀 Server running on port ${PORT}`);
});

export default server;