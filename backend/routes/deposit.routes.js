import { Router } from 'express';

// Import controllers
import {
    getDepositInstructions,
    submitDepositVerification,
    getDepositstatus
    // Admin functions (moved to admin.routes.js)
    // approveDeposit,
    // rejectDeposit
} from '../controllers/deposit.controller.js';

// Import middleware
import { authorize } from '../middlewares/auth.middleware.js'; // General authorization
// import { validateSubmitDeposit } from '../middlewares/validation.middleware.js'; // Placeholder for validation

const depositRouter = Router();

// All routes require authentication
depositRouter.use(authorize);

// GET /v1/deposit/instructions
depositRouter.get('/instructions', authorize, getDepositInstructions);

// POST /v1/deposit/submit-verification
// Add validation middleware: validateSubmitDeposit
// Add file upload middleware if handling uploads directly
depositRouter.post('/submit-verification', authorize, submitDepositVerification);

// GET /v1/deposit/verification-status?limit=10&page=1
depositRouter.get('/verification-status', authorize, getDepositstatus);

export default depositRouter;

