import mongoose from 'mongoose';
import Wallet from '../models/wallet.model.js';
import Transaction from '../models/transaction.model.js'; // Needed for recording internal transfers
import { getOrSetCache, clearCache } from "../utils/cache.js";

// Helper function for atomic balance updates
const updateBalance = async (walletId, amount, subWalletId = null, session = null) => {
    const update = {};
    const filter = { _id: walletId };

    if (subWalletId) {
        // Update sub-wallet balance
        filter['subWallets._id'] = subWalletId;
        // Ensure sufficient funds if decrementing
        if (amount < 0) {
            filter['subWallets.$.balance'] = { $gte: Math.abs(amount) };
        }
        update['$inc'] = { 'subWallets.$.balance': amount };
    } else {
        // Update main balance
        // Ensure sufficient funds if decrementing
        if (amount < 0) {
            filter.mainBalance = { $gte: Math.abs(amount) };
        }
        update['$inc'] = { mainBalance: amount };
    }

    const options = { new: true, session };
    const updatedWallet = await Wallet.findOneAndUpdate(filter, update, options);

    if (!updatedWallet) {
        // Throw error if funds were insufficient or wallet/subwallet not found
        throw new Error('Insufficient funds or wallet/sub-wallet not found.');
    }
    return updatedWallet;
};

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
            const wallet = await Wallet.findOne({ userId: userId })
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
    const userId = req.userId;
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ success: false, message: 'Sub-wallet name is required' });
    }

    try {
        const wallet = await Wallet.findOne({ userId: userId });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Main wallet not found' });
        }

        // Check if sub-wallet name already exists (optional, based on requirements)
        const existingSubWallet = wallet.subWallets.find(sub => sub.name === name);
        if (existingSubWallet) {
            return res.status(409).json({ success: false, message: `Sub-wallet with name '${name}' already exists` });
        }

        // Limit number of sub-wallets? (Check subscription plan?)

        const newSubWallet = {
            name: name,
            balance: 0, // Starts with zero balance
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
    const userId = req.userId;
    const subWalletId = req.params.subWalletId;
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ success: false, message: 'New sub-wallet name is required' });
    }
    if (!subWalletId) {
        return res.status(400).json({ success: false, message: 'Sub-wallet ID is required' });
    }

    try {
        const wallet = await Wallet.findOne({ userId: userId, 'subWallets._id': subWalletId });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Sub-wallet not found' });
        }

        // Check if new name conflicts with another sub-wallet
        const conflictingSubWallet = wallet.subWallets.find(sub => sub.name === name && sub._id.toString() !== subWalletId);
        if (conflictingSubWallet) {
            return res.status(409).json({ success: false, message: `Another sub-wallet with name '${name}' already exists` });
        }

        // Update using positional operator
        const result = await Wallet.updateOne(
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
    const userId = req.userId;
    const subWalletId = req.params.subWalletId;

    if (!subWalletId) {
        return res.status(400).json({ success: false, message: 'Sub-wallet ID is required' });
    }

    try {
        const wallet = await Wallet.findOne({ userId: userId, 'subWallets._id': subWalletId });
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
        const result = await Wallet.updateOne(
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
    // SECURITY: Add input validation middleware
    const userId = req.userId;
    const { amount, currency, from, to, description } = req.body;
    // 'from' and 'to' can be 'main' or a subWalletId

    if (!amount || amount <= 0 || !currency || !from || !to) {
        return res.status(400).json({ success: false, message: 'Missing required fields: amount, currency, from, to' });
    }
    if (from === to) {
        return res.status(400).json({ success: false, message: 'Source and destination cannot be the same' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const wallet = await Wallet.findOne({ userId: userId }).session(session);
        if (!wallet) {
            throw new Error('Main wallet not found');
        }

        // Validate currency
        if (currency !== wallet.primaryCurrency) {
            throw new Error(`Invalid currency. Wallet currency is ${wallet.primaryCurrency}`);
        }

        // Determine source and destination IDs
        const sourceId = from === 'main' ? null : from;
        const destId = to === 'main' ? null : to;

        // 1. Decrement source balance
        await updateBalance(wallet._id, -amount, sourceId, session);

        // 2. Increment destination balance
        await updateBalance(wallet._id, amount, destId, session);

        // 3. Record the transaction
        const transaction = new Transaction({
            userId: userId,
            walletId: wallet._id,
            // subWalletId: sourceId || destId, // Indicate which sub-wallet was involved? Maybe too complex.
            type: 'SUBWALLET_TRANSFER',
            status: 'completed',
            amount: amount,
            currency: currency,
            fee: 0, // Internal transfers are free
            netAmount: amount,
            description: description || `Transfer from ${from === 'main' ? 'main' : 'sub-wallet '+ from} to ${to === 'main' ? 'main' : 'sub-wallet '+ to}`,
            initiatedAt: new Date(),
            completedAt: new Date(),
        });
        await transaction.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Clear cache
        await clearCache(`walletDetails:${userId}`);
        // Clear transaction history cache if implemented

        res.status(200).json({ success: true, message: 'Internal transfer successful', data: { transactionId: transaction._id } });

    } catch (error) {
        // Abort transaction on error
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();

        console.error("Internal Transfer Error:", error);
        // Provide specific error messages
        if (error.message.includes('Insufficient funds')) {
            return res.status(400).json({ success: false, message: 'Insufficient funds in source wallet.' });
        }
        if (error.message.includes('not found')) {
             return res.status(404).json({ success: false, message: 'Source or destination wallet not found.' });
        }
        next(error);
    }
};

