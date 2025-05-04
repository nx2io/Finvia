import mongoose from 'mongoose';

// SECURITY: Ensure strict validation of all input data (IDs, amounts, types, status transitions) in the application layer before creating or modifying transactions.
// This model provides a unified log for all financial movements within the system.
const transactionSchema = new mongoose.Schema({
    userId: { // The user initiating or primarily associated with the transaction
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    walletId: { // The main wallet involved
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet',
        required: true,
        index: true
    },
    subWalletId: { // Optional: If the transaction involves a specific sub-wallet
        type: mongoose.Schema.Types.ObjectId,
        // No ref needed if sub-wallets are embedded in Wallet model
        index: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            'DEPOSIT',          // Funds added via external source (e.g., Binance USDT)
            'WITHDRAWAL',       // Funds sent to external bank account
            'P2P_SEND',         // Peer-to-peer transfer sent
            'P2P_RECEIVE',      // Peer-to-peer transfer received
            'P2P_REQUEST_SEND', // Request for funds sent (no balance change yet)
            'P2P_REQUEST_RECEIVE',// Request for funds received (no balance change yet)
            'P2P_REQUEST_FULFILL',// Fulfilling a received fund request
            'SUBWALLET_TRANSFER', // Transfer between main and sub-wallet or between sub-wallets
            'SUBSCRIPTION_FEE', // Payment for a subscription plan
            'TRANSACTION_FEE',  // Fee charged for a specific transaction (e.g., withdrawal)
            'ADJUSTMENT_CREDIT',// Manual credit adjustment by admin
            'ADJUSTMENT_DEBIT' // Manual debit adjustment by admin
        ],
        index: true
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'rejected', 'requested'],
        default: 'pending',
        index: true
    },
    amount: { // The primary amount of the transaction
        type: Number,
        required: true
        // Use mongoose-decimal128 for precision
    },
    currency: { // Currency of the amount (should match wallet's primary currency)
        type: String,
        required: true,
        enum: ['USD', 'SAR', 'EUR']
    },
    fee: { // Optional fee associated with the transaction
        type: Number,
        default: 0
        // Use mongoose-decimal128 for precision
    },
    netAmount: { // Amount after fees (amount - fee for debits, amount for credits)
        type: Number
        // Use mongoose-decimal128 for precision
    },
    description: { // User-friendly description or system-generated note
        type: String,
        trim: true,
        maxLength: 250
    },
    // --- References to related entities/details --- 
    relatedTransactionId: { // Link related transactions (e.g., fee and withdrawal)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        index: true
    },
    externalReference: { // Reference from external systems (e.g., Binance TxID, Bank Transfer ID)
        type: String,
        trim: true,
        index: true
    },
    // --- P2P Specific Fields --- 
    senderUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    senderWalletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', index: true },
    recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    recipientWalletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', index: true },
    fundRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'FundRequest', index: true }, // Link to the fund request if applicable

    // --- Withdrawal Specific Fields ---
    bankAccountId: { type: mongoose.Schema.Types.ObjectId }, // Reference to the User's BankAccount _id

    // --- Deposit Specific Fields ---
    depositMethod: { type: String, enum: ['BINANCE_USDT', 'BANK_TRANSFER', 'CARD'] }, // More specific than type
    depositDetails: { type: mongoose.Schema.Types.Mixed }, // Store details like sender address, screenshot URL (temporary until API check)

    // --- Timestamps & Metadata ---
    initiatedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    failureReason: { type: String, trim: true }, // Reason if status is failed/rejected

}, { timestamps: true }); // Adds createdAt, updatedAt

// Calculate netAmount before saving
transactionSchema.pre('save', function(next) {
    if (this.isModified('amount') || this.isModified('fee')) {
        // Simple calculation, adjust logic based on transaction type if needed
        // For debits (withdrawal, send, fee), net is usually amount + fee from user perspective
        // For credits (deposit, receive), net is usually amount - fee
        // This example assumes 'amount' is the gross value and 'fee' is deducted/added.
        // A more robust approach might store debit/credit amounts separately.
        this.netAmount = this.amount - this.fee; 
    }
    if (this.status === 'completed' && !this.completedAt) {
        this.completedAt = new Date();
    }
    next();
});

// Indexes for common queries
transactionSchema.index({ userId: 1, status: 1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ createdAt: -1 });

// SECURITY: Ensure balance updates in the Wallet model are handled atomically 
// (e.g., using findOneAndUpdate with $inc) *within the same operation* that creates/updates the corresponding transaction.
// Use MongoDB transactions or application-level locking to guarantee consistency between the Transaction record and the Wallet balance.

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;

