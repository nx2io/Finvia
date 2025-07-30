import mongoose from 'mongoose';
import models from '../models/index.js';
// import SubscriptionPlan from '../models/subscription-plan.model.js';

import { transactionQueue } from '../config/queues.js';
import { clearCache } from "../services/utils/cache.js";
import { convertCurrency, generateUniqueTransactionId, updateBalance, getUserPlanDetails } from '../services/utils/helpers.js';


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
        const transactions = await models.Transaction.find(query, null, options)
            .select('-__v -updatedAt').populate("walletId"); // Exclude fields
        const totalTransactions = await models.Transaction.countDocuments(query);

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
        console.error("Get models.Transaction History Error:", error);
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
        const transaction = await models.Transaction.findOne({ _id: transactionId, userId: userId })
            .select('-__v -updatedAt')
            .populate('senderUserId', 'username fullName avatarUrl') // Populate related users if P2P
            .populate('recipientUserId', 'username fullName avatarUrl');

        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found or access denied' });
        }

        res.status(200).json({ success: true, data: transaction });
    } catch (error) {
        console.error("Get models.Transaction Details Error:", error);
        next(error);
    }
};

/**
 * @description Send funds to another user (P2P Transfer)
 * @route POST /v1/transactions/p2p-transfer
 * @access Private
 */
