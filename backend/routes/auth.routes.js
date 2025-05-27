import { Router } from 'express';
import passport from "passport";
import { body, param } from 'express-validator'; // Import body/param for inline validation if needed

// Import controllers
import {
    signUp,
    signIn,
    signOut,
    googleCallback,
    verifyEmail,
    resendVerificationEmail,
    forgotPassword,
    resetPassword,
    checkAuth // Keep checkAuth here for session verification
} from '../controllers/auth.controller.js';

// Import middleware
import { authorize } from '../middlewares/auth.middleware.js'; // General authorization
import { rateLimitHigh } from '../middlewares/rateLimiters.middleware.js';
// import { authorizeAdmin } from '../middlewares/auth.middleware.js'; // Admin authorization (routes moved)
// import errorMiddleware from '../middlewares/error.middleware.js'; // Apply globally or specifically
import {
    registerValidationRules,
    loginValidationRules,
    handleValidationErrors
} from '../validators/auth.validator.js';

const authRouter = Router();

// --- Public Routes ---

// POST /v1/auth/signup
authRouter.post('/signup', rateLimitHigh, registerValidationRules(), handleValidationErrors, signUp);

// POST /v1/auth/signin
authRouter.post('/signin', rateLimitHigh, loginValidationRules(), handleValidationErrors, signIn);

// POST /v1/auth/signout
authRouter.post('/signout', signOut); // No auth needed, clears cookie

// GET /v1/auth/google (Initiate Google OAuth)
authRouter.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// GET /v1/auth/google/callback (Google OAuth Callback)
authRouter.get("/google/callback", passport.authenticate("google", { session: false, failureRedirect: '/login/failed' }), googleCallback );

// POST /v1/auth/verify-email
// Basic validation for email and token
authRouter.post("/verify-email", rateLimitHigh, [
    body('token').notEmpty().withMessage('Verification token is required'),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail()
], handleValidationErrors, verifyEmail);


// POST /v1/auth/resend-verification-email
// Basic validation for email
authRouter.post("/resend-verification-email", rateLimitHigh, [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail()
], handleValidationErrors, resendVerificationEmail);

// POST /v1/auth/forgot-password
// Add validation middleware: validateForgotPassword
// Add rate limiting middleware
authRouter.post("/forgot-password", rateLimitHigh, forgotPassword);

// POST /v1/auth/reset-password/:token
// Basic validation for token and password
authRouter.post("/reset-password/:token", rateLimitHigh, [
    param('token').notEmpty().withMessage('Reset token is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
], handleValidationErrors, resetPassword);

// --- Private Routes (Require Authentication) ---

// GET /v1/auth/check-auth (Verify token and return user)
authRouter.get('/check-auth', authorize, checkAuth);

// --- Admin Routes (Moved to admin.routes.js) ---
// authRouter.post("/banned/:id", authorize, authorizeAdmin, bannedUser);
// authRouter.post("/unbanned/:id", authorize, authorizeAdmin, unbannedUser); // Combined into bannedUser toggle

export default authRouter;

