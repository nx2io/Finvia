import { Router } from 'express';

// Import controllers
import {
    listAvailablePlans,
    getMySubscription,
    changeSubscription,
    cancelSubscription
} from '../controllers/subscription.controller.js';

// Import middleware
import { authorize } from '../middlewares/auth.middleware.js'; // General authorization
// import { validateChangeSubscription } from '../middlewares/validation.middleware.js'; // Placeholder for validation

const subscriptionRouter = Router();

// --- Public Routes ---
// GET /v1/subscriptions/plans
subscriptionRouter.get('/plans', listAvailablePlans);

// --- Private Routes (Require Authentication) ---
subscriptionRouter.use(authorize);

// GET /v1/subscriptions/my-subscription
subscriptionRouter.get('/my-subscription', getMySubscription);

// PUT /v1/subscriptions/change-plan
// Add validation middleware: validateChangeSubscription
subscriptionRouter.put('/change-plan', changeSubscription);

// PUT /v1/subscriptions/cancel
subscriptionRouter.put('/cancel', cancelSubscription);

export default subscriptionRouter;

