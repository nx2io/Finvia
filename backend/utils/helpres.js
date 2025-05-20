import { v4 as uuidv4 } from 'uuid'; // Import UUID for wallet number generation

import Wallet from '../models/wallet.model';

// Helper function to generate a unique wallet number (example implementation)
export const generateWalletNumber = () => {
  const uuid = uuidv4().replace(/-/g, '');
  return `W${Date.now().toString().slice(-6)}${uuid.slice(0, 6)}`.toUpperCase();
};

// Helper function for atomic balance updates
export const updateBalance = async (walletId, amount, subWalletId = null, session = null) => {
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