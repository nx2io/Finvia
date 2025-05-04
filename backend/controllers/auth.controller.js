import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid'; // Import UUID for wallet number generation

import User from '../models/user.model.js';
import Wallet from '../models/wallet.model.js'; // Import Wallet model
import SubscriptionPlan from '../models/subscription-plan.model.js'; // Import SubscriptionPlan model
import UserSubscription from '../models/user-subscription.model.js'; // Import UserSubscription model

import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie.js";
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail, sendResetSuccessEmail } from "../utils/emails.js";

// Helper function to generate a unique wallet number (example implementation)
const generateWalletNumber = () => {
  const uuid = uuidv4().replace(/-/g, '');
  return `W${Date.now().toString().slice(-6)}${uuid.slice(0, 6)}`.toUpperCase();
};

export const signUp = async (req, res, next) => {
  const { fullName, email, password, username, phone, nationality, birthDate } = req.body;
  const clientIp = req.clientIp; // Get IP from request-ip middleware

  // Basic validation (handled by middleware now)

  try {
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      const field = existingUser.email === email ? 'Email' : 'Username';
      return res.status(409).json({ success: false, message: `${field} already exists` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(3).toString('hex').toUpperCase();

    // 1. Create User
    const user = new User({
      fullName,
      email,
      username,
      password: hashedPassword,
      phone,
      nationality,
      birthDate,
      status: 'pending_verification',
      isEmailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      ipAddresses: clientIp ? [{ ip: clientIp, timestamp: new Date() }] : [] // Add initial IP
    });
    await user.save();

    // 2. Create Wallet
    const walletNumber = generateWalletNumber();
    const wallet = new Wallet({
      userId: user._id,
      walletNumber: walletNumber,
      primaryCurrency: 'USD',
      mainBalance: 0,
    });
    await wallet.save();

    // 3. Assign Free Subscription Plan
    const freePlan = await SubscriptionPlan.findOne({ planId: 'FREE' });
    let userSubscription;
    if (freePlan) {
      userSubscription = new UserSubscription({
        userId: user._id,
        planId: freePlan._id,
        planDetails: {
          planIdString: freePlan.planId,
          name: freePlan.name,
          price: freePlan.price,
          currency: freePlan.currency,
          billingCycle: freePlan.billingCycle,
        },
        status: 'active',
        startDate: new Date(),
        autoRenew: false,
      });
      await userSubscription.save();
    } else {
      console.error("CRITICAL: Free subscription plan not found!");
    }

    // 4. Update User with Wallet ID and Subscription Info
    user.mainWalletId = wallet._id;
    if (userSubscription) {
      user.subscription = {
        planId: freePlan._id,
        status: userSubscription.status,
      };
    }
    await user.save();

    // 5. Send Verification Email & Generate Auth Token
    try {
      await sendVerificationEmail(user.email, verificationToken);
    } catch (emailError) {
      console.error(`Failed to send verification email to ${user.email}:`, emailError);
    }

    // Pass IP to JWT generation
    const token = generateTokenAndSetCookie(res, user._id, clientIp);

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.emailVerificationToken;
    delete userResponse.emailVerificationExpires;
    delete userResponse.ipAddresses; // Don't send IP history

    res.status(201).json({
      success: true,
      message: 'User created successfully. Please check your email to verify your account.',
      data: {
        token,
        user: userResponse,
        wallet: wallet.toObject(),
        subscription: userSubscription ? userSubscription.toObject() : null
      }
    });

  } catch (error) {
    console.error("Signup Error:", error);
    next(error);
  }
};

export const signIn = async (req, res, next) => {
  const { loginIdentifier, password } = req.body; // Use loginIdentifier
  const clientIp = req.clientIp; // Get IP from request-ip middleware

  // Validation handled by middleware

  try {
    const user = await User.findOne({ $or: [{ email: loginIdentifier }, { username: loginIdentifier }] }).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.password) {
      return res.status(401).json({ success: false, message: "Authentication method not supported. Try signing in with Google or reset password." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({ success: false, message: "Please verify your email before signing in." });
    }
    if (user.status === 'suspended' || user.status === 'banned') {
      return res.status(403).json({ success: false, message: `Your account is ${user.status}. Please contact support.` });
    }
    if (user.status === 'closed') {
        return res.status(403).json({ success: false, message: `Your account is closed.` });
    }

    // Update last login timestamp and IP address log
    user.lastLoginTimestamp = new Date();
    if (clientIp) {
        // Add new IP, keep only the last N (e.g., 10)
        user.ipAddresses.push({ ip: clientIp, timestamp: new Date() });
        if (user.ipAddresses.length > 10) { // Limit history size
            user.ipAddresses = user.ipAddresses.slice(-10);
        }
    }
    await user.save();

    // Pass IP to JWT generation
    const token = generateTokenAndSetCookie(res, user._id, clientIp);

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.ipAddresses; // Don't send IP history

    res.status(200).json({
      success: true,
      message: 'User signed in successfully',
      data: {
        token,
        user: userResponse,
      }
    });
  } catch (error) {
    console.error("Signin Error:", error);
    next(error);
  }
};

export const signOut = async (req, res, next) => {
  try {
    res.clearCookie("token");
    res.status(200).json({ success: true, message: 'User signed out successfully' });
  } catch (error) {
    next(error);
  }
};

export const googleCallback = async (req, res, next) => {
  const clientIp = req.clientIp; // Get IP from request-ip middleware
  try {
    console.log("Google User Data:", req.user);

    const { id: googleId, displayName, email, photos } = req.user || {};

    if (!email) {
      return res.status(400).json({ success: false, error: "No email provided by Google" });
    }

    let user = await User.findOne({ email });

    if (!user) {
      // New user via Google
      let baseUsername = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, '');
      let username = baseUsername;
      let counter = 1;
      while (await User.findOne({ username })) {
        username = `${baseUsername}${counter}`;
        counter++;
      }

      // 1. Create User
      user = new User({
        googleId,
        fullName: displayName,
        email: email,
        username: username,
        avatarUrl: photos?.[0]?.value,
        status: 'active',
        isEmailVerified: true,
        ipAddresses: clientIp ? [{ ip: clientIp, timestamp: new Date() }] : [] // Add initial IP
      });
      await user.save();

      // 2. Create Wallet
      const walletNumber = generateWalletNumber();
      const wallet = new Wallet({
        userId: user._id,
        walletNumber: walletNumber,
        primaryCurrency: 'USD',
        mainBalance: 0,
      });
      await wallet.save();

      // 3. Assign Free Subscription
      const freePlan = await SubscriptionPlan.findOne({ planId: 'FREE' });
      let userSubscription;
      if (freePlan) {
        userSubscription = new UserSubscription({
          userId: user._id,
          planId: freePlan._id,
          planDetails: { /* ... copy plan details ... */ },
          status: 'active',
          startDate: new Date(),
        });
        await userSubscription.save();
      } else {
        console.error("CRITICAL: Free subscription plan not found for Google signup!");
      }

      // 4. Update User with Wallet ID and Subscription
      user.mainWalletId = wallet._id;
      if (userSubscription) {
        user.subscription = {
          planId: freePlan._id,
          status: userSubscription.status,
        };
      }
      await user.save();

      try {
        await sendWelcomeEmail(user.email, user.fullName);
      } catch (emailError) {
        console.error(`Failed to send welcome email to ${user.email}:`, emailError);
      }

    } else {
      // Existing user logging in via Google
      user.lastLoginTimestamp = new Date();
      if (clientIp) {
          // Add new IP, keep only the last N (e.g., 10)
          user.ipAddresses.push({ ip: clientIp, timestamp: new Date() });
          if (user.ipAddresses.length > 10) { // Limit history size
              user.ipAddresses = user.ipAddresses.slice(-10);
          }
      }
      await user.save();
    }

    // Pass IP to JWT generation
    const token = generateTokenAndSetCookie(res, user._id, clientIp);

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.ipAddresses; // Don't send IP history

    res.status(200).json({
      success: true,
      message: "User signed in successfully via Google",
      data: {
        token,
        user: userResponse,
      },
    });

  } catch (error) {
    console.error("Google Callback Error:", error);
    next(error);
  }
};

export const verifyEmail = async (req, res, next) => {
  const { token: verificationCode } = req.body; // Changed 'code' to 'token' to match previous validation
  const clientIp = req.clientIp;

  if (!verificationCode) {
      return res.status(400).json({ success: false, message: "Verification code is required" });
  }

  try {
    const user = await User.findOne({
      emailVerificationToken: verificationCode,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired verification code" });
    }

    if (user.isEmailVerified) {
        return res.status(400).json({ success: false, message: "Email is already verified" });
    }

    user.isEmailVerified = true;
    user.status = 'active';
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Pass IP to JWT generation
    const token = generateTokenAndSetCookie(res, user._id, clientIp);

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.ipAddresses;

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
      data: {
          token: token,
          user: userResponse,
      }
    });
  } catch (error) {
    console.error("Verify Email Error:", error);
    next(error);
  }
};

export const resendVerificationEmail = async (req, res, next) => {
  const { email } = req.body;
  if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
  }

  try {
    const user = await User.findOne({ email: email });

    if (!user) {
      return res.status(200).json({ success: true, message: "If an account with that email exists, a new verification code has been sent." });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ success: false, message: "Email is already verified" });
    }

    // Rate limiting check (requires verificationTokenSentAt field in user model)
    // ... (implementation omitted for brevity, assume rate limiting middleware handles this)

    const verificationToken = crypto.randomBytes(3).toString('hex').toUpperCase();
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = Date.now() + 1 * 60 * 60 * 1000; // 1 hour
    // user.verificationTokenSentAt = Date.now(); // Update timestamp if implementing cooldown here

    await user.save();

    try {
        await sendVerificationEmail(user.email, verificationToken);
    } catch (emailError) {
        console.error(`Failed to resend verification email to ${user.email}:`, emailError);
        return res.status(500).json({ success: false, message: "Failed to send verification email. Please try again later." });
    }

    res.status(200).json({ success: true, message: "If an account with that email exists, a new verification code has been sent." });
  } catch (error) {
    console.error("Resend Verification Error:", error);
    next(error);
  }
}

