import mongoose from 'mongoose';
import { generateHash } from '../services/utils/helpers.js';

// SECURITY: Ensure strict validation of all input data (IDs, amounts, types, status transitions) in the application layer before creating or modifying transactions.
// This model provides a unified log for all financial movements within the system.
const transactionSchema = new mongoose.Schema({
    TXID: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: { // The user initiating or primarily associated with the transaction
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    userUID: { // The user initiating or primarily associated with the transaction
        type: String,
        required: true,
        index: true
    },
    walletId: { // The main wallet involved
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet',
        required: true,
        index: true
    },
    walletNumber: { // The main wallet involved
        type: String,
        required: true,
        index: true
    },
    // subWalletId: { // Optional: If the transaction involves a specific sub-wallet
    //     type: mongoose.Schema.Types.ObjectId,
    //     // No ref needed if sub-wallets are embedded in Wallet model
    //     index: true
    // },
    entryType: {
        type: String,
        enum: ['CREDIT', 'DEBIT', 'INTERNAL'],
        index: true
    },

    type: {
        type: String,
        required: true,
        enum: [
            'DEPOSIT',              // Funds added via external source (e.g., Binance USDT)
            'WITHDRAWAL',           // Funds sent to external bank account
            'P2P_SEND',             // Peer-to-peer transfer sent
            'P2P_RECEIVE',          // Peer-to-peer transfer received
            'P2P_REQUEST_SEND',     // Request for funds sent (no balance change yet)
            'P2P_REQUEST_RECEIVE',  // Request for funds received (no balance change yet)
            'P2P_REQUEST_FULFILL',  // Fulfilling a received fund request
            'SUBWALLET_TRANSFER',   // Transfer between main and sub-wallet or between sub-wallets
            'SUBSCRIPTION_FEE',     // Payment for a subscription plan
            'TRANSACTION_FEE',      // Fee charged for a specific transaction (e.g., withdrawal)
            'ADJUSTMENT_CREDIT',    // Manual credit adjustment by admin
            'ADJUSTMENT_DEBIT'      // Manual debit adjustment by admin
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
        type: mongoose.Schema.Types.Decimal128,
        required: true
        // Use mongoose-decimal128 for precision
    },
    currency: { // Currency of the amount (should match wallet's primary currency)
        type: String,
        required: true,
        enum: ['USD', 'SAR', 'EUR']
    },
    fee: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
        validate: {
            validator: function (v=0) {
                console.log(parseFloat(v.toString()));
                
                return parseFloat(v.toString()) >= 0;
            },
            message: 'Fee must be a positive value'
        }
    },
    netAmount: { // Amount after fees (amount - fee for debits, amount for credits)
        type: mongoose.Schema.Types.Decimal128,
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
    relatedTransactionUID: { // Link related transactions (e.g., fee and withdrawal)
        type: String,
        index: true
    },
    externalReference: { // Reference from external systems (e.g., Binance TxID, Bank Transfer ID)
        type: String,
        trim: true,
        index: { unique: true, sparse: true }
    },
    // --- P2P Specific Fields --- 
    senderUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    senderUserUID: { type: String, index: true },
    senderWalletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', index: true },
    senderWalletNumber: { type: String, index: true },
    recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    recipientUserUID: { type: String, index: true },
    recipientWalletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', index: true },
    recipientWalletNumber: { type: String, index: true },
    fundRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'FundRequest', index: true }, // Link to the fund request if applicable
    fundRequestUID: { type: String, index: true },

    // --- Withdrawal Specific Fields ---
    bankAccountId: { type: mongoose.Schema.Types.ObjectId }, // Reference to the User's BankAccount _id
    bankDetailsSnapshot: { type: String }, // Snapshot of bank details for reference

    // --- Deposit Specific Fields ---
    depositMethod: { type: String, enum: ['BINANCE_USDT', 'BANK_TRANSFER', 'CARD'] }, // More specific than type
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },


    // --- Timestamps & Metadata ---
    initiatedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    failureReason: { type: String, trim: true }, // Reason if status is failed/rejected

    // --- blockchain transaction hash ---  
    hash: {
        type: String,
        index: { unique: true }
    },
    previousHash: {
        type: String,
        default: null,
        index: true
    },


}, { timestamps: true }); // Adds createdAt, updatedAt


// Calculate netAmount before saving
transactionSchema.pre('save',async  function(next) {
    if (!this.entryType) {
        let entryType = null;

        switch (this.type) {
            case 'DEPOSIT':
                case 'P2P_RECEIVE':
                    case 'ADJUSTMENT_CREDIT':
                        entryType = 'CREDIT';
                        break;
                        
                        case 'WITHDRAWAL':
                            case 'P2P_SEND':
                                case 'SUBSCRIPTION_FEE':
                                    case 'TRANSACTION_FEE':
                                        case 'ADJUSTMENT_DEBIT':
                                            case 'P2P_REQUEST_FULFILL':
                                                entryType = 'DEBIT';
                                                break;
                                                
                                                case 'SUBWALLET_TRANSFER':
                                                    case 'P2P_REQUEST_SEND':
                                                        case 'P2P_REQUEST_RECEIVE':
                                                            entryType = 'INTERNAL'; // Internal transactions do not deduct or add
                                                            break;
                                                            default:
                                                                return next(new Error(`Unknown transaction type: ${this.type}`));
                                                            
        }

        this.entryType = entryType;
    }
    if (this.isNew) {
      // Get the last transaction for the same user
      const lastTx = await Transaction.findOne({ userId: this.userId }).sort({ createdAt: -1 });

      this.previousHash = lastTx?.hash || null;

      // Wait for the hash generation result because it is async
      this.hash = await generateHash(this);

      if (!this.hash) {
        throw new Error('Failed to generate hash');
      }
    } else {
      // If it is new, do not allow modification of the hash or previous hash.
      if (this.isModified('hash') || this.isModified('previousHash')) {
        return next(new Error('Transaction hash is immutable'));
      }
    }
    if (!this.isNew && (this.isModified('hash') || this.isModified('previousHash'))) {
        return next(new Error('Transaction hash is immutable'));
    }



    if (this.isModified('amount') || this.isModified('fee')) {
        const Decimal128 = mongoose.Types.Decimal128;
        const amount = parseFloat(this.amount.toString());
        const fee = parseFloat(this.fee?.toString() || "0");
        if (fee > amount) return next(new Error('Fee cannot exceed amount'));

        if (['WITHDRAWAL', 'P2P_SEND', 'TRANSACTION_FEE'].includes(this.type)) {
            this.netAmount = Decimal128.fromString((amount + fee).toFixed(8));
        } else {
            this.netAmount = Decimal128.fromString((amount - fee).toFixed(8));
        }
    }

    
    if (this.status === 'completed' && !this.completedAt) {
        this.completedAt = new Date();
    }


    next();
});



// Indexes for common queries
transactionSchema.index({ userId: 1, status: 1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ walletId: 1, createdAt: -1 });



// SECURITY: Ensure balance updates in the Wallet model are handled atomically 
// (e.g., using findOneAndUpdate with $inc) *within the same operation* that creates/updates the corresponding transaction.
// Use MongoDB transactions or application-level locking to guarantee consistency between the Transaction record and the Wallet balance.

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;

