import mongoose from 'mongoose';
import models from '../models/index.js';

import { clearCache } from "../services/utils/cache.js";
import { BINANCE_USDT_DEPOSIT_ADDRESS, BINANCE_USDT_DEPOSIT_MEMO, BINANCE_USDT_DEPOSIT_NETWORK } from '../config/env.js';
import { generateUniqueTransactionId } from '../services/utils/helpers.js';

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
    const updatedWallet = await models.Wallet.findOneAndUpdate(filter, update, options);

    if (!updatedWallet) {
        throw new Error('Insufficient funds or wallet/sub-wallet not found.');
    }
    return updatedWallet;
};

/**
 * @description Get deposit instructions (e.g., Binance address and memo)
 * @route GET /v1/deposit/instructions
 * @access Private
 */
export const getDepositInstructions = async (req, res, next) => {
    const userId = req.user._id.toString(); // Convert ObjectId to string
    try {
        const depositAddress = BINANCE_USDT_DEPOSIT_ADDRESS;
        const depositMemo = BINANCE_USDT_DEPOSIT_MEMO;
        const depositNetwork = BINANCE_USDT_DEPOSIT_NETWORK || 'TRC20';

        if (!depositAddress) {
            console.error("CRITICAL: Binance deposit address not configured in environment variables.");
            return res.status(500).json({ success: false, message: 'Deposit service is currently unavailable. Please contact support.' });
        }

        const uniqueReference = `DEP-${userId.slice(-4)}-${Date.now().toString().slice(-5)}`;

        res.status(200).json({
            success: true,
            data: {
                network: depositNetwork,
                address: depositAddress,
                memo: depositMemo,
                reference: uniqueReference,
                instructions: `Please deposit USDT (${depositNetwork}) to the address above. ${depositMemo ? 'Ensure you include the memo: ' + depositMemo + '.' : ''} After depositing, submit the transaction details and screenshot for verification.`
            }
        });
    } catch (error) {
        console.error("Get Deposit Instructions Error:", error);
        next(error);
    }
};

/**
 * @description Submit deposit details for manual verification (User uploads TxID, amount, screenshot)
 * @route POST /v1/deposit/submit-verification
 * @access Private
 */
export const submitDepositVerification = async (req, res, next) => {
    // Validation should be handled by middleware
    const userId = req.user._id;
    const primaryCurrency = req.user.mainWalletId.primaryCurrency;
    // Destructure userProvidedInfo directly if it's nested in the request body
    const { amount, currency, screenshotUrl, userProvidedInfo } = req.body;
    const binanceTxId = userProvidedInfo?.binanceTxId;
    const senderAddress = userProvidedInfo?.senderAddress;

    // Basic validation (should be replaced by middleware)
    if (!binanceTxId || !amount || amount <= 0 || !currency || !screenshotUrl) {
        return res.status(400).json({ success: false, message: 'Binance Transaction ID, amount, currency, and screenshot URL are required within userProvidedInfo' });
    }

    if (currency !== 'USDT') {
        return res.status(400).json({ success: false, message: 'Only USDT deposits are currently supported' });
    }

    try {
        // Check for duplicate Binance Transaction ID submission by this user?
        const existingVerification = await models.BinanceDepositVerification.findOne({ userId, 'userProvidedInfo.binanceTxId': binanceTxId });
        if (existingVerification) {
            return res.status(409).json({ success: false, message: `Verification for Binance TxID ${binanceTxId} already submitted.` });
        }

        // --- Create Transaction Record First ---
        const user = await models.User.findById(userId).populate('mainWalletId');
        if (!user || !user.mainWalletId) {
             console.error(`User ${userId} or their main wallet not found.`);
             return res.status(404).json({ success: false, message: 'User wallet not found.' });
        }

        
        const depositTx = new models.Transaction({
            TXID: await generateUniqueTransactionId(),
            userId: userId,
            userUID: req.user.UUID,
            walletId: user.mainWalletId._id,
            walletNumber: user.mainWalletId.walletNumber,
            type: 'DEPOSIT',
            status: 'pending',
            amount: amount,
            currency: primaryCurrency,
            fee: 0,
            netAmount: amount,
            description: `Deposit verification submitted (Binance TxID: ${binanceTxId.slice(0, 8)}...)`,
            externalReference: binanceTxId, // Store Binance TxID here
            depositMethod: 'BINANCE_USDT',
            metadata: { screenshotUrl: screenshotUrl, senderAddress: senderAddress }, // Store relevant details
            initiatedAt: new Date(),
        });
        // Save the transaction record
        await depositTx.save();
        // --- Transaction Record Created ---

        // --- Create BinanceDepositVerification. Record, linking to the Transaction ---
        const verification = new models.BinanceDepositVerification({
            userId: userId,
            userUID: req.user.UUID,
            depositTransactionId: depositTx._id, // Link to the created transaction
            depositTransactionUID: depositTx.TXID,
            userProvidedInfo: {
                binanceTxId: binanceTxId,
                amountUSDT: amount,
                senderAddress: senderAddress,
                screenshotUrl: screenshotUrl
            },
            // status: 'pending', // Initial status for API/manual review
            // createdAt will be set automatically
        });

        await verification.save();
        // --- BinanceDepositVerification. Record Created ---

        // Optionally, update the transaction with the verification ID if needed for bidirectional link
        // depositTx.relatedVerificationId = verification._id;
        // await depositTx.save();

        // Notify admin system? (Out of scope)

        res.status(201).json({
            success: true,
            message: 'Deposit details submitted successfully. Please allow time for verification.',
            data: {
                transaction: depositTx.toObject(), // Return created transaction
                verification: verification.toObject() // Return verification record
            }
        });

    } catch (error) {
        console.error("Submit Deposit Verification Error:", error);
        // Handle potential duplicate key error on depositTransactionId if logic allows resubmission attempts
        if (error.code === 11000 && error.keyPattern && error.keyPattern.depositTransactionId) {
             return res.status(409).json({ success: false, message: 'Duplicate submission detected for this transaction.' });
        }
        next(error);
    }
};

