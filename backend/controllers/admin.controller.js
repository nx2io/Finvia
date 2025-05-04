import User from '../models/user.model.js';
import Wallet from '../models/wallet.model.js';
import Transaction from '../models/transaction.model.js';
import FundRequest from '../models/fund-request.model.js';
import SubscriptionPlan from '../models/subscription-plan.model.js';
import UserSubscription from '../models/user-subscription.model.js';
import BinanceDepositVerification from '../models/binance-deposit-verification.model.js';
import { getOrSetCache, clearCache } from "../utils/cache.js";
import mongoose from 'mongoose';

// Helper function for atomic balance updates (Consider moving to a shared utility)
const updateBalance = async (walletId, amount, subWalletId = null, session = null) => {
    const update = {};
    const filter = { _id: walletId };

    if (subWalletId) {
        filter['subWallets._id'] = subWalletId;
        if (amount < 0) filter['subWallets.$.balance'] = { $gte: Math.abs(amount) };
        update['$inc'] = { 'subWallets.$.balance': amount };
    } else {
        if (amount < 0) filter.mainBalance = { $gte: Math.abs(amount) };
        update['$inc'] = { mainBalance: amount };
    }

    const options = { new: true, session };
    const updatedWallet = await Wallet.findOneAndUpdate(filter, update, options);

    if (!updatedWallet) {
        throw new Error('Insufficient funds or wallet/sub-wallet not found.');
    }
    return updatedWallet;
};

// --- User Management ---

/**
 * @description List all users with pagination and filtering
 * @route GET /v1/admin/users
 * @access Admin
 */
export const listUsers = async (req, res, next) => {
    const { limit = 10, page = 1, status, search } = req.query;
    const query = {};

    if (status) query.status = status;
    if (search) {
        query.$or = [
            { fullName: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { username: { $regex: search, $options: 'i' } }
        ];
    }

    const options = {
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
        sort: { createdAt: -1 }
    };

    try {
        const users = await User.find(query, '-password -__v', options);
        const totalUsers = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            data: users,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalUsers / parseInt(limit)),
                totalUsers
            }
        });
    } catch (error) {
        console.error("Admin List Users Error:", error);
        next(error);
    }
};

/**
 * @description Get details of a specific user by ID
 * @route GET /v1/admin/users/:userId
 * @access Admin
 */
export const getUserDetails = async (req, res, next) => {
    const userId = req.params.userId;
    try {
        const user = await User.findById(userId)
            .select('-password -__v')
            .populate('mainWalletId', 'walletNumber primaryCurrency mainBalance status')
            .populate('subscription.planId', 'name price'); // Populate current plan details

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        console.error("Admin Get User Details Error:", error);
        next(error);
    }
};

/**
 * @description Update user status (ban/unban/suspend/activate)
 * @route PUT /v1/admin/users/:userId/status
 * @access Admin
 */
