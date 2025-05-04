import { Router } from 'express';
import passport from "passport";

import { signUp, signIn, signOut, googleCallback, verifyEmail, resendVerificationEmail, forgotPassword, resetPassword, bannedUser, unbannedUser } from '../controllers/auth.controller.js';
import errorMiddleware from '../middlewares/error.middleware.js';
import { authorizeAdmin } from '../middlewares/auth.middleware.js';

const authRouter = Router();

authRouter.post('/signup', errorMiddleware, signUp);
authRouter.post('/signin', errorMiddleware, signIn);
authRouter.post('/signout', errorMiddleware, signOut);
authRouter.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
authRouter.get("/google/callback", passport.authenticate("google", { session: false }), googleCallback ); 

authRouter.post("/verify-email/", verifyEmail);
authRouter.post("/resend-verification-email", resendVerificationEmail);
authRouter.post("/forgot-password", forgotPassword);

authRouter.post("/reset-password/:token", resetPassword);
authRouter.post("/banned/:id", authorizeAdmin, bannedUser);

authRouter.post("/unbanned/:id", authorizeAdmin, unbannedUser)

export default authRouter;