import mongoose from 'mongoose';
import models from '../models/index.js';

import { generateWalletNumber, convertCurrency, generateUniqueTransactionId } from '../services/utils/helpers.js';
import { getOrSetCache, clearCache } from "../services/utils/cache.js";




/**
 * @description Get wallet details (main balance, sub-wallets) for the authenticated user
 * @route GET /v1/wallet/details
 * @access Private
 */
export const getWalletDetails = async (req, res, next) => {
    const userId = req.user._id;
    try {
        // Use cache
        const walletDetails = await getOrSetCache(`walletDetails:${userId}`, async () => {
            const wallet = await models.Wallet.findOne({ userId: userId })
                .select('-__v -createdAt -lastUpdatedAt'); // Exclude unnecessary fields
            if (!wallet) {
                // This case should ideally not happen if wallet is created at signup
                throw new Error('Wallet not found for user.');
            }
            return wallet;
        }, 60); // Cache for 60 seconds

        res.status(200).json({ success: true, data: walletDetails });
    } catch (error) {
        console.error("Get Wallet Details Error:", error);
        // Handle specific error for wallet not found
        if (error.message.includes('Wallet not found')) {
            return res.status(404).json({ success: false, message: error.message });
        }
        next(error);
    }
};




/**
 * @description Create a new sub-wallet
 * @route POST /v1/wallet/subwallets
 * @access Private
 */
export const createSubWallet = async (req, res, next) => {
    // SECURITY: Add input validation middleware
    const userId = req.user._id;
    const { name, currency } = req.body;

    if (!name) {
        return res.status(400).json({ success: false, message: 'Sub-wallet name is required' });
    }

    try {
        const wallet = await models.Wallet.findOne({ userId: userId });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Main wallet not found' });
        }

        
        // Check if sub-wallet name already exists (optional, based on requirements)
        const existingSubWallet = wallet.subWallets.find(sub => sub.name === name);
        if (existingSubWallet) {
            return res.status(409).json({ success: false, message: `Sub-wallet with name '${name}' already exists` });
        }
        
        // Limit number of sub-wallets? (Check subscription plan?)
        const subWalletNumber = generateWalletNumber();
        const newSubWallet = {
            name,
            subWalletNumber,
            balance: 0,
            currency,
            createdAt: new Date()
        };
        wallet.subWallets.push(newSubWallet);
        await wallet.save();

        // Find the newly added sub-wallet to return its ID
        const addedSubWallet = wallet.subWallets[wallet.subWallets.length - 1];

        // Clear cache
        await clearCache(`walletDetails:${userId}`);

        res.status(201).json({ success: true, message: 'Sub-wallet created successfully', data: addedSubWallet });
    } catch (error) {
        console.error("Create SubWallet Error:", error);
        next(error);
    }
};




/**
 * @description Update a sub-wallet (e.g., rename)
 * @route PUT /v1/wallet/subwallets/:subWalletId
 * @access Private
 */
export const updateSubWallet = async (req, res, next) => {
    // SECURITY: Add input validation middleware
    const userId = req.user._id;
    const subWalletId = req.params.subWalletId;
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ success: false, message: 'New sub-wallet name is required' });
    }
    if (!subWalletId) {
        return res.status(400).json({ success: false, message: 'Sub-wallet ID is required' });
    }

    try {
        const wallet = await models.Wallet.findOne({ userId: userId, 'subWallets._id': subWalletId });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Sub-wallet not found' });
        }

        // Check if new name conflicts with another sub-wallet
        const conflictingSubWallet = wallet.subWallets.find(sub => sub.name === name && sub._id.toString() !== subWalletId);
        if (conflictingSubWallet) {
            return res.status(409).json({ success: false, message: `Another sub-wallet with name '${name}' already exists` });
        }

        // Update using positional operator
        const result = await models.Wallet.updateOne(
            { _id: wallet._id, 'subWallets._id': subWalletId },
            { $set: { 'subWallets.$.name': name } }
        );

        if (result.modifiedCount === 0) {
            // This might happen if the name wasn't actually changed
            return res.status(304).json({ success: true, message: 'Sub-wallet name not modified' });
        }

        // Clear cache
        await clearCache(`walletDetails:${userId}`);

        res.status(200).json({ success: true, message: 'Sub-wallet updated successfully' });
    } catch (error) {
        console.error("Update SubWallet Error:", error);
        next(error);
    }
};

/**
 * @description Delete a sub-wallet (only if balance is zero)
 * @route DELETE /v1/wallet/subwallets/:subWalletId
 * @access Private
 */
export const deleteSubWallet = async (req, res, next) => {
    const userId = req.user._id;
    const subWalletId = req.params.subWalletId;

    if (!subWalletId) {
        return res.status(400).json({ success: false, message: 'Sub-wallet ID is required' });
    }

    try {
        const wallet = await models.Wallet.findOne({ userId: userId, 'subWallets._id': subWalletId });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Sub-wallet not found' });
        }

        const subWallet = wallet.subWallets.id(subWalletId);
        if (!subWallet) {
             return res.status(404).json({ success: false, message: 'Sub-wallet not found within wallet document' });
        }

        // Check balance before deletion
        if (subWallet.balance !== 0) {
            return res.status(400).json({ success: false, message: 'Cannot delete sub-wallet with a non-zero balance. Please transfer funds first.' });
        }

        // Pull the sub-wallet from the array
        const result = await models.Wallet.updateOne(
            { _id: wallet._id },
            { $pull: { subWallets: { _id: subWalletId } } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: 'Sub-wallet not found or already deleted' });
        }

        // Clear cache
        await clearCache(`walletDetails:${userId}`);

        res.status(200).json({ success: true, message: 'Sub-wallet deleted successfully' });
    } catch (error) {
        console.error("Delete SubWallet Error:", error);
        next(error);
    }
};




