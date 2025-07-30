import { Router } from 'express';
import { body, param } from 'express-validator'; // Import for inline validation

// Import controllers
import {
    getMyProfile,
    updateMyProfile,
    submitKyc,
    getKycStatus,
    addBankAccount,
    listBankAccounts,
    deleteBankAccount,
    setDefaultBankAccount,
    getTwoFactorStatus,
    initiateEnableTwoFactor,
    verifyEnableTwoFactor,
    disableTwoFactor,
    searchUsers,
    // Admin functions (moved to admin.routes.js)
    // getUserById,
    // listAllUsers
} from '../controllers/user.controller.js';

// Import middleware
import { authorize } from '../middlewares/auth.middleware.js'; // General authorization

// Import validation rules and handler
import {
    addBankAccountValidationRules,
    updateProfileValidationRules,
    // userIdParamValidationRules, // If needed for specific routes (not used here currently)
    handleValidationErrors
} from '../validators/user.validator.js';

const userRouter = Router();

// All routes below require authentication
userRouter.use(authorize);

// --- Profile Management ---
// GET /v1/users/profile/me
userRouter.get('/profile/me', getMyProfile);

// PUT /v1/users/profile/me
userRouter.put('/profile/me', updateProfileValidationRules(), handleValidationErrors, updateMyProfile);

// --- KYC Management ---
// POST /v1/users/kyc/submit
// TODO: Add specific KYC validation rules in user.validator.js if needed
// Example: Add file upload middleware if handling uploads directly
userRouter.post('/kyc/submit', /* kycValidationRules(), handleValidationErrors, */ submitKyc);

// GET /v1/users/kyc/status
userRouter.get('/kyc/status', getKycStatus);

// --- Bank Account Management ---
// POST /v1/users/bank-accounts
userRouter.post('/bank-accounts', addBankAccountValidationRules(), handleValidationErrors, addBankAccount);

// GET /v1/users/bank-accounts
userRouter.get('/bank-accounts', listBankAccounts);

// DELETE /v1/users/bank-accounts/:accountId
userRouter.delete('/bank-accounts/:accountId', [
    param('accountId').isMongoId().withMessage('Invalid Bank Account ID format')
], handleValidationErrors, deleteBankAccount);

// PUT /v1/users/bank-accounts/:accountId/default
userRouter.put('/bank-accounts/:accountId/default', [
    param('accountId').isMongoId().withMessage('Invalid Bank Account ID format')
], handleValidationErrors, setDefaultBankAccount);

// --- 2FA Management ---
// GET /v1/users/2fa/status
userRouter.get('/2fa/status', getTwoFactorStatus);

// POST /v1/users/2fa/enable/initiate
userRouter.post('/2fa/enable/initiate', initiateEnableTwoFactor); // No input validation needed usually

// POST /v1/users/2fa/enable/verify
// Basic validation for the TOTP code
userRouter.post('/2fa/enable/verify', [
    body('code').notEmpty().withMessage('2FA token is required').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Token must be a 6-digit number')
], handleValidationErrors, verifyEnableTwoFactor);

// POST /v1/users/2fa/disable
// Basic validation, might require password confirmation depending on security policy
userRouter.post('/2fa/disable', [
    // Example: body('password').notEmpty().withMessage('Password is required for disabling 2FA')
], handleValidationErrors, disableTwoFactor);

// --- User Search ---
// GET /v1/users/search?q=<query>
// Basic validation for the query parameter
userRouter.get('/search', [
    body('q').optional().isString().trim() // Or query('q') depending on how you access it
], handleValidationErrors, searchUsers);

// --- Admin Routes (Moved to admin.routes.js) ---
// userRouter.get('/', authorizeAdmin, listAllUsers);
// userRouter.get('/:id', authorizeAdmin, getUserById);

export default userRouter;

