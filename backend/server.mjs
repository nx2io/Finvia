import express from 'express';
import cookieParser from 'cookie-parser';

import { PORT } from './config/env.js';

import authRouter from './routes/auth.routes.js';
import userRouter from './routes/user.routes.js';
import subscriptionRouter from './routes/subscription.routes.js';
import workflowRouter from './routes/workflow.routes.js'
import connectToDatabase from './config/mongodb.js'
import getRedisClient from './config/redis.js';
import passport from './config/google.js';
import errorMiddleware from './middlewares/error.middleware.js'
// import arcjetMiddleware from './middlewares/arcjet.middleware.js'


const app = express();

app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// app.use(arcjetMiddleware);

app.use('/v1/auth', authRouter);
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