/**
 * @description Transfer funds between main wallet and sub-wallet, or between sub-wallets
 * @route POST /v1/wallet/transfer-internal
 * @access Private
 */
export const transferInternal = async (req, res, next) => {
    const userId = req.user._id;
    const { amount, currency, type, from, to } = req.body;

    if (!amount || amount <= 0 || !currency || !type) {
        return res.status(400).json({ success: false, message: 'Missing required fields: amount, currency, type' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const wallet = await models.Wallet.findOne({ userId }).session(session);
        if (!wallet) throw new Error('Main wallet not found');

        let sourceSubIndex = -1;
        let destSubIndex = -1;
        let convertedAmount = parseFloat(amount);

        if (type === 'P2S') {
            if (!to) throw new Error('Destination sub-wallet required for P2S');
            destSubIndex = wallet.subWallets.findIndex(sw => sw.subWalletNumber === to);
            if (destSubIndex === -1) throw new Error('Destination sub-wallet not found');

            const destSub = wallet.subWallets[destSubIndex];

            if (wallet.mainBalance < amount) throw new Error('Insufficient funds');

            // تحويل العملة إن لزم
            if (wallet.primaryCurrency !== destSub.currency) {
                convertedAmount = await convertCurrency(amount, wallet.primaryCurrency, destSub.currency);
            }

            wallet.mainBalance = (wallet.mainBalance - amount).toFixed(2);
            destSub.balance = (parseFloat(destSub.balance) + convertedAmount).toFixed(2);
        }

        else if (type === 'S2P') {
            if (!from) throw new Error('Source sub-wallet required for S2P');
            sourceSubIndex = wallet.subWallets.findIndex(sw => sw.subWalletNumber === from);
            if (sourceSubIndex === -1) throw new Error('Source sub-wallet not found');

            const sourceSub = wallet.subWallets[sourceSubIndex];

            if (sourceSub.balance < amount) throw new Error('Insufficient funds');

            // تحويل العملة إن لزم
            if (sourceSub.currency !== wallet.primaryCurrency) {
                convertedAmount = await convertCurrency(amount, sourceSub.currency, wallet.primaryCurrency);
            }

            sourceSub.balance = (sourceSub.balance - amount).toFixed(2);
            wallet.mainBalance = (parseFloat(wallet.mainBalance) + convertedAmount).toFixed(2);
        }

        else if (type === 'S2S') {
            if (!from || !to) throw new Error('Both source and destination sub-wallets are required for S2S');
            if (from === to) throw new Error('Source and destination cannot be the same');

            sourceSubIndex = wallet.subWallets.findIndex(sw => sw.subWalletNumber === from);
            destSubIndex = wallet.subWallets.findIndex(sw => sw.subWalletNumber === to);
            if (sourceSubIndex === -1 || destSubIndex === -1) throw new Error('Source or destination sub-wallet not found');

            const sourceSub = wallet.subWallets[sourceSubIndex];
            const destSub = wallet.subWallets[destSubIndex];

            if (sourceSub.balance < amount) throw new Error('Insufficient funds');

            // تحويل العملة إن لزم
            if (sourceSub.currency !== destSub.currency) {
                convertedAmount = await convertCurrency(amount, sourceSub.currency, destSub.currency);
            }

            sourceSub.balance = (sourceSub.balance - amount).toFixed(2);
            destSub.balance = (parseFloat(destSub.balance) + convertedAmount).toFixed(2);
        }

        await wallet.save({ session });

        
        const transaction = new models.Transaction({
            TXID: await generateUniqueTransactionId(),
            userUID: req.user.UUID,
            userId: userId,
            walletId: wallet._id,
            walletNumber: wallet.walletNumber,
            type: 'SUBWALLET_TRANSFER',
            status: 'completed',
            amount: amount,
            currency: currency,
            fee: 0,
            netAmount: amount,
            description: `Transfer (${type}) From ${from} to ${to}`,
            initiatedAt: new Date(),
            completedAt: new Date(),
        });
        await transaction.save({ session });

        await session.commitTransaction();
        session.endSession();

        await clearCache(`walletDetails:${userId}`);

        res.status(200).json({
            success: true,
            message: 'Internal transfer successful',
            data: { transactionId: transaction._id }
        });

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        session.endSession();

        console.error("Internal Transfer Error:", error);
        if (error.message.includes('Insufficient funds')) {
            return res.status(400).json({ success: false, message: 'Insufficient funds in source wallet.' });
        }
        if (error.message.includes('not found')) {
            return res.status(404).json({ success: false, message: error.message });
        }
        next(error);
    }
};
