import mongoose from 'mongoose';
import SubscriptionPlan from '../models/subscription-plan.model.js';
import UserSubscription from '../models/user-subscription.model.js';
import User from '../models/user.model.js';
import Wallet from '../models/wallet.model.js';
import Transaction from '../models/transaction.model.js';
import { getOrSetCache, clearCache } from "../utils/cache.js";

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

/**
 * @description List all available subscription plans
 * @route GET /v1/subscriptions/plans
 * @access Public or Private (depending on requirements)
 */
export const listAvailablePlans = async (req, res, next) => {
    try {
        // Cache the plans as they don't change often
        const plans = await getOrSetCache('subscriptionPlans', async () => {
            return await SubscriptionPlan.find({ isActive: true })
                .select('-__v -createdAt -updatedAt')
                .sort({ price: 1 }); // Sort by price ascending
        }, 3600); // Cache for 1 hour

        res.status(200).json({ success: true, data: plans });
    } catch (error) {
        console.error("List Available Plans Error:", error);
        next(error);
    }
};

/**
 * @description Get the current subscription details for the authenticated user
 * @route GET /v1/subscriptions/my-subscription
 * @access Private
 */
export const getMySubscription = async (req, res, next) => {
    const userId = req.user._id;
    try {
        // Cache user's subscription details
        const mySubscription = await getOrSetCache(`mySubscription:${userId}`, async () => {
            const subscription = await UserSubscription.findOne({ userId: userId, status: 'active' })
                .populate('planId', '-__v -createdAt -updatedAt') // Populate plan details
                .select('-__v -userId'); // Exclude unnecessary fields

            if (!subscription) {
                // This might happen if the free plan wasn't assigned correctly or expired
                // Attempt to find the user and assign free plan if missing?
                console.warn(`Active subscription not found for user ${userId}. Checking for fallback.`);
                // For now, return not found
                return null;
            }
            return subscription;
        }, 120); // Cache for 2 minutes

        if (!mySubscription) {
            return res.status(404).json({ success: false, message: 'Active subscription not found.' });
        }

        res.status(200).json({ success: true, data: mySubscription });
    } catch (error) {
        console.error("Get My Subscription Error:", error);
        next(error);
    }
};

/**
 * @description Change the user's current subscription plan
 * @route PUT /v1/subscriptions/change-plan
 * @access Private
 */