export const sendP2PTransfer = async (req, res, next) => {
    const senderUserId = req.user._id;
    const { recipientIdentifier, amount, currency, note } = req.body;

    if (!recipientIdentifier || !amount || amount <= 0 || !currency) {
        return res.status(400).json({ success: false, message: 'Recipient, amount, and currency are required' });
    }

    try {
        console.log('🔄 Enqueueing P2P transfer:', {
            senderUserId,
            recipientIdentifier,
            amount,
            currency
        });

        // Format the job data
        const jobData = {
            type: 'P2P_TRANSFER',
            data: {
                TXID: await generateUniqueTransactionId(),
                senderUserId: senderUserId.toString(),
                recipientIdentifier,
                amount: parseFloat(amount),
                currency,
                note: note || ''
            }
        };

        // Add job to queue with retry options
        const job = await transactionQueue.add('p2p-transfer', jobData, {
            jobId: `p2p-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            attempts: 5,
            backoff: {
                type: 'exponential',
                delay: 10000
            },
            removeOnComplete: { // الاحتفاظ بآخر 1000 مهمة مكتملة
                // count: 1000000000, // عدد المهام المكتملة المحتفظ بها
                age: 7 * 24 * 3600 // الاحتفاظ بالمهام لمدة 7 أيام (بالثواني)
            },
            removeOnFail: {
                age: 30 * 24 * 3600, 
            }
        });

        console.log('✅ Transfer enqueued successfully:', { jobId: job.id });

        res.status(200).json({ 
            success: true, 
            message: 'Transfer enqueued successfully',
            data: { jobId: job.id }
        });
    } catch (error) {
        console.error('❌ Queue error:', error);
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
    const { recipientIdentifier, amount, currency, note, expiresDays = 7 } = req.body;

    if (!recipientIdentifier || !amount || amount <= 0 || !currency) {
        return res.status(400).json({ success: false, message: 'Requested user, amount, and currency are required' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const requester = await models.User.findById(requesterUserId).populate('mainWalletId').session(session);
        const requested = await models.User.findOne({ $or: [{ email: recipientIdentifier }, { username: recipientIdentifier }] }).populate('mainWalletId').session(session);

        if (!requester || !requester.mainWalletId) {
            throw new Error('Requester wallet not found.');
        }
        if (!requested) {
            throw new Error('Requested user not found.');
        }
        if (requesterUserId === requested._id.toString()) {
            throw new Error('Cannot request funds from yourself.');
        }
        if (requester._id.toString() === requested._id.toString()) {
            throw new Error('Cannot request funds from yourself.');
        }
        const requesterWallet = requester.mainWalletId;
        const requestedWallet = requested.mainWalletId;

        let amountInUSD = await convertCurrency(amount, requesterWallet.primaryCurrency, 'USD');
        let feeInRequesterCurrency = await convertCurrency(0.20, 'USD', requesterWallet.primaryCurrency);
        let requesterAmount = await convertCurrency(amount, currency, requesterWallet.primaryCurrency);
        let requestedAmount = await convertCurrency(amount, currency, requestedWallet.primaryCurrency);

        const planDetails = await getUserPlanDetails(requesterUserId, session);
        if (amountInUSD > planDetails.transactionLimits.maxSingleTransaction) {
            throw new Error(`Transaction amount exceeds the limit of ${planDetails.transactionLimits.maxSingleTransaction} ${requestedWallet.primaryCurrency}.`);
        }

        const totalCredit = requesterAmount - feeInRequesterCurrency;

        // Create FundRequest document
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(expiresDays));

        const fundRequest = new models.FundRequest({
            REID: await generateUniqueTransactionId(),
            requesterUserUID: req.user.UUID,
            requesterUserId: requesterUserId,
            requesterWalletId: requester.mainWalletId?._id,
            requesterWalletNumber: requester.mainWalletId?.walletNumber,
            requestedUserId: requested._id,
            requestedUserUID: requested.UUID,
            amount: requesterAmount,
            currency: requesterWallet.primaryCurrency,
            status: 'pending',
            note: note,
            expiresAt: expiresAt,
        });
        await fundRequest.save({ session });

        // Create placeholder transactions (optional, but good for history view)
        
        const now = new Date();
        const requesterTx = new models.Transaction({
            TXID: await generateUniqueTransactionId(),
            userUID: req.user.UUID,
            userId: requester._id,
            walletId: requester.mainWalletId._id,
            walletNumber: requester.mainWalletId.walletNumber,
            type: 'P2P_REQUEST_SEND',
            status: 'requested',
            amount: requesterAmount,
            currency: requesterWallet.primaryCurrency,
            fee: feeInRequesterCurrency,
            netAmount: totalCredit,
            description: `You requested ${amount}${currency} ≈ (${requesterAmount}${requesterWallet.primaryCurrency}), from @${requested.username}`,
            recipientUserId: requested._id,
            recipientUserUID: requested.UUID,
            recipientWalletId: requested.mainWalletId._id,
            recipientWalletNumber: requested.mainWalletId.walletNumber,
            fundRequestId: fundRequest._id,
            fundRequestUID: fundRequest.REID,
            initiatedAt: now,
        });
        await requesterTx.save({ session });

        const requestedUserTx = new models.Transaction({
            TXID: await generateUniqueTransactionId(),
            userUID: requested.UUID,
            userId: requested._id,
            walletId: requested.mainWalletId._id, // Wallet ID might not be needed here yet
            walletNumber: requested.mainWalletId.walletNumber,
            type: 'P2P_REQUEST_RECEIVE',
            status: 'requested',
            amount: requestedAmount,
            currency: requestedWallet.primaryCurrency,
            fee: 0,
            netAmount: requestedAmount,
            description: `@${requester.username} requested ${amount} ${currency} ≈ (${requestedAmount}${requestedWallet.primaryCurrency}), from you`,
            senderUserId: req.user._id,
            senderUserUID: req.user.UUID,
            senderWalletId: requester.mainWalletId._id,
            senderWalletNumber: requester.mainWalletId.walletNumber,
            recipientUserId: requested._id,
            recipientUserUID: requested.UUID,
            fundRequestId: fundRequest._id,
            fundRequestUID: fundRequest.REID,
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
        const requests = await models.FundRequest.find({ requestedUserId: userId, status: 'pending' })
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
        const requests = await models.FundRequest.find({ requesterUserId: userId })
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
    const { action } = req.body; // action: 'accept' or 'reject'

    if (!requestId || !action || !['accept', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, message: 'Request ID and valid action (accept/reject) are required' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const fundRequest = await models.FundRequest.findById(requestId).session(session);
        const requesterTX = await models.Transaction.findOne({ userUID: fundRequest.requesterUserUID }).session(session);
        const requestedTX = await models.Transaction.findOne({ userUID: fundRequest.requestedUserUID }).session(session);
        const requester = await models.User.findById(fundRequest.requesterUserId).populate('mainWalletId').session(session);
        const requested = await models.User.findById(fundRequest.requestedUserId).populate('mainWalletId').session(session);

        if (!fundRequest) {
            throw new Error('Fund request not found.');
        }
        if (fundRequest.requestedUserId.toString() !== userId.toString()) {
            throw new Error('You are not authorized to respond to this request.');
        }

        if (fundRequest.expiresAt && fundRequest.expiresAt < new Date()) {
            fundRequest.status = 'expired',
            await fundRequest.save({ session });

            // Create placeholder transactions (optional, but good for history view)            
            const now = new Date();
            const requesterTx = new models.Transaction({
                TXID: await generateUniqueTransactionId(),
                userUID: requesterTX.userUID,
                userId: requesterTX.userId,
                walletId: requesterTX.walletId,
                walletNumber: requesterTX.walletNumber,
                type: 'P2P_REQUEST_SEND',
                status: 'rejected',
                amount: requesterTX.amount,
                currency: requesterTX.currency,
                fee: requesterTX.fee,
                netAmount: requesterTX.netAmount,
                description: `The request has been rejected. Reason: expired`,
                recipientUserId: requesterTX.recipientUserId,
                recipientUserUID: requesterTX.recipientUserUID,
                recipientWalletId: requesterTX.recipientWalletId,
                recipientWalletNumber: requesterTX.recipientWalletNumber,
                fundRequestId: requesterTX.fundRequestId,
                fundRequestUID: requesterTX.fundRequestUID,
                initiatedAt: now,
            });
            await requesterTx.save({ session });

            const requestedUserTx = new models.Transaction({
                TXID: await generateUniqueTransactionId(),
                userUID: requestedTX.userUID,
                userId: requestedTX.userId,
                walletId: requestedTX.walletId, // Wallet ID might not be needed here yet
                walletNumber: requestedTX.walletNumber,
                type: 'P2P_REQUEST_RECEIVE',
                status: 'rejected',
                amount: requestedTX.amount,
                currency: requestedTX.currency,
                fee: requestedTX.fee,
                netAmount: requestedTX.netAmount,
                description: `The request has been rejected. Reason: expired`,
                senderUserId: requestedTX.senderUserId,
                senderUserUID: requestedTX.senderUserUID,
                senderWalletId: requestedTX.senderWalletId,
                senderWalletNumber: requestedTX.senderWalletNumber,
                recipientUserId: requestedTX.recipientUserId,
                recipientUserUID: requestedTX.recipientUserUID,
                fundRequestId: requestedTX.fundRequestId,
                fundRequestUID: requestedTX.fundRequestUID,
                initiatedAt: now,
            });
            await requestedUserTx.save({ session });
             
            throw new Error('This fund request has expired.');
        }

        // Update FundRequest status
        if (action === 'reject') {
            fundRequest.status = 'rejected',
            await fundRequest.save({ session });

            // Update related models.Transaction statuses
            const now = new Date();
            const requesterTx = new models.Transaction({
                TXID: await generateUniqueTransactionId(),
                userUID: requesterTX.userUID,
                userId: requesterTX.userId,
                walletId: requesterTX.walletId,
                walletNumber: requesterTX.walletNumber,
                type: 'P2P_REQUEST_SEND',
                status: 'rejected',
                amount: requesterTX.amount,
                currency: requesterTX.currency,
                description: `The request has been rejected by ${requested.fullName}.`,
                recipientUserId: requesterTX.recipientUserId,
                recipientUserUID: requesterTX.recipientUserUID,
                recipientWalletId: requesterTX.recipientWalletId,
                recipientWalletNumber: requesterTX.recipientWalletNumber,
                fundRequestId: requesterTX.fundRequestId,
                fundRequestUID: requesterTX.fundRequestUID,
                initiatedAt: now,
            });
            await requesterTx.save({ session });
            const requestedUserTx = new models.Transaction({
                TXID: await generateUniqueTransactionId(),
                userUID: requestedTX.userUID,
                userId: requestedTX.userId,
                walletId: requestedTX.walletId, // Wallet ID might not be needed here yet
                walletNumber: requestedTX.walletNumber,
                type: 'P2P_REQUEST_RECEIVE',
                status: 'rejected',
                amount: requestedTX.amount,
                currency: requestedTX.currency,
                description: `The request has been rejected for ${requester.fullName}.`,
                senderUserId: requestedTX.senderUserId,
                senderUserUID: requestedTX.senderUserUID,
                senderWalletId: requestedTX.senderWalletId,
                senderWalletNumber: requestedTX.senderWalletNumber,
                recipientUserId: requestedTX.recipientUserId,
                recipientUserUID: requestedTX.recipientUserUID,
                fundRequestId: requestedTX.fundRequestId,
                fundRequestUID: requestedTX.fundRequestUID,
                initiatedAt: now,
            });
    
            await requestedUserTx.save({ session });
        } else if (action === 'accept') {
            fundRequest.status = 'accepted',
            await fundRequest.save({ session });
        }


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
        const fundRequest = await models.FundRequest.findById(requestId).session(session);

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

        // Update related models.Transaction statuses
        await models.Transaction.updateMany({ fundRequestId: requestId, status: 'requested' }, { $set: { status: 'cancelled' } }).session(session);

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
    const fulfillerUserId = req.user._id;
    const requestId = req.params.requestId;

    if (!requestId) {
        return res.status(400).json({ success: false, message: 'Request ID is required' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const fundRequest = await models.FundRequest.findById(requestId).session(session);

        if (!fundRequest) throw new Error('Fund request not found.');
        if (fundRequest.requestedUserId.toString() !== fulfillerUserId.toString())
            throw new Error('You are not authorized to fulfill this request.');
        if (fundRequest.status !== 'accepted')
            throw new Error(`Cannot fulfill a request with status '${fundRequest.status}'.`);
        
        const fulfiller = await models.User.findById(fulfillerUserId).populate('mainWalletId').session(session);
        const requester = await models.User.findById(fundRequest.requesterUserId).populate('mainWalletId').session(session);
        
        if (!fulfiller || !fulfiller.mainWalletId || !requester || !requester.mainWalletId)
            throw new Error('Fulfiller or Requester wallet not found.');
        
        const fulfillerWallet = fulfiller.mainWalletId;
        const requesterWallet = requester.mainWalletId;
        
        
        let amountInUSD = await convertCurrency(fundRequest.amount, fundRequest.currency, 'USD');
        let feeInRequesterCurrency = await convertCurrency(0.20, 'USD', requesterWallet.primaryCurrency);
        let fulfillerAmount = await convertCurrency(fundRequest.amount, fundRequest.currency, fulfillerWallet.primaryCurrency);
        let requesterAmount = await convertCurrency(fundRequest.amount, fundRequest.currency, requesterWallet.primaryCurrency);
    

        if (fulfillerWallet.balance < fulfillerAmount) {
            throw new Error('Insufficient funds.');
        }

        const planDetails = await getUserPlanDetails(fulfillerUserId, session);
        if (amountInUSD > planDetails.transactionLimits.maxSingleTransaction) {
            throw new Error(`Transaction amount exceeds the limit of ${planDetails.transactionLimits.maxSingleTransaction} ${fulfiller.primaryCurrency}.`);
        }

        const totalCredit = requesterAmount - feeInRequesterCurrency;

        const now = new Date();
        const fulfillerTx = new models.Transaction({
            TXID: await generateUniqueTransactionId(),
            userUID: req.user.UUID,
            userId: fulfiller._id,
            walletId: fulfillerWallet._id,
            walletNumber: fulfillerWallet.walletNumber,
            type: 'P2P_REQUEST_FULFILL',
            status: 'completed',
            amount: fulfillerAmount,
            currency: fulfillerWallet.primaryCurrency,
            fee: 0,
            netAmount: -fulfillerAmount,
            description: `Fulfilled request from ${requester.username}`,
            senderUserId: fulfiller._id,
            senderUserUID: req.user.UUID,
            senderWalletId: fulfillerWallet._id,
            senderWalletNumber: fulfillerWallet.walletNumber,
            recipientUserId: requester._id,
            recipientUserUID: requester.UUID,
            recipientWalletId: requesterWallet._id,
            recipientWalletNumber: requesterWallet.walletNumber,
            fundRequestId: fundRequest._id,
            fundRequestUID: fundRequest.REID,
            initiatedAt: now,
            completedAt: now,
        });
        await fulfillerTx.save({ session });

        const requesterTx = new models.Transaction({
            TXID: await generateUniqueTransactionId(),
            userUID: requester.UUID,
            userId: requester._id,
            walletId: requesterWallet._id,
            walletNumber: requesterWallet.walletNumber,
            type: 'P2P_RECEIVE',
            status: 'completed',
            amount: requesterAmount,
            currency: requesterWallet.primaryCurrency,
            fee: feeInRequesterCurrency,
            netAmount: totalCredit,
            description: `Received fulfillment from ${fulfiller.username}`,
            senderUserId: fulfiller._id,
            senderUserUID: fulfiller.UUID,
            senderWalletId: fulfillerWallet._id,
            senderWalletNumber: fulfillerWallet.walletNumber,
            recipientUserId: requester._id,
            recipientUserUID: requester.UUID,
            recipientWalletId: requesterWallet._id,
            recipientWalletNumber: requesterWallet.walletNumber,
            relatedTransactionId: fulfillerTx._id,
            relatedTransactionUID: fulfillerTx.TXID,
            fundRequestId: fundRequest._id,
            fundRequestIdUID: fundRequest.REID,
            initiatedAt: now,
            completedAt: now,
        });
        await requesterTx.save({ session });

        // 6. Update FundRequest Status and Fulfillment ID
        const updatedFundRequest = new models.FundRequest({
            REID: await generateUniqueTransactionId(),
            REFREID: fundRequest.REID,
            requesterUserUID: fundRequest.requesterUserUID,
            requesterUserId: fundRequest.requesterUserId,
            requesterWalletId: fundRequest.requesterWalletId,
            requesterWalletNumber: fundRequest.requesterWalletNumber,
            requestedUserId: fundRequest.requestedUserId,
            requestedUserUID: fundRequest.requestedUserUID,
            amount: fundRequest.amount,
            currency: fundRequest.currency,
            status: 'fulfilled',
            note: fundRequest.note,
            expiresAt: fundRequest.expiresAt,
        });
        await updatedFundRequest.save({ session });

        await updateBalance(fulfillerWallet._id, -fulfillerAmount, null, session);
        await updateBalance(requesterWallet._id, totalCredit, null, session);

        await session.commitTransaction();
        session.endSession();

        await clearCache(`walletDetails:${fulfillerUserId}`);
        await clearCache(`walletDetails:${requester._id}`);

        res.status(200).json({
            success: true,
            message: 'Fund request fulfilled successfully',
            data: { transactionId: fulfillerTx._id }
        });

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
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
        const user = await models.User.findById(userId).populate('mainWalletId').session(session);
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

        // 5. Create Withdrawal models.Transaction Record
        const now = new Date();
        
        const withdrawalTx = new models.Transaction({
            TXID: await generateUniqueTransactionId(),
            userUID: req.user.UUID,
            userId: user._id,
            walletId: wallet._id,
            walletNumber: wallet.walletNumber,
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