export const updateUserStatus = async (req, res, next) => {
    const userId = req.params.userId;
    const { status, reason } = req.body; // status: 'active', 'suspended', 'banned', 'closed'
    const adminUserId = req.userId;

    if (!status || !['active', 'suspended', 'banned', 'closed'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Valid status is required' });
    }
    if ((status === 'banned' || status === 'suspended') && !reason) {
        return res.status(400).json({ success: false, message: 'Reason is required for banning or suspending' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Prevent admin from changing their own status?
        if (user._id.toString() === adminUserId) {
            return res.status(403).json({ success: false, message: "Cannot change your own status." });
        }

        user.status = status;
        if (status === 'banned' || status === 'suspended') {
            user.statusReason = reason;
        } else {
            user.statusReason = undefined;
        }
        await user.save();

        // SECURITY: Invalidate user's sessions/tokens upon status change (e.g., ban)
        // Requires session management implementation

        // Clear cache
        await clearCache(`userProfile:${userId}`);
        await clearCache(`user:${userId}`);

        res.status(200).json({ success: true, message: `User status updated to ${status}`, data: { _id: user._id, status: user.status } });
    } catch (error) {
        console.error("Admin Update User Status Error:", error);
        next(error);
    }
};

/**
 * @description Delete a user (use with caution!)
 * @route DELETE /v1/admin/users/:userId
 * @access Admin
 */
export const deleteUser = async (req, res, next) => {
    const userId = req.params.userId;
    const adminUserId = req.userId;

    // Prevent admin from deleting self
    if (userId === adminUserId) {
        return res.status(403).json({ success: false, message: "Cannot delete your own account." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const user = await User.findById(userId).session(session);
        if (!user) {
            throw new Error("User not found");
        }

        // Perform cleanup: Delete related wallet, subscriptions, transactions, etc.
        await Wallet.deleteOne({ userId: userId }).session(session);
        await UserSubscription.deleteMany({ userId: userId }).session(session);
        await Transaction.deleteMany({ userId: userId }).session(session);
        await FundRequest.deleteMany({ $or: [{ requesterUserId: userId }, { requestedUserId: userId }] }).session(session);
        await BinanceDepositVerification.deleteMany({ userId: userId }).session(session);
        // ... other related data

        await User.findByIdAndDelete(userId).session(session);

        await session.commitTransaction();
        session.endSession();

        // SECURITY: Invalidate sessions/tokens
        // Clear cache
        await clearCache(`userProfile:${userId}`);
        await clearCache(`user:${userId}`);
        // Clear other related caches

        res.status(200).json({ success: true, message: "User and related data deleted successfully" });
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error("Admin Delete User Error:", error);
        if (error.message.includes('not found')) {
            return res.status(404).json({ success: false, message: error.message });
        }
        next(error);
    }
};

// --- KYC Management ---

/**
 * @description List pending KYC submissions
 * @route GET /v1/admin/kyc/pending
 * @access Admin
 */
export const listPendingKyc = async (req, res, next) => {
    const { limit = 10, page = 1 } = req.query;
    const query = { 'kyc.status': 'pending' };
    const options = {
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
        sort: { 'kyc.submittedAt': 1 } // Oldest first
    };

    try {
        const users = await User.find(query, 'username fullName email kyc', options);
        const totalPending = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            data: users.map(u => ({ userId: u._id, username: u.username, fullName: u.fullName, email: u.email, kyc: u.kyc })),
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalPending / parseInt(limit)),
                totalPending
            }
        });
    } catch (error) {
        console.error("Admin List Pending KYC Error:", error);
        next(error);
    }
};

/**
 * @description Approve or reject a KYC submission
 * @route PUT /v1/admin/kyc/:userId/review
 * @access Admin
 */
export const reviewKyc = async (req, res, next) => {
    const userId = req.params.userId;
    const { action, reason } = req.body; // action: 'approve' or 'reject'
    const adminUserId = req.userId;

    if (!action || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, message: 'Valid action (approve/reject) is required' });
    }
    if (action === 'reject' && !reason) {
        return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    try {
        const user = await User.findById(userId);
        if (!user || !user.kyc || user.kyc.status !== 'pending') {
            return res.status(404).json({ success: false, message: 'User not found or KYC not pending review' });
        }

        user.kyc.status = action === 'approve' ? 'verified' : 'rejected';
        user.kyc.reviewedAt = new Date();
        user.kyc.reviewedBy = adminUserId;
        if (action === 'reject') {
            user.kyc.rejectionReason = reason;
        }
        user.isKycVerified = (action === 'approve');

        await user.save();

        // Clear cache
        await clearCache(`userProfile:${userId}`);
        await clearCache(`user:${userId}`);

        // Notify user? (Out of scope)

        res.status(200).json({ success: true, message: `KYC submission ${user.kyc.status}`, data: user.kyc });
    } catch (error) {
        console.error("Admin Review KYC Error:", error);
        next(error);
    }
};

// --- Deposit Management ---

/**
 * @description List pending deposit verifications
 * @route GET /v1/admin/deposits/pending
 * @access Admin
 */
export const listPendingDeposits = async (req, res, next) => {
    const { limit = 10, page = 1 } = req.query;
    // Corrected query to use 'status' instead of 'status'
    const query = { status: 'pending' };
    const options = {
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
        sort: { createdAt: 1 } // Sort by creation time (oldest first)
    };

    try {
        const verifications = await BinanceDepositVerification.find(query, null, options)
            .populate('userId', 'username email') // Populate user info
            .populate('depositTransactionId', 'status amount currency'); // Populate related transaction info

        const totalPending = await BinanceDepositVerification.countDocuments(query);

        res.status(200).json({
            success: true,
            data: verifications,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalPending / parseInt(limit)),
                totalPending
            }
        });
    } catch (error) {
        console.error("Admin List Pending Deposits Error:", error);
        next(error);
    }
};

/**
 * @description Manually approve a pending deposit verification and credit user wallet
 * @route PUT /v1/admin/deposits/:verificationId/approve
 * @access Admin
 */
