import express from 'express';
import session from "express-session";
import cookieParser from 'cookie-parser';
import requestIp from 'request-ip'; // Import request-ip

import { PORT } from './config/env.js';

import authRouter from './routes/auth.routes.js';
import adminRouter from './routes/admin.routes.js';
import depositRouter from './routes/deposit.routes.js';
import transactionRouter from './routes/transaction.routes.js';
import walletRouter from './routes/wallet.routes.js';
import userRouter from './routes/user.routes.js';
import subscriptionRouter from './routes/subscription.routes.js';
import workflowRouter from './routes/workflow.routes.js'
import connectToDatabase from './config/mongodb.js'
import getRedisClient from './config/redis.js';
import passport from './config/google.js';
import errorMiddleware from './middlewares/error.middleware.js'
// import arcjetMiddleware from './middlewares/arcjet.middleware.js'
import morganMiddleware from "./logger/morgan.logger.js";

import { JWT_SECRET } from './config/env.js';

const app = express();

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
app.use('/v1/transaction', transactionRouter);
app.use('/v1/wallet', walletRouter);
app.use('/v1/users', userRouter);
app.use('/v1/subscriptions', subscriptionRouter);
app.use('/v1/workflows', workflowRouter);

app.use(errorMiddleware);


app.listen(PORT, async () => {
  console.log(`Subscription Tracker API is running on http://localhost:${PORT}`);

  await connectToDatabase();
  await getRedisClient();
});

export default app;