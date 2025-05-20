import { Router } from 'express';
import { body, param } from 'express-validator'; // Import for inline validation

// Import controllers
import {
    getWalletDetails,
    createSubWallet,
    updateSubWallet,
    deleteSubWallet,
    transferInternal
} from '../controllers/wallet.controller.js';

// Import middleware
import { authorize } from '../middlewares/auth.middleware.js'; // General authorization

// Import validation rules and handler
import {
    // walletTransferValidationRules, // Use this for internal transfers
    // walletIdParamValidationRules, // Use this for routes with :subWalletId
    handleValidationErrors,
} from '../validators/wallet.validator.js';

const walletRouter = Router();

// All routes require authentication
walletRouter.use(authorize);

// GET /v1/wallet/details
walletRouter.get('/details', authorize, getWalletDetails);

// --- Sub-Wallet Management ---

// POST /v1/wallet/subwallets
// TODO: Create specific createSubWalletValidationRules in wallet.validator.js
// Example placeholder validation:
walletRouter.post('/subwallets', [
    body('currency').notEmpty().isIn(['USD', 'SAR', 'EUR']).withMessage('Invalid currency'), // Adjust allowed currencies
    body('name').optional().isString().trim().isLength({ max: 50 }).withMessage('Sub-wallet name too long')
], handleValidationErrors, createSubWallet);

// PUT /v1/wallet/subwallets/:subWalletId
// TODO: Create specific updateSubWalletValidationRules in wallet.validator.js
// Example placeholder validation:
walletRouter.put('/subwallets/:subWalletId', [
    param('subWalletId').isMongoId().withMessage('Invalid Sub-Wallet ID format'),
    body('name').optional().isString().trim().isLength({ max: 50 }).withMessage('Sub-wallet name too long')
], handleValidationErrors, updateSubWallet);

// DELETE /v1/wallet/subwallets/:subWalletId
walletRouter.delete('/subwallets/:subWalletId', [
    param('subWalletId').isMongoId().withMessage('Invalid Sub-Wallet ID format')
], handleValidationErrors, deleteSubWallet);

// --- Internal Transfers ---

// POST /v1/wallet/transfer-internal
// Assuming this transfers between user's own sub-wallets or similar internal logic
// Use walletTransferValidationRules or create specific rules
// Example placeholder validation (adjust based on actual logic):
walletRouter.post('/transfer-internal', [
    body('from').isString().isLength({max: 15 }).withMessage('Invalid Source Wallet ID format'),
    body('to').isString().isLength({max: 15 }).withMessage('Invalid Destination Wallet ID format'),
    body('amount').isNumeric().withMessage('Amount must be numeric').toFloat().isFloat({ min: 0.01 }).withMessage('Amount must be at least 0.01'),
    body('type').notEmpty().isIn(['S2S', 'P2S', 'S2P']).withMessage('Invalid type'), // Match source/destination type?
    body('currency').notEmpty().isIn(['USD', 'SAR', 'EUR']).withMessage('Invalid currency'), // Match source/destination currency?
    body('description').optional().isLength({ max: 200 }).trim(),
  ], transferInternal);

export default walletRouter;