export const approveDeposit = async (req, res, next) => {
    const verificationId = req.params.verificationId;
    const adminUserId = req.user._id; // Use req.user from auth middleware

    if (!mongoose.Types.ObjectId.isValid(verificationId)) {
        return res.status(400).json({ success: false, message: 'Invalid Verification ID format' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Find the verification record
        const verification = await BinanceDepositVerification.findById(verificationId).session(session);

        // 2. Check if verification record exists
        if (!verification) {
            throw new Error(`Deposit verification record not found for ID: ${verificationId}.`);
        }

        // 3. Check if the status is valid for approval ('pending' or 'manual_review')
        if (!['pending', 'manual_review'].includes(verification.status)) {
            throw new Error(`Deposit verification status is not 'pending' or 'manual_review' (current: ${verification.status}). Cannot approve.`);
        }

        // 4. Find the associated transaction
        const depositTx = await Transaction.findById(verification.depositTransactionId).session(session);
        if (!depositTx) {
            // This case might indicate data inconsistency, log it and potentially throw
            console.error(`CRITICAL: Associated transaction record ${verification.depositTransactionId} not found for verification ${verificationId}.`);
            throw new Error('Associated transaction record not found.');
        }

        // 5. Check if transaction is in a state that allows approval ('pending')
        if (depositTx.status !== 'pending') {
             throw new Error(`Associated transaction status is not 'pending' (current: ${depositTx.status}). Cannot approve.`);
        }

        // 6. Find the user and their wallet
        const user = await User.findById(verification.userId).populate('mainWalletId').session(session);
        if (!user || !user.mainWalletId) {
            throw new Error('User or user wallet not found.');
        }
        const wallet = user.mainWalletId;

        // 7. Validate currency and get amount from transaction
        if (wallet.primaryCurrency !== 'USD' || depositTx.currency !== 'USDT') {
            console.warn(`Currency mismatch during approval for verification ${verificationId}: Wallet is ${wallet.primaryCurrency}, Deposit Tx is ${depositTx.currency}. Assuming 1:1 conversion.`);
            // Consider throwing an error or requiring explicit confirmation depending on business logic
        }
        const creditAmount = depositTx.amount; // Use amount from the transaction record

        // 8. Credit the user's main wallet balance
        await updateBalance(wallet._id, creditAmount, null, session);

        // 9. Update the verification record status to 'verified'
        verification.status = 'verified'; // Correct status value
        verification.processedBy = adminUserId;
        // verification.verifiedAt = new Date(); // Handled by pre-save hook
        await verification.save({ session });

        // 10. Update the transaction record status to 'completed'
        depositTx.status = 'completed';
        // depositTx.completedAt = new Date(); // Handled by pre-save hook
        await depositTx.save({ session });

        // 11. Commit transaction
        await session.commitTransaction();

        // 12. Clear cache
        await clearCache(`walletDetails:${verification.userId}`);
        // Consider clearing transaction history cache for the user

        res.status(200).json({ success: true, message: 'Deposit approved and wallet credited successfully.', data: verification });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("Admin Approve Deposit Error:", error);
        // Provide more specific feedback for common errors
        if (error.message.includes('not found') || error.message.includes('status is not')) {
            // Use 404 for not found, 400/409 for status issues
            const statusCode = error.message.includes('not found') ? 404 : 400;
            return res.status(statusCode).json({ success: false, message: error.message });
        }
        next(error);
    } finally {
        if (session) session.endSession();
    }
};

/**
 * @description Manually reject a pending deposit verification
 * @route PUT /v1/admin/deposits/:verificationId/reject
 * @access Admin
 */
export const rejectDeposit = async (req, res, next) => {
    const verificationId = req.params.verificationId;
    const adminUserId = req.userId;
    const { reason } = req.body;

    if (!verificationId) return res.status(400).json({ success: false, message: 'Verification ID is required' });
    if (!reason) return res.status(400).json({ success: false, message: 'Rejection reason is required' });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const verification = await BinanceDepositVerification.findById(verificationId).session(session);
        if (!verification || verification.status !== 'pending') {
            throw new Error('Deposit verification record not found or not pending.');
        }

        verification.status = 'rejected';
        verification.rejectionReason = reason;
        verification.processedAt = new Date();
        verification.processedBy = adminUserId;
        await verification.save({ session });

        const updatedTx = await Transaction.findOneAndUpdate(
            { relatedVerificationId: verification._id, status: 'pending' },
            { $set: { status: 'rejected', completedAt: new Date() } },
            { new: true, session: session }
        );
        if (!updatedTx) console.warn(`Placeholder transaction not found for verification ${verificationId}`);

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ success: true, message: 'Deposit verification rejected.', data: verification });

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        session.endSession();
        console.error("Admin Reject Deposit Error:", error);
        if (error.message.includes('not found') || error.message.includes('pending')) {
            return res.status(404).json({ success: false, message: error.message });
        }
        next(error);
    }
};