/**
 * @description Get status of submitted deposit verifications for the user
 * @route GET /v1/deposit/verification-status
 * @access Private
 */
export const getDepositstatus = async (req, res, next) => {
    const userId = req.user._id; // Use req.user from auth middleware
    const { limit = 10, page = 1 } = req.query;

    const query = { userId: userId };
    const options = {
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
        sort: { createdAt: -1 } // Sort by creation time
    };

    try {
        const verifications = await models.BinanceDepositVerification.find(query, null, options)
            .populate('depositTransactionId', 'status amount currency initiatedAt') // Populate related transaction info
            .select('-__v -userProvidedInfo.screenshotUrl -apiResponseData'); // Exclude fields

        const totalVerifications = await models.BinanceDepositVerification.countDocuments(query);

        res.status(200).json({
            success: true,
            data: verifications,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalVerifications / parseInt(limit)),
                totalItems: totalVerifications
            }
        });
    } catch (error) {
        console.error("Get Deposit Verification Status Error:", error);
        next(error);
    }
};

// --- Admin Actions (Should be in Admin Controller with Admin Auth Middleware) ---

/**
 * @description Manually approve a pending deposit verification and credit user wallet
 * @route PUT /v1/admin/deposits/:verificationId/approve
 * @access Restricted (Admin)
 */
