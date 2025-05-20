import mongoose from 'mongoose';
import Transaction from '../models/transaction.model.js';
import Wallet from '../models/wallet.model.js';
import User from '../models/user.model.js';
import FundRequest from '../models/fund-request.model.js';
import UserSubscription from '../models/user-subscription.model.js';
// import SubscriptionPlan from '../models/subscription-plan.model.js';
import { clearCache } from "../utils/cache.js";

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

// Helper to get user's current subscription plan details (fees, limits)
const getUserPlanDetails = async (userId, session = null) => {
    const userSub = await UserSubscription.findOne({ userId, status: 'active' })
        .populate('planId')
        .session(session);
    if (!userSub || !userSub.planId) {
        console.warn(`Active subscription plan not found for user ${userId}. Using defaults.`);
        // Return default limits/fees if no plan found (or throw error)
        return { fees: { p2pTransferFeePercent: 0, withdrawalFeePercent: 1.5, withdrawalFeeFixed: 0.5 }, transactionLimits: { maxSingleTransaction: 500 } }; // Example defaults
    }
    return userSub.planId; // Return the populated plan document
};

/**
 * @description Get transaction history for the authenticated user
 * @route GET /v1/transactions
 * @access Private
 */
export const getTransactionHistory = async (req, res, next) => {
    const userId = req.user._id;
    const { limit = 10, page = 1, type, status, startDate, endDate } = req.query;

    const query = { userId: userId };
    if (type) query.type = type;
    if (status) query.status = status;
    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const options = {
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
        sort: { createdAt: -1 } // Sort by most recent first
    };

    try {
        const transactions = await Transaction.find(query, null, options)
            .select('-__v -updatedAt').populate("walletId"); // Exclude fields
        const totalTransactions = await Transaction.countDocuments(query);

        res.status(200).json({
            success: true,
            data: transactions,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalTransactions / parseInt(limit)),
                totalTransactions
            }
        });
    } catch (error) {
        console.error("Get Transaction History Error:", error);
        next(error);
    }
};

/**
 * @description Get details of a specific transaction
 * @route GET /v1/transactions/:transactionId
 * @access Private
 */
export const getTransactionDetails = async (req, res, next) => {
    const userId = req.user._id;
    const transactionId = req.params.transactionId;

    try {
        const transaction = await Transaction.findOne({ _id: transactionId, userId: userId })
            .select('-__v -updatedAt')
            .populate('senderUserId', 'username fullName avatarUrl') // Populate related users if P2P
            .populate('recipientUserId', 'username fullName avatarUrl');

        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found or access denied' });
        }

        res.status(200).json({ success: true, data: transaction });
    } catch (error) {
        console.error("Get Transaction Details Error:", error);
        next(error);
    }
};

/**
 * @description Send funds to another user (P2P Transfer)
 * @route POST /v1/transactions/p2p-transfer
 * @access Private
 */