// --- Subscription Plan Management ---

/**
 * @description List all subscription plans (including inactive)
 * @route GET /v1/admin/subscription-plans
 * @access Admin
 */
export const listAllSubscriptionPlans = async (req, res, next) => {
    try {
        const plans = await SubscriptionPlan.find().sort({ price: 1 });
        res.status(200).json({ success: true, data: plans });
    } catch (error) {
        console.error("Admin List Plans Error:", error);
        next(error);
    }
};

/**
 * @description Create a new subscription plan
 * @route POST /v1/admin/subscription-plans
 * @access Admin
 */
export const createSubscriptionPlan = async (req, res, next) => {
    // Add validation for all fields
    try {
        const existingPlan = await SubscriptionPlan.findOne({ planId: req.body.planId });
        if (existingPlan) {
            return res.status(409).json({ success: false, message: `Plan with ID '${req.body.planId}' already exists.` });
        }
        const newPlan = new SubscriptionPlan(req.body);
        await newPlan.save();
        await clearCache('subscriptionPlans'); // Clear public cache
        res.status(201).json({ success: true, message: 'Subscription plan created successfully', data: newPlan });
    } catch (error) {
        console.error("Admin Create Plan Error:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: 'Validation failed', errors: error.errors });
        }
        next(error);
    }
};

/**
 * @description Update an existing subscription plan
 * @route PUT /v1/admin/subscription-plans/:planObjectId
 * @access Admin
 */
export const updateSubscriptionPlan = async (req, res, next) => {
    const planObjectId = req.params.planObjectId;
    // Add validation
    try {
        const updatedPlan = await SubscriptionPlan.findByIdAndUpdate(planObjectId, req.body, { new: true, runValidators: true });
        if (!updatedPlan) {
            return res.status(404).json({ success: false, message: 'Subscription plan not found' });
        }
        await clearCache('subscriptionPlans'); // Clear public cache
        res.status(200).json({ success: true, message: 'Subscription plan updated successfully', data: updatedPlan });
    } catch (error) {
        console.error("Admin Update Plan Error:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: 'Validation failed', errors: error.errors });
        }
        next(error);
    }
};

// --- Admin Specific Actions (Should be in Admin Controller with Admin Auth Middleware) ---

export const bannedUser = async (req, res, next) => {
    // Requires authorizeAdmin middleware
    const userId = req.params.id;
    try {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      // Prevent banning self?
      // Prevent banning other admins?
      user.status = user.status === 'banned' ? 'active' : 'banned'; // Toggle ban status
      user.banReason = user.status === 'banned' ? (req.body.reason || 'No reason provided') : undefined;
      await user.save();
      // SECURITY: Invalidate user's sessions/tokens
      res.status(200).json({ success: true, message: `User status set to ${user.status}`, user: { _id: user._id, status: user.status } });
    } catch (error) {
      console.error("Ban/Unban User Error:", error);
      next(error);
    }
  };
  
  // Deprecated: Combined into bannedUser toggle
  // export const unbannedUser = async (req, res, next) => { ... };
  
  export const getUserById = async (req, res, next) => {
    // Requires authorization (admin or maybe specific permissions)
    const userId = req.params.id;
    try {
      const user = await getOrSetCache(`user:${userId}`, async () => {
        return await User.findById(userId).select("-password -__v");
      }, 60);
  
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      res.status(200).json({ success: true, user });
    } catch (error) {
      console.error("Get User By ID Error:", error);
      next(error);
    }
  };
  
  export const getUserByEmailOrUsername = async (req, res, next) => {
      // Requires authorization
      const identifier = req.params.identifier; // Can be email or username
      try {
          const user = await getOrSetCache(`user:${identifier}`, async () => {
              return await User.findOne({ $or: [{ email: identifier }, { username: identifier }] }).select("-password -__v");
          }, 60);
  
          if (!user) {
              return res.status(404).json({ success: false, message: "User not found" });
          }
          res.status(200).json({ success: true, user });
      } catch (error) {
          console.error("Get User By Identifier Error:", error);
          next(error);
      }
  };
  