export const changeSubscription = async (req, res, next) => {
    // SECURITY: Add input validation middleware
    const userId = req.user._id;
    const { newPlanIdString } = req.body; // e.g., 'PRO', 'BUSINESS'

    if (!newPlanIdString) {
        return res.status(400).json({ success: false, message: 'New Plan ID is required' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Get New Plan, Current Subscription, User, and Wallet
        const newPlan = await SubscriptionPlan.findOne({ planId: newPlanIdString, isActive: true }).session(session);
        const currentSubscription = await UserSubscription.findOne({ userId: userId, status: 'active' }).populate('planId').session(session);
        const user = await User.findById(userId).populate('mainWalletId').session(session);

        if (!newPlan) {
            throw new Error('Requested subscription plan not found or is inactive.');
        }
        if (!user || !user.mainWalletId) {
            throw new Error('User or wallet not found.');
        }
        if (!currentSubscription || !currentSubscription.planId) {
            // Should not happen if free plan exists and is assigned
            throw new Error('Current active subscription not found.');
        }

        const wallet = user.mainWalletId;

        // 2. Check if already on the requested plan
        if (currentSubscription.planId.planId === newPlan.planId) {
            throw new Error(`You are already subscribed to the ${newPlan.name} plan.`);
        }

        // 3. Check if downgrading (handle differently? For now, allow immediate change)
        // const isDowngrade = newPlan.price < currentSubscription.planId.price;
        // Add logic here if downgrades should only apply at the end of the current cycle

        // 4. Calculate Cost & Check Balance
        const cost = newPlan.price; // Simplification: Charge full price immediately
        const currency = newPlan.currency;
        // TODO: Implement pro-rating logic if needed

        if (currency !== wallet.primaryCurrency) {
            throw new Error(`Plan currency (${currency}) does not match wallet currency (${wallet.primaryCurrency}). Currency conversion not supported yet.`);
        }

        if (cost > 0) {
            // Deduct cost from main balance
            await updateBalance(wallet._id, -cost, null, session);
        } else {
            // Changing to a free plan (should not happen via this route?)
            console.warn(`Changing to a free plan (${newPlan.planId}) for user ${userId}. Cost is zero.`);
        }

        // 5. Create Payment Transaction Record
        const now = new Date();
        let paymentTx = null;
        if (cost > 0) {
            paymentTx = new Transaction({
                userId: userId,
                walletId: wallet._id,
                type: 'SUBSCRIPTION_PAYMENT',
                status: 'completed',
                amount: cost,
                currency: currency,
                fee: 0,
                netAmount: -cost,
                description: `Payment for ${newPlan.name} (${newPlan.billingCycle}) plan.`, // Changed from ${currentSubscription.planId.name} to ${newPlan.name}
                relatedSubscriptionId: currentSubscription._id, // Link to the UserSubscription doc
                initiatedAt: now,
                completedAt: now,
            });
            await paymentTx.save({ session });
        }

        // 6. Update UserSubscription Document
        const oldPlanId = currentSubscription.planId._id;
        currentSubscription.planId = newPlan._id;
        currentSubscription.planDetails = {
            planIdString: newPlan.planId,
            name: newPlan.name,
            price: newPlan.price,
            currency: newPlan.currency,
            billingCycle: newPlan.billingCycle,
        };
        currentSubscription.status = 'active'; // Ensure it's active
        currentSubscription.startDate = now; // Reset start date
        // Calculate next renewal date based on billing cycle
        let endDate = new Date(now);
        if (newPlan.billingCycle === 'monthly') {
            endDate.setMonth(endDate.getMonth() + 1);
        } else if (newPlan.billingCycle === 'yearly') {
            endDate.setFullYear(endDate.getFullYear() + 1);
        } else {
            endDate = null; // Free plan or unknown cycle
        }
        currentSubscription.endDate = endDate;
        currentSubscription.autoRenew = newPlan.price > 0; // Auto-renew paid plans
        // Add history tracking if needed
        currentSubscription.history.push({ action: 'changed', fromPlan: oldPlanId, toPlan: newPlan._id, date: now });
        await currentSubscription.save({ session });

        // 7. Update User Document (optional, denormalized field)
        user.subscription = {
            planId: newPlan._id,
            status: currentSubscription.status,
            expiresAt: currentSubscription.endDate
        };
        await user.save({ session });

        // 8. Commit Transaction
        await session.commitTransaction();
        session.endSession();

        // 9. Clear Cache
        await clearCache(`mySubscription:${userId}`);
        await clearCache(`walletDetails:${userId}`);
        await clearCache(`userProfile:${userId}`);
        await clearCache(`user:${userId}`);

        res.status(200).json({ success: true, message: `Successfully subscribed to ${newPlan.name} plan.`, data: currentSubscription });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error("Change Subscription Error:", error);
        if (error.message.includes('Insufficient funds')) {
            return res.status(400).json({ success: false, message: 'Insufficient funds in main wallet to purchase this plan.' });
        }
        if (error.message.includes('not found') || error.message.includes('already subscribed') || error.message.includes('currency')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

/**
 * @description Cancel the user's current paid subscription (sets autoRenew to false)
 * @route PUT /v1/subscriptions/cancel
 * @access Private
 */
export const cancelSubscription = async (req, res, next) => {
    const userId = req.user._id;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const currentSubscription = await UserSubscription.findOne({ userId: userId, status: 'active' })
            .populate('planId')
            .session(session);

        if (!currentSubscription || !currentSubscription.planId) {
            throw new Error('Active subscription not found.');
        }

        // Prevent cancelling free plan
        if (currentSubscription.planId.price <= 0) {
            throw new Error('Cannot cancel a free subscription plan.');
        }

        if (!currentSubscription.autoRenew) {
             throw new Error('Subscription is already set to not auto-renew.');
        }

        // Set autoRenew to false, subscription will expire at endDate
        currentSubscription.autoRenew = false;
        // Optionally change status to 'pending_cancellation'? For now, keep 'active'
        await currentSubscription.save({ session });

        // Update User document if needed
        // const user = await User.findById(userId).session(session);
        // user.subscription.status = 'pending_cancellation'; // Or just rely on UserSubscription status
        // await user.save({ session });

        await session.commitTransaction();
        session.endSession();

        // Clear cache
        await clearCache(`mySubscription:${userId}`);
        await clearCache(`userProfile:${userId}`);
        await clearCache(`user:${userId}`);

        res.status(200).json({ success: true, message: 'Subscription auto-renewal has been cancelled. Your plan will remain active until the end of the current billing period.', data: currentSubscription });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error("Cancel Subscription Error:", error);
        if (error.message.includes('not found') || error.message.includes('free subscription') || error.message.includes('already set')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

