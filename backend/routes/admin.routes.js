import { Router } from 'express';
import { body, param, query } from 'express-validator';

// Import controllers
import {
    listUsers,
    getUserDetails,
    updateUserStatus,
    deleteUser,
    listPendingKyc,
    reviewKyc,
    listPendingDeposits,
    approveDeposit,
    rejectDeposit,
    listAllSubscriptionPlans,
    createSubscriptionPlan,
    updateSubscriptionPlan
} from '../controllers/admin.controller.js';

// Import middleware
import { authorize, authorizeAdmin } from '../middlewares/auth.middleware.js'; // Admin authorization
// import { validateUpdateUserStatus, validateReviewKyc, ... } from '../middlewares/validation.middleware.js'; // Placeholder for validation

const adminRouter = Router();

// All admin routes require authentication and admin privileges
adminRouter.use(authorize);
adminRouter.use(authorizeAdmin);

// --- User Management ---
// GET /v1/admin/users?limit=10&page=1&status=active&search=john
adminRouter.get('/users', [
    query("limit").isNumeric(),
    query("page").isNumeric(),
    query("status").isString().isIn([ 'active', 'suspended', 'banned', 'closed']).withMessage('invalid status'),
    query("search").isString().withMessage('invalid search')

], listUsers);

// GET /v1/admin/users/:userId
adminRouter.get('/users/:userId', [
    param("userId").isMongoId().withMessage('invalid user')
], getUserDetails);

// PUT /v1/admin/users/:userId/status
// Add validation middleware: validateUpdateUserStatus
adminRouter.put('/users/:userId/status', [
    param("userId").isMongoId().withMessage("invalid user"),
    body("status").notEmpty().isString().isIn([ 'active', 'suspended', 'banned', 'closed']).withMessage('invalid status'),
    body("reason").notEmpty().isString().withMessage('invalid reason')
], updateUserStatus);

// DELETE /v1/admin/users/:userId
adminRouter.delete('/users/:userId', [
    param("userId").isMongoId().withMessage('invalid user')
], deleteUser);

// --- KYC Management ---
// GET /v1/admin/kyc/pending?limit=10&page=1
adminRouter.get('/kyc/pending', [
    query("limit").isNumeric(),
    query("page").isNumeric()
], listPendingKyc);

// PUT /v1/admin/kyc/:userId/review
// Add validation middleware: validateReviewKyc
adminRouter.put('/kyc/:userId/review', [
    param("userId").notEmpty().isMongoId().withMessage('invalid user'),
    body("action").notEmpty().isString().isIn(['approve', 'reject']).withMessage('invalid action'),
    body("reason").notEmpty().isString().withMessage('invalid reason')
], reviewKyc);

// --- Deposit Management ---
// GET /v1/admin/deposits/pending?limit=10&page=1
adminRouter.get('/deposits/pending', listPendingDeposits);

// PUT /v1/admin/deposits/:verificationId/approve
adminRouter.put('/deposits/:verificationId/approve', approveDeposit);

// PUT /v1/admin/deposits/:verificationId/reject
// Add validation middleware: validateRejectDeposit
adminRouter.put('/deposits/:verificationId/reject', rejectDeposit);

// --- Subscription Plan Management ---
// GET /v1/admin/subscription-plans
adminRouter.get('/subscription-plans', listAllSubscriptionPlans);

// POST /v1/admin/subscription-plans
// Add validation middleware: validateCreatePlan
adminRouter.post('/subscription-plans', createSubscriptionPlan);

// PUT /v1/admin/subscription-plans/:planObjectId
// Add validation middleware: validateUpdatePlan
adminRouter.put('/subscription-plans/:planObjectId', updateSubscriptionPlan);

export default adminRouter;

