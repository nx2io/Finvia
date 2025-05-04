import { Router } from 'express';
import { body, param, query } from 'express-validator'; // Import query for query param validation

// Import controllers
import {
    getTransactionHistory,
    getTransactionDetails,
    sendP2PTransfer,
    requestFunds,
    listReceivedFundRequests,
    listSentFundRequests,
    respondToFundRequest,
    cancelFundRequest,
    fulfillFundRequest,
    initiateWithdrawal
} from '../controllers/transaction.controller.js';

// Import middleware
import { authorize } from '../middlewares/auth.middleware.js'; // General authorization
// Import validation rules and handler
import {
    bankTransferValidationRules, // Assuming withdrawal uses similar logic, rename/refactor if needed
    // topupValidationRules, // Not directly used here, but available
    transactionIdParamValidationRules,
    handleValidationErrors
} from '../validators/transaction.validator.js';

const transactionRouter = Router();

// All routes require authentication
transactionRouter.use(authorize);

// --- Transaction History ---
// GET /v1/transactions?limit=10&page=1&type=P2P_SEND&status=completed
// Add validation for query parameters
transactionRouter.get('/', [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
    query('type').optional().isString().trim(), // Add specific enum validation if needed
    query('status').optional().isString().trim() // Add specific enum validation if needed
], handleValidationErrors, getTransactionHistory);

// GET /v1/transactions/:transactionId
transactionRouter.get('/:transactionId', transactionIdParamValidationRules(), handleValidationErrors, getTransactionDetails);


// --- P2P Transfers ---
// POST /v1/transactions/p2p-transfer
// TODO: Create specific p2pTransferValidationRules in transaction.validator.js
// Example placeholder validation:
transactionRouter.post('/p2p-transfer', [
    body('recipientIdentifier').notEmpty().withMessage('Recipient identifier (email, username, or phone) is required'),
    body('amount').isNumeric().withMessage('Amount must be numeric').toFloat().isFloat({ min: 0.01 }).withMessage('Amount must be at least 0.01'),
    body('currency').notEmpty().isIn(['USD', 'SAR', 'EUR']).withMessage('Invalid currency'),
    body('description').optional().isLength({ max: 200 }).trim()
], handleValidationErrors, sendP2PTransfer);

// --- Fund Requests ---
// POST /v1/transactions/fund-request/request
// TODO: Create specific fundRequestValidationRules in transaction.validator.js
// Example placeholder validation:
transactionRouter.post('/fund-request/request', [
    body('recipientIdentifier').notEmpty().withMessage('Recipient identifier is required'),
    body('amount').isNumeric().withMessage('Amount must be numeric').toFloat().isFloat({ min: 0.01 }).withMessage('Amount must be at least 0.01'),
    body('currency').notEmpty().isIn(['USD', 'SAR', 'EUR']).withMessage('Invalid currency'),
    body('description').optional().isLength({ max: 200 }).trim()
], handleValidationErrors, requestFunds);

// GET /v1/transactions/fund-request/received
transactionRouter.get('/fund-request/received', listReceivedFundRequests);

// GET /v1/transactions/fund-request/sent
transactionRouter.get('/fund-request/sent', listSentFundRequests);

// PUT /v1/transactions/fund-request/:requestId/respond
// Basic validation for request ID and response action
transactionRouter.put('/fund-request/:requestId/respond', [
    param('requestId').isMongoId().withMessage('Invalid Fund Request ID format'),
    body('action').isIn(['accept', 'reject']).withMessage('Action must be either accept or reject')
], handleValidationErrors, respondToFundRequest);

// PUT /v1/transactions/fund-request/:requestId/cancel
transactionRouter.put('/fund-request/:requestId/cancel', [
    param('requestId').isMongoId().withMessage('Invalid Fund Request ID format')
], handleValidationErrors, cancelFundRequest);

// POST /v1/transactions/fund-request/:requestId/fulfill
// Basic validation for request ID
transactionRouter.post('/fund-request/:requestId/fulfill', [
    param('requestId').isMongoId().withMessage('Invalid Fund Request ID format')
    // Add validation for payment details if needed (e.g., wallet source)
], handleValidationErrors, fulfillFundRequest);

// --- Withdrawals ---
// POST /v1/transactions/withdraw
// Use bankTransferValidationRules or create specific withdrawal rules
transactionRouter.post('/withdraw', bankTransferValidationRules(), handleValidationErrors, initiateWithdrawal);

export default transactionRouter;