export const forgotPassword = async (req, res, next) => {
  const { email } = req.body;
  if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
  }

  try {
    const user = await User.findOne({ email: email });

    if (!user) {
      return res.status(200).json({ success: true, message: "If an account with that email exists, a password reset link has been sent." });
    }

    // Rate limiting check
    // ...

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.passwordResetToken = hashedResetToken;
    user.passwordResetExpires = Date.now() + 1 * 60 * 60 * 1000; // 1 hour

    await user.save();

    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth/reset-password/${resetToken}`; // Use env var or default
    try {
        await sendPasswordResetEmail(user.email, resetUrl);
    } catch (emailError) {
        console.error(`Failed to send password reset email to ${user.email}:`, emailError);
        return res.status(500).json({ success: false, message: "Failed to send password reset email. Please try again later." });
    }

    res.status(200).json({ success: true, message: "If an account with that email exists, a password reset link has been sent." });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  const { token } = req.params;
  const { password } = req.body;

  // Validation handled by middleware

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Password reset link is invalid or has expired." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    try {
        await sendResetSuccessEmail(user.email);
    } catch (emailError) {
        console.error(`Failed to send password reset success email to ${user.email}:`, emailError);
    }

    res.status(200).json({ success: true, message: "Password has been reset successfully. You can now sign in." });
  } catch (error) {
    console.error("Reset Password Error:", error);
    next(error);
  }
};

export const checkAuth = async (req, res, next) => {
  // Relies on authorize middleware setting req.user
  try {
    // req.user is already populated by authorize middleware, no need to fetch again unless cache is desired
    const user = req.user;

    // Optionally re-fetch or use cache if req.user is minimal
    // const user = await getOrSetCache(`user:${req.user._id}`, async () => {
    //     return await User.findById(req.user._id).select("-password -__v -ipAddresses");
    // }, 60);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Exclude sensitive fields before sending
    const userResponse = user.toObject ? user.toObject() : { ...user }; // Handle plain object if already transformed
    delete userResponse.password;
    delete userResponse.ipAddresses;
    delete userResponse.emailVerificationToken;
    delete userResponse.emailVerificationExpires;
    delete userResponse.passwordResetToken;
    delete userResponse.passwordResetExpires;
    // Decrypt sensitive fields if needed for display (e.g., 2FA status, but not secret)
    // if (userResponse.twoFactorAuth && userResponse.twoFactorAuth.secret) {
    //   // DO NOT send decrypted secret
    //   delete userResponse.twoFactorAuth.secret;
    // }
    // if (userResponse.kyc && userResponse.kyc.documentNumber) {
    //   // Decrypt only if needed for display, otherwise keep encrypted
    //   // userResponse.kyc.documentNumber_decrypted = decrypt(userResponse.kyc.documentNumber);
    //   delete userResponse.kyc.documentNumber; // Usually don't send this
    // }
    // if (userResponse.bankAccounts) {
    //   userResponse.bankAccounts.forEach(acc => {
    //     // Decrypt only if needed, otherwise keep encrypted
    //     // acc.iban_decrypted = decrypt(acc.iban);
    //     // acc.swiftCode_decrypted = decrypt(acc.swiftCode);
    //     delete acc.iban; // Usually don't send full IBAN/SWIFT
    //     delete acc.swiftCode;
    //   });
    // }


    res.status(200).json({ success: true, user: userResponse });
  } catch (error) {
    console.error("Check Auth Error:", error);
    next(error);
  }
};

// Admin actions moved to admin.controller.js