export const sendP2PTransfer = async (req, res, next) => {
    // SECURITY: Add input validation middleware
    const senderUserId = req.user._id;
    const { recipientIdentifier, amount, currency, note } = req.body; // recipientIdentifier can be username or email

    if (!recipientIdentifier || !amount || amount <= 0 || !currency) {
        return res.status(400).json({ success: false, message: 'Recipient, amount, and currency are required' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Find Sender and Recipient Users/Wallets
        const sender = await User.findById(senderUserId).populate('mainWalletId').session(session);
        const recipient = await User.findOne({ $or: [{ email: recipientIdentifier }, { username: recipientIdentifier }] })
            .populate('mainWalletId').session(session);

        if (!sender || !sender.mainWalletId) {
            throw new Error('Sender wallet not found.');
        }
        if (!recipient || !recipient.mainWalletId) {
            throw new Error('Recipient user or wallet not found.');
        }
        if (senderUserId === recipient._id.toString()) {
            throw new Error('Cannot send funds to yourself.');
        }

        const senderWallet = sender.mainWalletId;
        const recipientWallet = recipient.mainWalletId;

        // 2. Validate Currency
        if (currency !== senderWallet.primaryCurrency || currency !== recipientWallet.primaryCurrency) {
            throw new Error(`Invalid currency. Sender/Recipient wallet currency mismatch or unsupported.`);
        }

        // 3. Check Limits and Fees (P2P fees are 0 based on requirements)
        const planDetails = await getUserPlanDetails(senderUserId, session);
        if (amount > planDetails.transactionLimits.maxSingleTransaction) {
            throw new Error(`Transaction amount exceeds the limit of ${planDetails.transactionLimits.maxSingleTransaction} ${currency}.`);
        }
        // Add daily/monthly volume checks here if needed

        const fee = 0; // P2P is free
        const totalDebit = amount + fee;

        // 4. Perform Atomic Balance Updates
        await updateBalance(senderWallet._id, -totalDebit, null, session);
        await updateBalance(recipientWallet._id, amount, null, session);

        // 5. Create Transaction Records
        const now = new Date();
        const senderTx = new Transaction({
            userId: senderUserId,
            walletId: senderWallet._id,
            type: 'P2P_SEND',
            status: 'completed',
            amount: amount,
            currency: currency,
            fee: fee,
            netAmount: -totalDebit, // Net change for sender
            description: note || `Sent to ${recipient.username}`,
            recipientUserId: recipient._id,
            recipientWalletId: recipientWallet._id,
            initiatedAt: now,
            completedAt: now,
        });
        await senderTx.save({ session });

        const recipientTx = new Transaction({
            userId: recipient._id,
            walletId: recipientWallet._id,
            type: 'P2P_RECEIVE',
            status: 'completed',
            amount: amount,
            currency: currency,
            fee: 0,
            netAmount: amount, // Net change for recipient
            description: note || `Received from ${sender.username}`,
            senderUserId: senderUserId,
            senderWalletId: senderWallet._id,
            relatedTransactionId: senderTx._id, // Link to sender's transaction
            initiatedAt: now,
            completedAt: now,
        });
        await recipientTx.save({ session });

        // Update senderTx with related ID
        senderTx.relatedTransactionId = recipientTx._id;
        await senderTx.save({ session });

        // 6. Commit Transaction
        await session.commitTransaction();
        session.endSession();

        // 7. Clear Cache & Notify (Notification is out of scope here)
        await clearCache(`walletDetails:${senderUserId}`);
        await clearCache(`walletDetails:${recipient._id}`);
        // Clear transaction history caches

        res.status(200).json({ success: true, message: 'Transfer successful', data: { transactionId: senderTx._id } });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error("P2P Transfer Error:", error);
        if (error.message.includes('Insufficient funds')) {
            return res.status(400).json({ success: false, message: 'Insufficient funds.' });
        }
        if (error.message.includes('not found')) {
            return res.status(404).json({ success: false, message: error.message });
        }
        if (error.message.includes('limit')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

/**
 * @description Request funds from another user
 * @route POST /v1/transactions/fund-request/request
 * @access Private
 */
export const requestFunds = async (req, res, next) => {
    // SECURITY: Add input validation middleware
    const requesterUserId = req.user._id;
    const { requestedUserIdentifier, amount, currency, note, expiresDays = 7 } = req.body;

    if (!requestedUserIdentifier || !amount || amount <= 0 || !currency) {
        return res.status(400).json({ success: false, message: 'Requested user, amount, and currency are required' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const requester = await User.findById(requesterUserId).populate('mainWalletId').session(session);
        const requestedUser = await User.findOne({ $or: [{ email: requestedUserIdentifier }, { username: requestedUserIdentifier }] })
            .session(session);

        if (!requester || !requester.mainWalletId) {
            throw new Error('Requester wallet not found.');
        }
        if (!requestedUser) {
            throw new Error('Requested user not found.');
        }
        if (requesterUserId === requestedUser._id.toString()) {
            throw new Error('Cannot request funds from yourself.');
        }

        // Validate currency against requester's wallet
        if (currency !== requester.mainWalletId.primaryCurrency) {
            throw new Error(`Invalid currency. Your wallet currency is ${requester.mainWalletId.primaryCurrency}`);
        }

        // Create FundRequest document
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(expiresDays));

        const fundRequest = new FundRequest({
            requesterUserId: requesterUserId,
            requesterWalletId: requester.mainWalletId._id,
            requestedUserId: requestedUser._id,
            amount: amount,
            currency: currency,
            status: 'pending',
            note: note,
            expiresAt: expiresAt,
        });
        await fundRequest.save({ session });

        // Create placeholder transactions (optional, but good for history view)
        const now = new Date();
        const requesterTx = new Transaction({
            userId: requesterUserId,
            walletId: requester.mainWalletId._id,
            type: 'P2P_REQUEST_SEND',
            status: 'requested',
            amount: amount,
            currency: currency,
            description: `Requested from ${requestedUser.username}`,
            recipientUserId: requestedUser._id,
            fundRequestId: fundRequest._id,
            initiatedAt: now,
        });
        await requesterTx.save({ session });

        const requestedUserTx = new Transaction({
            userId: requestedUser._id,
            // walletId: requestedUser.mainWalletId?._id, // Wallet ID might not be needed here yet
            type: 'P2P_REQUEST_RECEIVE',
            status: 'requested',
            amount: amount,
            currency: currency,
            description: `Request from ${requester.username}`,
            senderUserId: requesterUserId,
            fundRequestId: fundRequest._id,
            initiatedAt: now,
        });
        await requestedUserTx.save({ session });

        await session.commitTransaction();
        session.endSession();

        // Notify requested user (out of scope)

        res.status(201).json({ success: true, message: 'Fund request sent successfully', data: fundRequest });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error("Request Funds Error:", error);
        if (error.message.includes('not found')) {
            return res.status(404).json({ success: false, message: error.message });
        }
        next(error);
    }
};

/**
 * @description List pending fund requests received by the user
 * @route GET /v1/transactions/fund-request/received
 * @access Private
 */
export const listReceivedFundRequests = async (req, res, next) => {
    const userId = req.user._id;
    try {
        const requests = await FundRequest.find({ requestedUserId: userId, status: 'pending' })
            .populate('requesterUserId', 'username fullName avatarUrl')
            .sort({ requestedAt: -1 });

        res.status(200).json({ success: true, data: requests });
    } catch (error) {
        console.error("List Received Fund Requests Error:", error);
        next(error);
    }
};

/**
 * @description List fund requests sent by the user
 * @route GET /v1/transactions/fund-request/sent
 * @access Private
 */
export const listSentFundRequests = async (req, res, next) => {
    const userId = req.user._id;
    try {
        const requests = await FundRequest.find({ requesterUserId: userId })
            .populate('requestedUserId', 'username fullName avatarUrl')
            .sort({ requestedAt: -1 });

        res.status(200).json({ success: true, data: requests });
    } catch (error) {
        console.error("List Sent Fund Requests Error:", error);
        next(error);
    }
};

/**
 * @description Respond to a received fund request (Accept/Reject)
 * @route PUT /v1/transactions/fund-request/:requestId/respond
 * @access Private
 */
export const respondToFundRequest = async (req, res, next) => {
    // SECURITY: Add input validation middleware
    const userId = req.user._id;
    const requestId = req.params.requestId;
    const { action, reason } = req.body; // action: 'accept' or 'reject'

    if (!requestId || !action || !['accept', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, message: 'Request ID and valid action (accept/reject) are required' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const fundRequest = await FundRequest.findById(requestId).session(session);

        if (!fundRequest) {
            throw new Error('Fund request not found.');
        }
        if (fundRequest.requestedUserId.toString() !== userId) {
            throw new Error('You are not authorized to respond to this request.');
        }
        if (fundRequest.status !== 'pending') {
            throw new Error(`Cannot respond to a request with status '${fundRequest.status}'.`);
        }
        if (fundRequest.expiresAt && fundRequest.expiresAt < new Date()) {
             // Update status to expired first
             fundRequest.status = 'expired';
             await fundRequest.save({ session });
             // Update related transactions
             await Transaction.updateMany({ fundRequestId: requestId, status: 'requested' }, { $set: { status: 'expired' } }).session(session);
             throw new Error('This fund request has expired.');
        }

        // Update FundRequest status
        fundRequest.status = action === 'accept' ? 'accepted' : 'rejected';
        if (action === 'reject') {
            fundRequest.rejectionReason = reason;
        }
        await fundRequest.save({ session });

        // Update related Transaction statuses
        const newTxStatus = action === 'accept' ? 'pending' : 'rejected'; // 'pending' for accepted, waiting for fulfillment
        await Transaction.updateMany({ fundRequestId: requestId, status: 'requested' }, { $set: { status: newTxStatus } }).session(session);

        await session.commitTransaction();
        session.endSession();

        // Notify requester (out of scope)

        res.status(200).json({ success: true, message: `Fund request ${fundRequest.status}`, data: fundRequest });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error("Respond Fund Request Error:", error);
        if (error.message.includes('not found') || error.message.includes('authorized') || error.message.includes('status') || error.message.includes('expired')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

/**
 * @description Cancel a pending fund request sent by the user
 * @route PUT /v1/transactions/fund-request/:requestId/cancel
 * @access Private
 */
export const cancelFundRequest = async (req, res, next) => {
    const userId = req.user._id;
    const requestId = req.params.requestId;

    if (!requestId) {
        return res.status(400).json({ success: false, message: 'Request ID is required' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const fundRequest = await FundRequest.findById(requestId).session(session);

        if (!fundRequest) {
            throw new Error('Fund request not found.');
        }
        if (fundRequest.requesterUserId.toString() !== userId) {
            throw new Error('You are not authorized to cancel this request.');
        }
        if (fundRequest.status !== 'pending') {
            throw new Error(`Cannot cancel a request with status '${fundRequest.status}'.`);
        }

        // Update FundRequest status
        fundRequest.status = 'cancelled';
        await fundRequest.save({ session });

        // Update related Transaction statuses
        await Transaction.updateMany({ fundRequestId: requestId, status: 'requested' }, { $set: { status: 'cancelled' } }).session(session);

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ success: true, message: 'Fund request cancelled', data: fundRequest });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error("Cancel Fund Request Error:", error);
        if (error.message.includes('not found') || error.message.includes('authorized') || error.message.includes('status')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

/**
 * @description Fulfill an accepted fund request (sends money to requester)
 * @route POST /v1/transactions/fund-request/:requestId/fulfill
 * @access Private
 */
export const fulfillFundRequest = async (req, res, next) => {
    // This is essentially a P2P transfer triggered by fulfilling a request
    const fulfillerUserId = req.user._id; // The user who received the request and is now paying
    const requestId = req.params.requestId;

    if (!requestId) {
        return res.status(400).json({ success: false, message: 'Request ID is required' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Find the accepted FundRequest
        const fundRequest = await FundRequest.findById(requestId).session(session);
        if (!fundRequest) {
            throw new Error('Fund request not found.');
        }
        if (fundRequest.requestedUserId.toString() !== fulfillerUserId) {
            throw new Error('You are not authorized to fulfill this request.');
        }
        if (fundRequest.status !== 'accepted') {
            throw new Error(`Cannot fulfill a request with status '${fundRequest.status}'.`);
        }

        // 2. Get involved users and wallets
        const fulfiller = await User.findById(fulfillerUserId).populate('mainWalletId').session(session);
        const requester = await User.findById(fundRequest.requesterUserId).populate('mainWalletId').session(session);

        if (!fulfiller || !fulfiller.mainWalletId || !requester || !requester.mainWalletId) {
            throw new Error('Fulfiller or Requester wallet not found.');
        }

        const fulfillerWallet = fulfiller.mainWalletId;
        const requesterWallet = requester.mainWalletId;
        const amount = fundRequest.amount;
        const currency = fundRequest.currency;

        // 3. Check Currency & Limits
        if (currency !== fulfillerWallet.primaryCurrency || currency !== requesterWallet.primaryCurrency) {
            throw new Error(`Invalid currency.`);
        }
        const planDetails = await getUserPlanDetails(fulfillerUserId, session);
        if (amount > planDetails.transactionLimits.maxSingleTransaction) {
            throw new Error(`Transaction amount exceeds the limit.`);
        }
        const fee = 0; // P2P is free
        const totalDebit = amount + fee;

        // 4. Perform Atomic Balance Updates
        await updateBalance(fulfillerWallet._id, -totalDebit, null, session);
        await updateBalance(requesterWallet._id, amount, null, session);

        // 5. Create Fulfillment Transaction Records
        const now = new Date();
        const fulfillerTx = new Transaction({
            userId: fulfillerUserId,
            walletId: fulfillerWallet._id,
            type: 'P2P_REQUEST_FULFILL', // Specific type for fulfilling
            status: 'completed',
            amount: amount,
            currency: currency,
            fee: fee,
            netAmount: -totalDebit,
            description: `Fulfilled request from ${requester.username}`,
            recipientUserId: requester._id,
            recipientWalletId: requesterWallet._id,
            fundRequestId: requestId,
            initiatedAt: now,
            completedAt: now,
        });
        await fulfillerTx.save({ session });

        const requesterTx = new Transaction({
            userId: requester._id,
            walletId: requesterWallet._id,
            type: 'P2P_RECEIVE', // Received as part of fulfillment
            status: 'completed',
            amount: amount,
            currency: currency,
            fee: 0,
            netAmount: amount,
            description: `Received fulfillment from ${fulfiller.username}`,
            senderUserId: fulfillerUserId,
            senderWalletId: fulfillerWallet._id,
            relatedTransactionId: fulfillerTx._id,
            fundRequestId: requestId,
            initiatedAt: now,
            completedAt: now,
        });
        await requesterTx.save({ session });

        fulfillerTx.relatedTransactionId = requesterTx._id;
        await fulfillerTx.save({ session });

        // 6. Update FundRequest Status
        fundRequest.status = 'fulfilled';
        fundRequest.fulfillmentTransactionId = fulfillerTx._id;
        await fundRequest.save({ session });

        // 7. Update placeholder transactions created during request
        await Transaction.updateMany(
            { fundRequestId: requestId, status: { $in: ['pending', 'requested'] } },
            { $set: { status: 'completed', completedAt: now } }
        ).session(session);

        // 8. Commit
        await session.commitTransaction();
        session.endSession();

        // 9. Clear Cache & Notify
        await clearCache(`walletDetails:${fulfillerUserId}`);
        await clearCache(`walletDetails:${requester._id}`);

        res.status(200).json({ success: true, message: 'Fund request fulfilled successfully', data: { transactionId: fulfillerTx._id } });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error("Fulfill Fund Request Error:", error);
        if (error.message.includes('Insufficient funds')) {
            return res.status(400).json({ success: false, message: 'Insufficient funds.' });
        }
        if (error.message.includes('not found') || error.message.includes('authorized') || error.message.includes('status') || error.message.includes('limit')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

/**
 * @description Initiate a withdrawal request to a linked bank account
 * @route POST /v1/transactions/withdraw
 * @access Private
 */
export const initiateWithdrawal = async (req, res, next) => {
    // SECURITY: Add input validation middleware
    // SECURITY: Ensure user has completed KYC if required for withdrawals
    const userId = req.user._id;
    const { bankAccountId, amount, currency } = req.body;

    if (!bankAccountId || !amount || amount <= 0 || !currency) {
        return res.status(400).json({ success: false, message: 'Bank account ID, amount, and currency are required' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Find User, Wallet, and Bank Account
        const user = await User.findById(userId).populate('mainWalletId').session(session);
        if (!user || !user.mainWalletId) {
            throw new Error('User or wallet not found.');
        }
        if (!user.isKycVerified) {
             throw new Error('KYC verification is required to make withdrawals.');
        }

        const wallet = user.mainWalletId;
        const bankAccount = user.bankAccounts.id(bankAccountId);
        if (!bankAccount) {
            throw new Error('Bank account not found.');
        }

        // 2. Validate Currency
        if (currency !== wallet.primaryCurrency) {
            throw new Error(`Invalid currency. Wallet currency is ${wallet.primaryCurrency}`);
        }

        // 3. Check Limits and Calculate Fees
        const planDetails = await getUserPlanDetails(userId, session);
        // Add withdrawal limits check here (daily/monthly volume/count)
        if (amount > planDetails.transactionLimits.maxSingleTransaction) { // Assuming same limit applies
             throw new Error(`Withdrawal amount exceeds the single transaction limit.`);
        }

        const feePercent = planDetails.fees.withdrawalFeePercent || 0;
        const feeFixed = planDetails.fees.withdrawalFeeFixed || 0;
        const fee = (amount * feePercent / 100) + feeFixed;
        const totalDebit = amount + fee;

        if (totalDebit <= 0) {
             throw new Error('Withdrawal amount after fees must be positive.');
        }

        // 4. Perform Atomic Balance Update
        await updateBalance(wallet._id, -totalDebit, null, session);

        // 5. Create Withdrawal Transaction Record
        const now = new Date();
        const withdrawalTx = new Transaction({
            userId: userId,
            walletId: wallet._id,
            type: 'WITHDRAWAL',
            status: 'pending', // Initial status, external processor will update
            amount: amount,
            currency: currency,
            fee: fee,
            netAmount: -totalDebit,
            description: `Withdrawal to ${bankAccount.bankName} (${bankAccount.iban.slice(-4)})`,
            bankAccountId: bankAccount._id,
            // Add bank details snapshot for auditing?
            // bankDetailsSnapshot: { name: bankAccount.accountHolderName, iban: bankAccount.iban, swift: bankAccount.swiftCode },
            initiatedAt: now,
        });
        await withdrawalTx.save({ session });

        // Optionally create separate fee transaction if needed for accounting

        // 6. Commit
        await session.commitTransaction();
        session.endSession();

        // 7. Clear Cache
        await clearCache(`walletDetails:${userId}`);

        // 8. Trigger External Processing (e.g., add to a queue, call external API)
        // This part is outside the controller's direct responsibility
        console.log(`Withdrawal initiated: ${withdrawalTx._id} for ${amount} ${currency} to bank account ${bankAccountId}`);

        res.status(201).json({ success: true, message: 'Withdrawal request initiated successfully', data: withdrawalTx });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error("Initiate Withdrawal Error:", error);
        if (error.message.includes('Insufficient funds')) {
            return res.status(400).json({ success: false, message: 'Insufficient funds.' });
        }
        if (error.message.includes('not found') || error.message.includes('KYC') || error.message.includes('limit')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

