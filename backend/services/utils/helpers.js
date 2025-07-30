import { v7 as uuidv7 } from 'uuid'; // Import UUID for wallet number generation
import crypto from 'crypto';

import Transaction from '../../models/transaction.model.js';
import Wallet from '../../models/wallet.model.js';
import ExchangeRate from '../../models/exchange.model.js';
import UserSubscription from '../../models/user-subscription.model.js';



// Helper function to generate a unique wallet number (example implementation)
export const generateWalletNumber = () => {
  const uuid = uuidv7().replace(/-/g, '');
  const uniquePart = uuid.slice(0, 16);
  return `W${uniquePart.toUpperCase()}`; // أو أي padding يناسبك
};

// Helper function to generate a unique transaction id (example implementation)
export const generateUniqueTransactionId = async () => {
  let uniqueId;
  let exists = true;
  while (exists) {
    uniqueId = `TX-${uuidv7().toUpperCase()}`;
    exists = await Transaction.findOne({ TXID: uniqueId });
  }
  return uniqueId;
};


// Helper function to generate a unique user id (example implementation)
export const generateUserId = () => {
  const uuid = uuidv7().replace(/-/g, '');
  const uniquePart = uuid.slice(0, 12); // Gives you 48 bits = more than 280 trillion possibilities
  return `U${uniquePart.toUpperCase()}`; // Example: U018F6C32A7B2
};



export const convertCurrency = async (amount, fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) return parseFloat(amount);

    const latestRate = await ExchangeRate.findOne().sort({ fetchedAt: -1 });
    if (!latestRate) throw new Error('Exchange rate not available');

    const rates = latestRate.rates;

    // تحويل من "fromCurrency" إلى USD ثم إلى "toCurrency"
    const amountInUSD = parseFloat(amount) / rates[fromCurrency];
    const convertedAmount = amountInUSD * rates[toCurrency];
    return parseFloat(convertedAmount.toFixed(8));
};

// Helper to get user's current subscription plan details (fees, limits)
export const getUserPlanDetails = async (userId, session = null) => {
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


// Helper function to create hash
export const generateHash = async (transaction) => {
  const str = JSON.stringify({
    TXID: transaction.TXID,
    userUID: transaction.userUID?.toString(),
    walletNumber: transaction.walletNumber?.toString(),
    entryType: transaction.entryType,
    type: transaction.type,
    amount: transaction.amount?.toString(),
    fee: transaction.fee?.toString(),
    netAmount: transaction.netAmount?.toString(),
    status: transaction.status,
    note: transaction.note?.toString(),
    previousHash: transaction.previousHash?.toString(),
  });
  return crypto.createHash('sha256').update(str).digest('hex');
}


// Helper to check if a transaction is valid
export const verifyBlockchain = async (userUID) => {
  const transactions = await Transaction.find({ userUID }).sort({ createdAt: 1 });

  let valid = true;
  for (let i = 1; i < transactions.length; i++) {
    const prevTx = transactions[i - 1];
    const currentTx = transactions[i];

    const expectedHash = generateHash({
      ...currentTx.toObject(),
      previousHash: prevTx.hash
    });

    if (currentTx.previousHash !== prevTx.hash || currentTx.hash !== expectedHash) {
      valid = false;
      console.warn(`Tampering detected at transaction: ${currentTx._id}`);
      break;
    }
  }

  return valid;
}