export const approveDeposit = async (req, res, next) => {
    // SECURITY: Add Admin authorization middleware
    const verificationId = req.params.verificationId;
    const adminUserId = req.user._id; // Assuming admin user ID is available from auth middleware

    if (!mongoose.Types.ObjectId.isValid(verificationId)) {
        return res.status(400).json({ success: false, message: 'Invalid Verification ID format' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Find the verification record and the related transaction
        const verification = await models.BinanceDepositVerification.findById(verificationId).populate('depositTransactionId').session(session);
        if (!verification) {
            throw new Error('Deposit verification record not found.');
        }
        if (verification.status !== 'pending' && verification.status !== 'manual_review') {
            // Allow approving if manual review was requested
            throw new Error(`Verification status is already '${verification.status}'. Cannot approve.`);
        }
        if (!verification.depositTransactionId) {
            throw new Error('Associated transaction record not found for this verification.');
        }

        const depositTx = verification.depositTransactionId; // Already populated

        // 2. Find the user and their wallet
        const user = await models.User.findById(verification.userId).populate('mainWalletId').session(session);
        if (!user || !user.mainWalletId) {
            throw new Error('User or user wallet not found.');
        }
        const wallet = user.mainWalletId;

        // 3. Validate currency and amount
        if (wallet.primaryCurrency !== 'USD' || verification.userProvidedInfo.amountUSDT !== depositTx.amount || depositTx.currency !== 'USDT') {
            console.warn(`Currency/Amount mismatch detected during approval for verification ${verificationId}. Wallet: ${wallet.primaryCurrency}, Deposit Amount: ${verification.userProvidedInfo.amountUSDT}, Tx Amount: ${depositTx.amount} ${depositTx.currency}. Assuming 1:1 USD:USDT.`);
            // Potentially flag for review or throw error depending on policy
        }
        const creditAmount = depositTx.amount; // Use amount from the transaction record

        // 4. Credit the user's main wallet balance
        await updateBalance(wallet._id, creditAmount, null, session);

        // 5. Update the verification record status
        verification.status = 'verified'; // Or 'manual_approved'?
        // verification.processedAt = new Date(); // Handled by timestamps: true
        verification.processedBy = adminUserId;
        await verification.save({ session });

        // 6. Update the transaction record status
        depositTx.status = 'completed';
        // depositTx.completedAt = new Date(); // Handled by timestamps: true or pre-save hook
        await depositTx.save({ session });

        // 7. Commit transaction
        await session.commitTransaction();

        // 8. Clear cache
        await clearCache(`walletDetails:${verification.userId}`);
        // Clear user's transaction history cache?

        // Notify user? (Out of scope)

        res.status(200).json({ success: true, message: 'Deposit approved and wallet credited successfully.', data: verification });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("Approve Deposit Error:", error);
        // Provide more specific feedback for common errors
        if (error.message.includes('not found') || error.message.includes('status is already')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    } finally {
        session.endSession();
    }
};

/**
 * @description Manually reject a pending deposit verification
 * @route PUT /v1/admin/deposits/:verificationId/reject
 * @access Restricted (Admin)
 */
export const rejectDeposit = async (req, res, next) => {
    // SECURITY: Add Admin authorization middleware
    const verificationId = req.params.verificationId;
    const adminUserId = req.user._id;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(verificationId)) {
        return res.status(400).json({ success: false, message: 'Invalid Verification ID format' });
    }
    if (!reason) {
        return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Find the verification record and related transaction
        const verification = await models.BinanceDepositVerification.findById(verificationId).populate('depositTransactionId').session(session);
        if (!verification) {
            throw new Error('Deposit verification record not found.');
        }
        if (verification.status !== 'pending' && verification.status !== 'manual_review') {
            throw new Error(`Verification status is already '${verification.status}'. Cannot reject.`);
        }
         if (!verification.depositTransactionId) {
            // This case might indicate an issue, but we can still reject the verification itself
            console.warn(`Associated transaction record not found for verification ${verificationId} during rejection.`);
        }

        // 2. Update the verification record status
        verification.status = 'rejected'; // Or 'manual_rejected'?
        verification.failureReason = reason;
        // verification.processedAt = new Date(); // Handled by timestamps: true
        verification.processedBy = adminUserId;
        await verification.save({ session });

        // 3. Update the associated transaction record status (if found)
        if (verification.depositTransactionId) {
            const depositTx = verification.depositTransactionId;
            depositTx.status = 'rejected';
            depositTx.failureReason = `Verification rejected: ${reason}`;
            // depositTx.completedAt = new Date(); // Or use updatedAt
            await depositTx.save({ session });
        } else {
             // Log that the transaction couldn't be updated
             console.log(`Transaction update skipped for rejected verification ${verificationId} as transaction link was missing.`);
        }

        // 4. Commit transaction
        await session.commitTransaction();

        // Notify user? (Out of scope)

        res.status(200).json({ success: true, message: 'Deposit verification rejected.', data: verification });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("Reject Deposit Error:", error);
        if (error.message.includes('not found') || error.message.includes('status is already')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    } finally {
        session.endSession();
    }
};
